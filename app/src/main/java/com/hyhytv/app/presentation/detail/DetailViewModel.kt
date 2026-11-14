package com.hyhytv.app.presentation.detail

import androidx.lifecycle.*
import com.hyhytv.app.core.common.*
import com.hyhytv.app.domain.model.*
import com.hyhytv.app.domain.repository.FilmRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import javax.inject.Inject

@HiltViewModel
class DetailViewModel @Inject constructor(private val repository: FilmRepository, savedState: SavedStateHandle) : ViewModel() {
    private val slug = checkNotNull(savedState.get<String>("slug"))
    private val _state = MutableStateFlow<UiState<Film>>(UiState.Loading)
    val state = _state.asStateFlow()
    val favorite = repository.favorites().map { films -> films.any { it.slug == slug } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    private val _progress = MutableStateFlow<WatchRecord?>(null)
    val progress = _progress.asStateFlow()
    private val _message = MutableStateFlow<String?>(null)
    val message = _message.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _state.value = UiState.Loading
        try { _state.value = UiState.Ready(repository.detail(slug)); refreshProgress() }
        catch (e: CancellationException) { throw e }
        catch (e: Exception) { _state.value = UiState.Error(e.userMessage()) }
    }
    fun refreshProgress() = viewModelScope.launch { _progress.value = repository.progress(slug) }
    fun toggleFavorite() = viewModelScope.launch {
        try { (_state.value as? UiState.Ready)?.value?.let { repository.toggleFavorite(it) } }
        catch (e: Exception) { if (e is CancellationException) throw e; _message.value = e.userMessage() }
    }
    fun forgetProgress() = viewModelScope.launch { repository.removeHistory(slug); _progress.value = null }
}
