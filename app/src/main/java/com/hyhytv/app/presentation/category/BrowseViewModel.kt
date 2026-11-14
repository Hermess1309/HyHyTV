package com.hyhytv.app.presentation.category

import androidx.lifecycle.*
import com.hyhytv.app.core.common.userMessage
import com.hyhytv.app.domain.model.Film
import com.hyhytv.app.domain.repository.FilmRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import javax.inject.Inject

data class BrowseState(val films: List<Film> = emptyList(), val loading: Boolean = false, val page: Int = 0,
    val totalPages: Int = 1, val error: String? = null, val query: String = "")

@HiltViewModel
class BrowseViewModel @Inject constructor(private val repository: FilmRepository, savedState: SavedStateHandle) : ViewModel() {
    private val mode = savedState.get<String>("mode") ?: "series"
    private var path = when (mode) {
        "movies" -> "films/danh-sach/phim-le"
        "animation" -> "films/the-loai/hoat-hinh"
        "search" -> "films/search"
        else -> com.hyhytv.app.domain.model.Catalog.shelves.firstOrNull { it.key == mode }?.path ?: "films/danh-sach/phim-bo"
    }
    private val _state = MutableStateFlow(BrowseState())
    val state = _state.asStateFlow()
    private var job: Job? = null
    private var generation = 0
    init { if (mode != "search") loadMore() }
    fun search(query: String) {
        generation++
        job?.cancel()
        val text = query.take(100)
        _state.value = BrowseState(query = text)
        if (text.isBlank()) return
        val version = generation
        job = viewModelScope.launch { delay(450); load(1, version) }
    }
    fun filter(newPath: String) {
        if (path == newPath) return
        generation++; job?.cancel(); path = newPath
        _state.value = BrowseState()
        loadMore()
    }
    fun loadMore() {
        val state = _state.value
        if (state.loading || state.page >= state.totalPages || (mode == "search" && state.query.isBlank())) return
        val version = generation
        job = viewModelScope.launch { load(state.page + 1, version) }
    }
    private suspend fun load(page: Int, version: Int) {
        _state.update { it.copy(loading = true, error = null) }
        try {
            val result = repository.page(path, page, _state.value.query.takeIf { mode == "search" })
            if (version == generation) _state.update {
                it.copy(films = (if (page == 1) result.films else it.films + result.films).distinctBy(Film::slug).takeLast(300),
                    loading = false, page = result.page, totalPages = result.totalPages)
            }
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { if (version == generation) _state.update { it.copy(loading = false, error = e.userMessage()) } }
    }
}
