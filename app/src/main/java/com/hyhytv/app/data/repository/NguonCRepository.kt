package com.hyhytv.app.data.repository

import com.google.gson.Gson
import com.hyhytv.app.core.network.RequestCache
import com.hyhytv.app.data.local.*
import com.hyhytv.app.data.mapper.toFilm
import com.hyhytv.app.data.remote.NguonCApi
import com.hyhytv.app.domain.model.*
import com.hyhytv.app.domain.repository.FilmRepository
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NguonCRepository @Inject constructor(private val api: NguonCApi, private val dao: LibraryDao, private val gson: Gson) : FilmRepository {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val pages = RequestCache<FilmPage>(scope)
    private val details = RequestCache<Film>(scope, 24, 300_000)
    private val favoriteLock = Mutex()
    override suspend fun page(path: String, page: Int, keyword: String?): FilmPage = pages.get("$path|$page|${keyword.orEmpty()}") {
        require(path.startsWith("films/") && !path.contains("..") && !path.contains(":"))
        val dto = retry { api.page(path, page.coerceAtLeast(1), keyword) }
        check(dto.status == "success") { "Nguồn phim tạm thời không khả dụng" }
        FilmPage(dto.items.orEmpty().mapNotNull { it.toFilm() }.distinctBy { it.slug },
            dto.paginate?.page ?: page, dto.paginate?.totalPages ?: page)
    }
    override suspend fun detail(slug: String): Film = details.get(slug) {
        val dto = retry { api.detail(slug) }
        check(dto.status == "success") { "Không tìm thấy phim" }
        dto.movie?.toFilm() ?: error("Thông tin phim không hợp lệ")
    }
    override fun favorites() = dao.favorites().map { rows -> rows.mapNotNull { decode(it.filmJson) } }
    override fun history() = dao.history().map { rows -> rows.mapNotNull { it.toRecord() } }
    override suspend fun toggleFavorite(film: Film) = favoriteLock.withLock {
        if (dao.isFavorite(film.slug)) dao.deleteFavorite(film.slug)
        else dao.favorite(FavoriteEntity(film.slug, gson.toJson(film.copy(servers = emptyList())), System.currentTimeMillis()))
    }
    override suspend fun saveProgress(record: WatchRecord) {
        dao.history(HistoryEntity(record.film.slug, gson.toJson(record.film.copy(servers = emptyList())), record.server,
            record.episodeSlug, record.episodeName, record.position.coerceAtLeast(0), record.duration.coerceAtLeast(0), record.lastWatched))
        dao.pruneHistory()
    }
    override suspend fun progress(slug: String) = dao.progress(slug)?.toRecord()
    override suspend fun clearHistory() = dao.clearHistory()
    override suspend fun removeHistory(slug: String) = dao.deleteHistory(slug)
    override suspend fun source(slug: String, server: String, episode: String) = dao.source(slug, server, episode)
    override suspend fun saveSource(slug: String, server: String, episode: String, url: String) {
        require(isDirectMediaUrl(url)) { "Cần liên kết HTTPS trực tiếp .m3u8, .mp4, .mpd hoặc .webm" }
        dao.source(SourceEntity(slug, server, episode, url.trim()))
    }
    private fun decode(json: String): Film? = runCatching { gson.fromJson(json, Film::class.java) }.getOrNull()
    private fun HistoryEntity.toRecord() = decode(filmJson)?.let { WatchRecord(it, server, episodeSlug, episodeName, position, duration, lastWatched) }
}

internal suspend fun <T> retry(block: suspend () -> T): T {
    var last: Exception? = null
    repeat(3) { attempt ->
        try { return block() }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) {
            if (e !is IOException && (e !is HttpException || e.code() !in listOf(429, 500, 502, 503, 504))) throw e
            last = e
            if (attempt < 2) delay(350L * (attempt + 1))
        }
    }
    throw last!!
}
