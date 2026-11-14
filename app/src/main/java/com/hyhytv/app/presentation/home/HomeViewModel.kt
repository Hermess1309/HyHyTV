package com.hyhytv.app.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyhytv.app.core.common.userMessage
import com.hyhytv.app.domain.model.*
import com.hyhytv.app.domain.repository.FilmRepository
import com.hyhytv.app.domain.usecase.LoadCatalog
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import javax.inject.Inject

data class HomeState(val loading: Boolean = true, val rows: List<Pair<Shelf, List<Film>>> = emptyList(), val errors: List<String> = emptyList(), val featured: List<Film> = emptyList())
@HiltViewModel
class HomeViewModel @Inject constructor(private val loadCatalog: LoadCatalog, private val repository: FilmRepository) : ViewModel() {
    private val _state = MutableStateFlow(HomeState())
    val state = _state.asStateFlow()
    val favorites = repository.favorites().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val history = repository.history().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    private var job: Job? = null
    init { refresh() }
    fun refresh() {
        if (job?.isActive == true) return
        job = viewModelScope.launch {
            _state.update { it.copy(loading = true) }
            val results = loadCatalog()
            _state.value = HomeState(false,
                results.mapNotNull { (shelf, result) -> result.getOrNull()?.films?.takeIf { it.isNotEmpty() }?.let { shelf to it } },
                results.mapNotNull { (shelf, result) -> result.exceptionOrNull()?.let { "${shelf.title}: ${it.userMessage()}" } })
            // Detail metadata enriches the hero without replacing any focused shelf items.
            val featured = _state.value.rows.firstOrNull()?.second.orEmpty().take(5)
            val detailed = supervisorScope { featured.map { film -> async {
                try { repository.detail(film.slug) }
                catch (e: CancellationException) { throw e }
                catch (_: Exception) { film }
            } }.awaitAll() }
            _state.update { it.copy(featured = detailed) }
        }
    }
}
