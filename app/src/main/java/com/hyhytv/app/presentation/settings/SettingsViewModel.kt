package com.hyhytv.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hyhytv.app.data.local.*
import com.hyhytv.app.domain.repository.FilmRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(private val prefs: Preferences, private val repository: FilmRepository) : ViewModel() {
    val settings = prefs.settings.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), Settings())
    val favorites = repository.favorites().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val history = repository.history().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    fun autoNext(value: Boolean) = viewModelScope.launch { prefs.autoNext(value) }
    fun reducedMotion(value: Boolean) = viewModelScope.launch { prefs.reducedMotion(value) }
    fun clearHistory() = viewModelScope.launch { repository.clearHistory() }
}
