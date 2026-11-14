@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
package com.hyhytv.app.presentation.player

import android.content.Context
import androidx.lifecycle.*
import androidx.media3.common.*
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.*
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.hyhytv.app.core.common.userMessage
import com.hyhytv.app.data.local.Preferences
import com.hyhytv.app.domain.model.*
import com.hyhytv.app.domain.repository.FilmRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import javax.inject.Inject

data class PlaybackUi(val film: Film? = null, val server: Int = 0, val episode: Int = 0,
    val loading: Boolean = true, val missingSource: Boolean = false, val error: String? = null,
    val position: Long = 0, val duration: Long = 0, val playing: Boolean = false, val buffering: Boolean = false,
    val trackVersion: Int = 0) {
    val currentServer get() = film?.servers?.getOrNull(server)
    val currentEpisode get() = currentServer?.episodes?.getOrNull(episode)
}

@HiltViewModel
class PlayerViewModel @Inject constructor(@ApplicationContext context: Context, private val repository: FilmRepository,
    private val prefs: Preferences, private val writer: ProgressWriter, savedState: SavedStateHandle) : ViewModel() {
    private val slug = checkNotNull(savedState.get<String>("slug"))
    private val initialServer = savedState.get<Int>("server") ?: 0
    private val initialEpisode = savedState.get<Int>("episode") ?: 0
    private val _state = MutableStateFlow(PlaybackUi())
    val state = _state.asStateFlow()
    private var loadJob: Job? = null
    private var autoNext = true
    private var sourceUrl: String? = null
    private var savedAtPosition = -1L
    private var hasStarted = false
    private var foreground = true
    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setMediaSourceFactory(DefaultMediaSourceFactory(OkHttpDataSource.Factory(OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).build()).setUserAgent("HyHyTv/1.0")))
        .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(15_000, 45_000, 1500, 3000).setTargetBufferBytes(32 * 1024 * 1024).build())
        .setSeekBackIncrementMs(10_000).setSeekForwardIncrementMs(10_000).build().apply {
            setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
            setHandleAudioBecomingNoisy(true)
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) { if (isPlaying) hasStarted = true; updatePlayback() }
                override fun onPlaybackStateChanged(playbackState: Int) {
                    updatePlayback()
                    if (playbackState == Player.STATE_ENDED) {
                        saveProgress()
                        if (autoNext) this@PlayerViewModel.next()
                    }
                }
                override fun onTracksChanged(tracks: Tracks) { _state.update { it.copy(trackVersion = it.trackVersion + 1) } }
                override fun onPlayerError(error: PlaybackException) {
                    _state.update { it.copy(error = "Không phát được nguồn video (${error.errorCodeName}). Thử lại hoặc chọn nguồn khác.", buffering = false) }
                }
            })
        }
    init {
        viewModelScope.launch { prefs.settings.collect { autoNext = it.autoNext } }
        viewModelScope.launch {
            while (isActive) { delay(1000); updatePlayback(); if (player.isPlaying && player.currentPosition - savedAtPosition >= 5000) saveProgress() }
        }
        reloadFilm()
    }
    fun reloadFilm() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val film = repository.detail(slug)
                _state.update { it.copy(film = film) }
                val record = if (initialServer < 0) repository.progress(slug) else null
                val s = if (record != null) film.servers.indexOfFirst { it.name == record.server }.coerceAtLeast(0) else initialServer.coerceAtLeast(0)
                val e = if (record != null) film.servers.getOrNull(s)?.episodes?.indexOfFirst { it.slug == record.episodeSlug }?.coerceAtLeast(0) ?: 0 else initialEpisode.coerceAtLeast(0)
                openEpisode(s, e)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { _state.update { it.copy(loading = false, error = e.userMessage()) } }
        }
    }
    fun selectEpisode(server: Int, episode: Int) {
        saveProgress()
        loadJob?.cancel()
        player.pause(); player.clearMediaItems(); sourceUrl = null
        loadJob = viewModelScope.launch { openEpisode(server, episode) }
    }
    private suspend fun openEpisode(server: Int, episode: Int, overridePosition: Long? = null) {
        val film = _state.value.film ?: return
        val s = server.coerceIn(0, (film.servers.size - 1).coerceAtLeast(0))
        val available = film.servers.getOrNull(s)?.episodes.orEmpty()
        val e = episode.coerceIn(0, (available.size - 1).coerceAtLeast(0))
        _state.update { it.copy(server = s, episode = e, loading = true, missingSource = false, error = null, position = 0, duration = 0, playing = false) }
        hasStarted = false; savedAtPosition = -1
        val selected = available.getOrNull(e)
        if (selected == null) { _state.update { it.copy(loading = false, error = "Phim chưa có tập phát.") }; return }
        try {
            val url = repository.source(film.slug, film.servers[s].name, selected.slug) ?: selected.directUrl
            sourceUrl = url
            if (url == null) { _state.update { it.copy(loading = false, missingSource = true) }; return }
            val record = repository.progress(slug)
            val resume = overridePosition ?: record?.takeIf { it.episodeSlug == selected.slug && it.server == film.servers[s].name }?.resumePosition ?: 0
            val item = MediaItem.Builder().setUri(url)
                .setMediaMetadata(MediaMetadata.Builder().setTitle(film.name).setSubtitle("Tập ${selected.name}").build()).build()
            player.setMediaItem(item, resume)
            player.prepare(); player.playWhenReady = foreground
            _state.update { it.copy(loading = false, position = resume, buffering = true) }
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { _state.update { it.copy(loading = false, error = e.userMessage()) } }
    }
    fun provideSource(url: String) {
        val current = _state.value
        val film = current.film ?: return
        val server = current.currentServer ?: return
        val episode = current.currentEpisode ?: return
        if (!isDirectMediaUrl(url)) { _state.update { it.copy(error = "Nhập liên kết HTTPS kết thúc bằng .m3u8, .mp4, .mpd hoặc .webm.") }; return }
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                repository.saveSource(film.slug, server.name, episode.slug, url)
                openEpisode(current.server, current.episode)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { _state.update { it.copy(error = e.userMessage()) } }
        }
    }
    fun retry() {
        if (sourceUrl != null) { _state.update { it.copy(error = null) }; player.prepare(); player.play() }
        else if (_state.value.film == null) reloadFilm()
        else selectEpisode(_state.value.server, _state.value.episode)
    }
    fun togglePlay() { if (player.isPlaying) player.pause() else player.play() }
    fun seek(delta: Long) {
        val duration = player.duration.takeIf { it > 0 } ?: Long.MAX_VALUE
        player.seekTo((player.currentPosition + delta).coerceIn(0, duration)); updatePlayback()
    }
    fun next() { val current = _state.value; if (current.episode + 1 < current.currentServer?.episodes.orEmpty().size) selectEpisode(current.server, current.episode + 1) }
    fun previous() { val current = _state.value; if (current.episode > 0) selectEpisode(current.server, current.episode - 1) }
    fun switchServer(index: Int) {
        val current = _state.value
        val episodes = current.film?.servers?.getOrNull(index)?.episodes.orEmpty()
        val matchingIndex = episodes.indexOfFirst { it.slug == current.currentEpisode?.slug }
        val match = matchingIndex.coerceAtLeast(0)
        saveProgress(); val position = if (matchingIndex >= 0) player.currentPosition else 0
        loadJob?.cancel(); player.pause(); player.clearMediaItems()
        loadJob = viewModelScope.launch { openEpisode(index, match, position) }
    }
    fun onStart() { foreground = true }
    fun pauseAndSave() { foreground = false; saveProgress(); player.pause() }
    fun saveProgress() {
        val current = _state.value
        if (!hasStarted || sourceUrl == null || current.loading || current.missingSource || current.film == null || current.currentEpisode == null) return
        val position = player.currentPosition.coerceAtLeast(0)
        writer.save(WatchRecord(current.film, current.currentServer!!.name, current.currentEpisode!!.slug, current.currentEpisode!!.name,
            position, player.duration.coerceAtLeast(0), System.currentTimeMillis()))
        savedAtPosition = position
    }
    private fun updatePlayback() { _state.update { it.copy(position = player.currentPosition.coerceAtLeast(0), duration = player.duration.coerceAtLeast(0),
        playing = player.isPlaying, buffering = player.playbackState == Player.STATE_BUFFERING) } }
    override fun onCleared() { saveProgress(); player.release(); super.onCleared() }
}
