package com.hyhytv.app.domain.repository

import com.hyhytv.app.domain.model.*
import kotlinx.coroutines.flow.Flow

interface FilmRepository {
    suspend fun page(path: String, page: Int = 1, keyword: String? = null): FilmPage
    suspend fun detail(slug: String): Film
    fun favorites(): Flow<List<Film>>
    fun history(): Flow<List<WatchRecord>>
    suspend fun toggleFavorite(film: Film)
    suspend fun saveProgress(record: WatchRecord)
    suspend fun progress(slug: String): WatchRecord?
    suspend fun clearHistory()
    suspend fun removeHistory(slug: String)
    suspend fun source(slug: String, server: String, episode: String): String?
    suspend fun saveSource(slug: String, server: String, episode: String, url: String)
}
