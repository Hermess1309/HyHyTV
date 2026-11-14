@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
package com.hyhytv.app.presentation.player

import android.view.KeyEvent as AndroidKeyEvent
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.*
import androidx.lifecycle.compose.*
import androidx.media3.common.*
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Text
import com.hyhytv.app.core.theme.*
import com.hyhytv.app.presentation.category.TvTextInput
import com.hyhytv.app.presentation.common.*
import kotlinx.coroutines.delay

@Composable fun PlayerScreen(onBack: () -> Unit, viewModel: PlayerViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current
    val context = LocalContext.current
    val activity = context as? android.app.Activity
    var controls by remember { mutableStateOf(true) }
    var panel by rememberSaveable { mutableStateOf("") }
    var interaction by remember { mutableLongStateOf(0L) }
    val rootFocus = remember { FocusRequester() }
    val playFocus = remember { FocusRequester() }
    var playerView by remember { mutableStateOf<PlayerView?>(null) }
    DisposableEffect(lifecycle) {
        viewModel.onStart()
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val observer = LifecycleEventObserver { _, event -> when (event) {
            Lifecycle.Event.ON_START -> viewModel.onStart()
            Lifecycle.Event.ON_STOP -> viewModel.pauseAndSave()
            else -> Unit
        } }
        lifecycle.lifecycle.addObserver(observer)
        onDispose {
            viewModel.pauseAndSave(); playerView?.player = null
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            lifecycle.lifecycle.removeObserver(observer)
        }
    }
    LaunchedEffect(controls, interaction, state.playing, panel) {
        if (controls && state.playing && panel.isEmpty()) {
            delay(5500); controls = false; rootFocus.requestFocus()
        }
    }
    LaunchedEffect(controls, state.loading, state.missingSource, panel) {
        if (controls && !state.loading && !state.missingSource && panel.isEmpty()) { withFrameNanos { }; runCatching { playFocus.requestFocus() } }
    }
    BackHandler {
        if (panel.isNotEmpty()) panel = "" else { viewModel.pauseAndSave(); onBack() }
    }
    Box(Modifier.fillMaxSize().background(Color.Black).onPreviewKeyEvent { event ->
        val key = event.nativeKeyEvent.keyCode
        if (event.type != KeyEventType.KeyDown || panel.isNotEmpty() || state.missingSource) return@onPreviewKeyEvent false
        interaction++
        when (key) {
            AndroidKeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> { viewModel.togglePlay(); true }
            AndroidKeyEvent.KEYCODE_MEDIA_PLAY -> { viewModel.player.play(); true }
            AndroidKeyEvent.KEYCODE_MEDIA_PAUSE -> { viewModel.player.pause(); true }
            AndroidKeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { viewModel.seek(10_000); true }
            AndroidKeyEvent.KEYCODE_MEDIA_REWIND -> { viewModel.seek(-10_000); true }
            AndroidKeyEvent.KEYCODE_DPAD_LEFT, AndroidKeyEvent.KEYCODE_DPAD_RIGHT -> {
                if (!controls) { viewModel.seek(if (key == AndroidKeyEvent.KEYCODE_DPAD_LEFT) -10_000 else 10_000); true } else false
            }
            AndroidKeyEvent.KEYCODE_DPAD_UP, AndroidKeyEvent.KEYCODE_DPAD_DOWN -> { if (!controls) { controls = true; true } else false }
            AndroidKeyEvent.KEYCODE_DPAD_CENTER, AndroidKeyEvent.KEYCODE_ENTER -> { if (!controls) { controls = true; true } else false }
            else -> false
        }
    }.focusRequester(rootFocus).focusable()) {
        AndroidView(factory = { ctx -> PlayerView(ctx).apply {
            useController = false; player = viewModel.player; keepScreenOn = true
            isFocusable = false; isFocusableInTouchMode = false
            playerView = this
        } }, modifier = Modifier.fillMaxSize(), update = { it.player = viewModel.player })
        when {
            state.loading -> LoadingPanel()
            (state.missingSource && panel.isEmpty()) || panel == "source" -> SourcePanel(state.error, { viewModel.provideSource(it); panel = "" }, {
                panel = ""; if (state.missingSource) onBack()
            }, { panel = "servers" }, { panel = "episodes" })
            panel.isNotEmpty() -> {
                Box(Modifier.fillMaxSize().background(Background.copy(alpha = .97f))) {
                    LazyColumn(contentPadding = PaddingValues(40.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        item { TvAction("‹  Đóng", { panel = "" }) }
                        when (panel) {
                            "episodes" -> {
                                item { Text("Chọn tập", fontSize = 25.sp, fontWeight = FontWeight.Bold) }
                                itemsIndexed(state.currentServer?.episodes.orEmpty(), key = { _, e -> e.slug }) { index, episode ->
                                    TvAction("Tập ${episode.name}", { viewModel.selectEpisode(state.server, index); panel = "" }, primary = index == state.episode)
                                }
                            }
                            "servers" -> {
                                item { Text("Nguồn phát", fontSize = 25.sp, fontWeight = FontWeight.Bold) }
                                itemsIndexed(state.film?.servers.orEmpty(), key = { i, s -> "$i-${s.name}" }) { index, server ->
                                    TvAction(server.name, { viewModel.switchServer(index); panel = "" }, primary = index == state.server)
                                }
                                item { TvAction("Dùng liên kết video riêng", { panel = "source" }) }
                            }
                            "tracks" -> {
                                item { Text("Chất lượng & phụ đề", fontSize = 25.sp, fontWeight = FontWeight.Bold) }
                                item { TvAction("Chất lượng tự động", {
                                    viewModel.player.trackSelectionParameters = viewModel.player.trackSelectionParameters.buildUpon().clearOverridesOfType(C.TRACK_TYPE_VIDEO).build(); panel = ""
                                }) }
                                item { TvAction("Tắt phụ đề", {
                                    viewModel.player.trackSelectionParameters = viewModel.player.trackSelectionParameters.buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build(); panel = ""
                                }) }
                                val groups = viewModel.player.currentTracks.groups.filter { it.type == C.TRACK_TYPE_VIDEO || it.type == C.TRACK_TYPE_TEXT }
                                groups.forEachIndexed { groupIndex, group ->
                                    for (track in 0 until group.length) if (group.isTrackSupported(track)) {
                                        val format = group.getTrackFormat(track)
                                        val label = if (group.type == C.TRACK_TYPE_VIDEO) "${format.height.takeIf { it > 0 } ?: "?"}p · ${format.bitrate.coerceAtLeast(0) / 1000} kbps"
                                            else "Phụ đề · ${format.label ?: format.language ?: "${track + 1}"}"
                                        item(key = "track-$groupIndex-$track") {
                                            TvAction(label, {
                                                viewModel.player.trackSelectionParameters = viewModel.player.trackSelectionParameters.buildUpon()
                                                    .setTrackTypeDisabled(group.type, false).setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track)).build(); panel = ""
                                            }, primary = group.isTrackSelected(track))
                                        }
                                    }
                                }
                                if (groups.none { it.type == C.TRACK_TYPE_TEXT }) item { Text("Nguồn video không cung cấp phụ đề có thể chọn.", color = Muted, fontSize = 14.sp) }
                            }
                        }
                    }
                }
            }
            state.error != null -> Column(Modifier.fillMaxSize().background(Background.copy(alpha = .9f)).padding(42.dp), verticalArrangement = Arrangement.Center) {
                Text("Phát video bị gián đoạn", fontSize = 27.sp, fontWeight = FontWeight.Bold)
                Text(state.error.orEmpty(), Modifier.padding(vertical = 18.dp), color = Muted)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TvAction("Thử lại", viewModel::retry, Modifier.focusRequester(playFocus), primary = true)
                    TvAction("Đổi nguồn", { panel = "servers" }); TvAction("Quay lại", onBack)
                }
            }
            controls -> {
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = .4f), Color.Transparent, Color.Black.copy(alpha = .95f)))))
                Column(Modifier.align(Alignment.TopStart).padding(36.dp)) {
                    Text(state.film?.name.orEmpty(), fontSize = 25.sp, fontWeight = FontWeight.Bold)
                    Text("Tập ${state.currentEpisode?.name.orEmpty()}  ·  ${state.currentServer?.name.orEmpty()}", Modifier.padding(top = 8.dp), color = Muted, fontSize = 12.sp)
                }
                Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(36.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(formatTime(state.position), fontSize = 12.sp); Text(formatTime(state.duration), fontSize = 12.sp)
                    }
                    Box(Modifier.fillMaxWidth().height(4.dp).background(Color.DarkGray)) {
                        val fraction = if (state.duration > 0) state.position.toFloat() / state.duration else 0f
                        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxHeight().background(Accent))
                    }
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        item { TvAction(if (state.playing) "Ⅱ  Tạm dừng" else "▶  Phát", viewModel::togglePlay, Modifier.focusRequester(playFocus), primary = true) }
                        item { TvAction("−10s", { viewModel.seek(-10_000) }) }
                        item { TvAction("+10s", { viewModel.seek(10_000) }) }
                        item { TvAction("Tập trước", viewModel::previous, enabled = state.episode > 0) }
                        item { TvAction("Tập tiếp", viewModel::next, enabled = state.episode + 1 < state.currentServer?.episodes.orEmpty().size) }
                        item { TvAction("Tập phim", { panel = "episodes" }) }
                        item { TvAction("Nguồn phát", { panel = "servers" }) }
                        item { TvAction("Chất lượng / CC", { panel = "tracks" }) }
                    }
                    Text("← → Tua khi ẩn điều khiển   ·   OK Hiện / chọn   ·   BACK Thoát", color = Muted, fontSize = 10.sp)
                }
            }
        }
        if (state.buffering && !state.missingSource && panel.isEmpty()) Text("Đang tải video…", Modifier.align(Alignment.Center).background(Background).padding(16.dp), color = Color.White)
    }
    LaunchedEffect(Unit) { withFrameNanos { }; rootFocus.requestFocus() }
}

@Composable private fun SourcePanel(error: String?, onSource: (String) -> Unit, onBack: () -> Unit, onServers: () -> Unit, onEpisodes: () -> Unit) {
    var url by rememberSaveable { mutableStateOf("") }
    val first = remember { FocusRequester() }
    val submitFocus = remember { FocusRequester() }
    Column(Modifier.fillMaxSize().background(Background).padding(42.dp), verticalArrangement = Arrangement.Center) {
        Text("Nguồn này chưa phát trực tiếp", fontSize = 27.sp, fontWeight = FontWeight.Bold)
        Text("Nhà cung cấp chỉ có trình phát nhúng cho tập này. Bạn có thể dùng liên kết video HTTPS mà bạn có quyền truy cập.",
            Modifier.padding(top = 15.dp, bottom = 24.dp).widthIn(max = 680.dp), color = Muted, fontSize = 14.sp, lineHeight = 22.sp)
        TvTextInput(url, { url = it }, "https://…/video.m3u8 hoặc video.mp4", Modifier.widthIn(max = 740.dp).fillMaxWidth().focusRequester(first), onSubmit = { submitFocus.requestFocus() })
        error?.let { Text(it, Modifier.padding(top = 12.dp), color = Accent, fontSize = 12.sp) }
        Row(Modifier.padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TvAction("Lưu nguồn & phát", { onSource(url) }, Modifier.focusRequester(submitFocus), primary = true)
            TvAction("Nguồn khác", onServers)
            TvAction("Chọn tập", onEpisodes)
            TvAction("Quay lại", onBack)
        }
        Text("Liên kết được lưu riêng cho tập phim trên thiết bị này.", Modifier.padding(top = 16.dp), color = Muted, fontSize = 11.sp)
    }
    LaunchedEffect(Unit) { withFrameNanos { }; first.requestFocus() }
}
internal fun formatTime(ms: Long): String {
    val seconds = ms.coerceAtLeast(0) / 1000
    return if (seconds >= 3600) "%d:%02d:%02d".format(seconds / 3600, seconds / 60 % 60, seconds % 60) else "%02d:%02d".format(seconds / 60, seconds % 60)
}
