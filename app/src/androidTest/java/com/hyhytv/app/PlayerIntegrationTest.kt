@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
package com.hyhytv.app

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelStore
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.hyhytv.app.data.local.*
import com.hyhytv.app.di.AppModule
import com.hyhytv.app.presentation.player.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.Rule
import org.junit.runner.RunWith

/** Real NguonC metadata + a separate public ExoPlayer test asset. Never inserts test movies into the catalog. */
@RunWith(AndroidJUnit4::class)
class PlayerIntegrationTest {
    @get:Rule val compose = createComposeRule()
    @Test fun nativePlayerPlaysSeeksPausesAndPersistsPosition() = runBlocking {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val database = AppModule.database(context)
        val repository = AppModule.repository(com.hyhytv.app.data.repository.NguonCRepository(AppModule.api(AppModule.client(context), AppModule.gson()), database.library(), AppModule.gson()))
        val film = repository.detail("hoa-thien-cot")
        val server = film.servers.first()
        val episode = server.episodes.first()
        val previousSource = repository.source(film.slug, server.name, episode.slug)
        repository.saveSource(film.slug, server.name, episode.slug, "https://storage.googleapis.com/exoplayer-test-media-0/BigBuckBunny_320x180.mp4")
        lateinit var viewModel: PlayerViewModel
        val store = ViewModelStore()
        val visible = mutableStateOf(true)
        instrumentation.runOnMainSync {
            viewModel = PlayerViewModel(context, repository, Preferences(context), ProgressWriter(repository), SavedStateHandle(mapOf("slug" to film.slug, "server" to 0, "episode" to 0)))
            store.put("playback", viewModel)
        }
        compose.setContent { if (visible.value) com.hyhytv.app.core.theme.HyHyTheme { PlayerScreen({}, viewModel) } }
        try {
            withTimeout(45_000) { while (!viewModel.state.value.playing) { delay(200); viewModel.state.value.error?.let { error(it) } } }
            assertTrue(viewModel.state.value.duration > 0)
            instrumentation.runOnMainSync { viewModel.seek(30_000) }
            delay(1500)
            instrumentation.runOnMainSync { viewModel.pauseAndSave() }
            withTimeout(10_000) { while ((repository.progress(film.slug)?.position ?: 0) < 25_000) delay(100) }
            instrumentation.runOnMainSync { assertFalse(viewModel.player.isPlaying); assertTrue(viewModel.player.currentPosition >= 25_000) }
        } finally {
            compose.runOnIdle { visible.value = false }
            instrumentation.runOnMainSync { store.clear() }
            delay(500)
            database.library().deleteHistory(film.slug)
            if (previousSource != null) repository.saveSource(film.slug, server.name, episode.slug, previousSource)
            else database.library().deleteSource(film.slug, server.name, episode.slug)
            database.close()
        }
    }
}
