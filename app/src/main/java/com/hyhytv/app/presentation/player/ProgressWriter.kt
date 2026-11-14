package com.hyhytv.app.presentation.player

import com.hyhytv.app.domain.model.WatchRecord
import com.hyhytv.app.domain.repository.FilmRepository
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import javax.inject.Inject
import javax.inject.Singleton

/** Final writes survive the playback ViewModel being removed from the back stack. */
@Singleton
class ProgressWriter @Inject constructor(private val repository: FilmRepository) {
    private val queue = Channel<WatchRecord>(Channel.UNLIMITED)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    init { scope.launch { for (record in queue) {
        try { repository.saveProgress(record) }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { android.util.Log.e("HyHyTv", "Unable to persist playback progress", e) }
    } } }
    fun save(record: WatchRecord) { queue.trySend(record) }
}
