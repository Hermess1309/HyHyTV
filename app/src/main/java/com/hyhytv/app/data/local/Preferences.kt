package com.hyhytv.app.data.local

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.settings by preferencesDataStore("hyhytv")
data class Settings(val autoNext: Boolean = true, val reducedMotion: Boolean = false)
@Singleton
class Preferences @Inject constructor(@ApplicationContext private val context: Context) {
    private val autoNext = booleanPreferencesKey("auto_next")
    private val motion = booleanPreferencesKey("reduced_motion")
    val settings = context.settings.data.catch { if (it is IOException) emit(emptyPreferences()) else throw it }
        .map { Settings(it[autoNext] ?: true, it[motion] ?: false) }
    suspend fun autoNext(value: Boolean) { context.settings.edit { it[autoNext] = value } }
    suspend fun reducedMotion(value: Boolean) { context.settings.edit { it[motion] = value } }
}
