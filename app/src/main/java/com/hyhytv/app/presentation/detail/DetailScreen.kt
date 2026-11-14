package com.hyhytv.app.presentation.detail

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.*
import androidx.lifecycle.compose.*
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import com.hyhytv.app.core.common.UiState
import com.hyhytv.app.core.theme.*
import com.hyhytv.app.domain.model.*
import com.hyhytv.app.presentation.common.*
import kotlinx.coroutines.launch

@Composable fun DetailScreen(onBack: () -> Unit, onPlay: (String, Int, Int) -> Unit, viewModel: DetailViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val favorite by viewModel.favorite.collectAsStateWithLifecycle()
    val progress by viewModel.progress.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) viewModel.refreshProgress() }
        lifecycle.lifecycle.addObserver(observer)
        onDispose { lifecycle.lifecycle.removeObserver(observer) }
    }
    when (val current = state) {
        UiState.Loading -> LoadingPanel()
        is UiState.Error -> StatusPanel("Không thể mở phim", current.message, "Thử lại", { viewModel.refresh() })
        is UiState.Ready -> {
            val film = current.value
            var server by rememberSaveable(film.slug) { mutableIntStateOf(0) }
            val listState = rememberLazyListState()
            val scope = rememberCoroutineScope()
            val first = remember { FocusRequester() }
            fun play() {
                val record = progress
                val s = film.servers.indexOfFirst { it.name == record?.server }.takeIf { it >= 0 } ?: server
                val e = film.servers.getOrNull(s)?.episodes?.indexOfFirst { it.slug == record?.episodeSlug }?.takeIf { it >= 0 } ?: 0
                onPlay(film.slug, s, e)
            }
            Box(Modifier.fillMaxSize()) {
                AsyncImage(film.backdrop.ifBlank { film.poster }, null, Modifier.fillMaxWidth().height(440.dp), contentScale = ContentScale.Crop)
                Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Background, Background.copy(alpha = .86f), Background.copy(alpha = .4f)))))
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Background), endY = 1100f)))
                LazyColumn(state = listState, contentPadding = PaddingValues(start = 42.dp, end = 42.dp, top = 20.dp, bottom = 38.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    item(key = "back") { TvAction("‹  Quay lại", onBack) }
                    item(key = "identity") {
                        Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                            AsyncImage(film.poster, film.name, Modifier.width(143.dp).height(210.dp).background(Panel), contentScale = ContentScale.Crop)
                            Column(Modifier.widthIn(max = 680.dp)) {
                                Text("HYHYTV  /  KHÁM PHÁ", fontSize = 10.sp, letterSpacing = 2.sp, color = Accent)
                                Text(film.name, Modifier.padding(top = 10.dp), fontSize = 33.sp, lineHeight = 38.sp, fontWeight = FontWeight.Black)
                                Text(film.originalName, Modifier.padding(top = 5.dp), color = Muted, fontSize = 15.sp)
                                Text(listOf(film.year, film.quality, film.language, film.duration).filter(String::isNotBlank).joinToString("   ·   "), Modifier.padding(top = 14.dp), fontSize = 12.sp)
                                Text((film.genres + film.countries).joinToString("  ·  "), Modifier.padding(top = 9.dp), fontSize = 12.sp, color = Muted)
                                Row(Modifier.padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    TvAction(if (progress != null && progress?.completed == false) "▶  Tiếp tục · Tập ${progress?.episodeName}" else "▶  Xem ngay",
                                        ::play, Modifier.focusRequester(first), primary = true, enabled = film.servers.any { it.episodes.isNotEmpty() })
                                    TvAction(if (favorite) "✓  Đã yêu thích" else "+  Yêu thích", { viewModel.toggleFavorite() })
                                    TvAction("Chọn tập ↓", { scope.launch { listState.animateScrollToItem(4) } }, enabled = film.servers.isNotEmpty())
                                }
                                message?.let { Text(it, color = Accent, fontSize = 12.sp) }
                            }
                        }
                    }
                    item(key = "synopsis") {
                        Text(film.description.ifBlank { "Chưa có mô tả." }, fontSize = 14.sp, color = Color(0xFFCFD1DC), lineHeight = 23.sp, modifier = Modifier.widthIn(max = 850.dp))
                    }
                    item(key = "credits") {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (film.director.isNotBlank()) Text("Đạo diễn   ${film.director}", color = Muted, fontSize = 12.sp)
                            if (film.casts.isNotBlank()) Text("Diễn viên   ${film.casts}", color = Muted, fontSize = 12.sp)
                            progress?.let { record -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                                Text("Lần xem gần nhất · Tập ${record.episodeName} · ${record.position / 60000} phút", color = Muted, fontSize = 12.sp)
                                TvAction("Xóa tiến độ", { viewModel.forgetProgress() })
                            } }
                        }
                    }
                    item(key = "servers") {
                        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            Text("Tập phim", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            if (film.servers.isEmpty()) Text("Nguồn phim chưa cung cấp tập phát.", color = Muted)
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                itemsIndexed(film.servers, key = { i, s -> "$i-${s.name}" }) { index, s ->
                                    TvAction(s.name, { server = index }, primary = index == server)
                                }
                            }
                        }
                    }
                    items(film.servers.getOrNull(server)?.episodes.orEmpty().chunked(7), key = { it.first().slug }) { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            row.forEach { episode ->
                                TvAction("Tập ${episode.name}", { onPlay(film.slug, server, film.servers[server].episodes.indexOf(episode)) },
                                    primary = episode.slug == progress?.episodeSlug && film.servers[server].name == progress?.server)
                            }
                        }
                    }
                }
            }
            LaunchedEffect(film.slug) { withFrameNanos { }; if (film.servers.any { it.episodes.isNotEmpty() }) first.requestFocus() }
        }
    }
}
