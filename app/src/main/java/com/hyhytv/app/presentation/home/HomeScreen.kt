package com.hyhytv.app.presentation.home

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import com.hyhytv.app.core.theme.*
import com.hyhytv.app.domain.model.*
import com.hyhytv.app.presentation.common.*
import kotlinx.coroutines.delay

@Composable fun HomeScreen(onFilm: (Film) -> Unit, onPlay: (Film) -> Unit, onBrowse: (String) -> Unit,
    reducedMotion: Boolean, viewModel: HomeViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()
    var focusedRow by rememberSaveable { mutableStateOf("") }
    var focusedSlug by rememberSaveable { mutableStateOf("") }
    var heroAction by rememberSaveable { mutableIntStateOf(0) }
    val returningSlug = remember { focusedSlug }
    val returningRow = remember { focusedRow }
    val listState = rememberLazyListState()
    val featured = state.featured.ifEmpty { state.rows.firstOrNull()?.second.orEmpty().take(5) }
    val continueWatching = history.filterNot { it.completed }
    var bannerIndex by remember { mutableIntStateOf(0) }
    var heroFocused by remember { mutableStateOf(false) }
    LaunchedEffect(featured, heroFocused, reducedMotion) {
        if (!reducedMotion && !heroFocused && featured.size > 1) while (true) {
            delay(10_000); bannerIndex = (bannerIndex + 1) % featured.size
        }
    }
    if (state.loading && state.rows.isEmpty()) { LoadingPanel(); return }
    if (state.rows.isEmpty() && state.errors.isNotEmpty()) {
        StatusPanel("Chưa thể tải kho phim", state.errors.first(), "Thử lại", viewModel::refresh); return
    }
    LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 36.dp)) {
        if (featured.isNotEmpty()) item(key = "hero") {
            Hero(featured[bannerIndex % featured.size], onFilm, onPlay,
                restore = returningSlug.isBlank(), restoreAction = heroAction, reducedMotion = reducedMotion,
                onFocused = { heroFocused = it }, onActionFocus = { action -> heroAction = action; focusedRow = "hero"; focusedSlug = "" })
        }
        if (continueWatching.isNotEmpty()) item(key = "continue") {
            FilmRow("Tiếp tục xem", continueWatching.map { it.film }, onPlay, "continue",
                returningSlug.takeIf { returningRow == "continue" }, { row, slug -> focusedRow = row; focusedSlug = slug },
                reducedMotion, continueWatching.associate { it.film.slug to if (it.duration > 0) it.position.toFloat() / it.duration else 0f })
        }
        if (favorites.isNotEmpty()) item(key = "favorites") {
            FilmRow("Danh sách của tôi", favorites, onFilm, "favorites", returningSlug.takeIf { returningRow == "favorites" },
                { row, slug -> focusedRow = row; focusedSlug = slug }, reducedMotion)
        }
        items(state.rows, key = { it.first.key }, contentType = { "shelf" }) { (shelf, films) ->
            FilmRow(shelf.title, films, onFilm, shelf.key, returningSlug.takeIf { returningRow == shelf.key },
                { row, slug -> focusedRow = row; focusedSlug = slug }, reducedMotion,
                onMore = { onBrowse(shelf.key) })
        }
        if (state.errors.isNotEmpty()) item(key = "errors") {
            Column(Modifier.padding(horizontal = 42.dp, vertical = 15.dp)) {
                Text("Một số hàng phim chưa tải được", color = Muted, fontSize = 13.sp)
                TvAction("Tải lại", viewModel::refresh, Modifier.padding(top = 12.dp))
            }
        }
        item(key = "footer") { Text("HyHyTv   /   Mỗi câu chuyện, một thế giới.", Modifier.padding(start = 42.dp, top = 30.dp), color = Muted, fontSize = 11.sp) }
    }
}

@Composable private fun Hero(film: Film, onFilm: (Film) -> Unit, onPlay: (Film) -> Unit,
    restore: Boolean, restoreAction: Int, reducedMotion: Boolean, onFocused: (Boolean) -> Unit, onActionFocus: (Int) -> Unit) {
    val first = remember { FocusRequester() }
    val second = remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }
    val parallax = if (reducedMotion || !focused) 0f else 8f
    Box(Modifier.fillMaxWidth().height(315.dp).onFocusChanged { focused = it.hasFocus; onFocused(it.hasFocus) }.focusGroup()) {
        Crossfade(film, animationSpec = tween(if (reducedMotion) 0 else 700), label = "hero") { current ->
            AsyncImage(current.backdrop.ifBlank { current.poster }, null, Modifier.fillMaxSize().graphicsLayer { translationX = parallax }, contentScale = ContentScale.Crop)
        }
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Background, Background.copy(alpha = .88f), Color.Transparent))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Background))))
        Column(Modifier.padding(start = 42.dp, top = 24.dp).width(485.dp)) {
            Text("KHÁM PHÁ CÂU CHUYỆN TIẾP THEO", fontSize = 10.sp, letterSpacing = 2.sp, color = Accent, fontWeight = FontWeight.Bold)
            Text(film.name, Modifier.padding(top = 13.dp), fontSize = 34.sp, lineHeight = 39.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Black)
            Text(listOf(film.year, film.quality, film.countries.joinToString(), film.genres.take(2).joinToString()).filter(String::isNotBlank).joinToString("   ·   "),
                Modifier.padding(top = 11.dp), color = Muted, fontSize = 11.sp, maxLines = 1)
            Text(film.description, Modifier.padding(top = 13.dp).width(410.dp), color = Color(0xFFE0E1E7),
                fontSize = 13.sp, lineHeight = 20.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            Row(Modifier.padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                TvAction("▶  Xem ngay", { onPlay(film) }, Modifier.focusRequester(first).onFocusChanged { if (it.isFocused) onActionFocus(0) }, primary = true)
                TvAction("ⓘ  Chi tiết", { onFilm(film) }, Modifier.focusRequester(second).onFocusChanged { if (it.isFocused) onActionFocus(1) })
            }
        }
    }
    LaunchedEffect(Unit) { if (restore) { withFrameNanos { }; runCatching { (if (restoreAction == 1) second else first).requestFocus() } } }
}
