package com.hyhytv.app.presentation.common

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import androidx.tv.material3.*
import coil.compose.AsyncImage
import com.hyhytv.app.core.theme.*
import com.hyhytv.app.domain.model.Film
import kotlinx.coroutines.delay

@Composable fun Brand(modifier: Modifier = Modifier, size: Int = 25) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(3.dp).height(25.dp).background(Accent))
        Spacer(Modifier.width(8.dp))
        Text("HyHy", color = Color.White, fontSize = size.sp, fontWeight = FontWeight.Black, letterSpacing = (-1).sp)
        Text("Tv", color = Accent, fontSize = size.sp, fontWeight = FontWeight.Black, letterSpacing = (-1).sp)
    }
}

@Composable fun TvAction(text: String, onClick: () -> Unit, modifier: Modifier = Modifier,
    primary: Boolean = false, enabled: Boolean = true) {
    Button(onClick = onClick, modifier = modifier, enabled = enabled,
        colors = ButtonDefaults.colors(containerColor = if (primary) Accent else Panel,
            contentColor = Color.White, focusedContainerColor = Color.White, focusedContentColor = Background),
        shape = ButtonDefaults.shape(shape = RoundedCornerShape(7.dp)),
        scale = ButtonDefaults.scale(focusedScale = 1.035f),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 11.dp)) {
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable fun StatusPanel(title: String, message: String = "", action: String? = null, onAction: () -> Unit = {}) {
    Column(Modifier.fillMaxSize().padding(50.dp), verticalArrangement = Arrangement.Center) {
        Text(title, fontSize = 27.sp, fontWeight = FontWeight.Bold)
        if (message.isNotBlank()) Text(message, Modifier.padding(top = 12.dp).widthIn(max = 620.dp), color = Muted, fontSize = 15.sp)
        action?.let { TvAction(it, onAction, Modifier.padding(top = 22.dp)) }
    }
}

@Composable fun LoadingPanel() {
    var dots by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { while (true) { delay(450); dots = (dots + 1) % 4 } }
    StatusPanel("Đang tải${"·".repeat(dots)}", "Đang kết nối kho phim")
}

@Composable fun FilmCard(film: Film, onClick: () -> Unit, modifier: Modifier = Modifier,
    onFocus: () -> Unit = {}, progress: Float? = null, reducedMotion: Boolean = false) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused && !reducedMotion) 1.055f else 1f, tween(if (reducedMotion) 0 else 160), label = "posterScale")
    Surface(onClick = onClick, modifier = modifier.width(138.dp).onFocusChanged {
        focused = it.isFocused; if (it.isFocused) onFocus()
    }.graphicsLayer { scaleX = scale; scaleY = scale },
        shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(containerColor = Panel, focusedContainerColor = Panel),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f),
        border = ClickableSurfaceDefaults.border(focusedBorder = Border(BorderStroke(2.dp, Accent), shape = RoundedCornerShape(8.dp)))) {
        Column {
            Box(Modifier.fillMaxWidth().height(174.dp).background(Panel)) {
                AsyncImage(film.poster.ifBlank { film.backdrop }, film.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = .5f)))))
                if (film.quality.isNotBlank()) Text(film.quality, Modifier.align(Alignment.TopEnd).padding(7.dp)
                    .background(Background.copy(alpha = .85f), RoundedCornerShape(3.dp)).padding(horizontal = 5.dp, vertical = 2.dp), fontSize = 9.sp)
                if (progress != null) Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(3.dp).background(Color.DarkGray)) {
                    Box(Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).fillMaxHeight().background(Accent))
                }
            }
            Column(Modifier.padding(horizontal = 9.dp, vertical = 9.dp)) {
                Text(film.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Text(listOf(film.year, film.currentEpisode).filter(String::isNotBlank).joinToString("  ·  "), maxLines = 1,
                    overflow = TextOverflow.Ellipsis, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

/** A native focus group with per-row slug memory. Stable keys keep focus attached across database emissions. */
@OptIn(ExperimentalComposeUiApi::class)
@Composable fun FilmRow(title: String, films: List<Film>, onFilm: (Film) -> Unit, rowKey: String,
    restoreSlug: String?, onFocused: (String, String) -> Unit, reducedMotion: Boolean = false,
    progress: Map<String, Float> = emptyMap(), onMore: (() -> Unit)? = null) {
    var rememberedSlug by rememberSaveable(rowKey) { mutableStateOf<String?>(null) }
    val rowState = rememberLazyListState()
    val requesters = remember(films.map { it.slug }) { films.associate { it.slug to FocusRequester() } }
    val target = rememberedSlug?.takeIf { requesters.containsKey(it) } ?: films.firstOrNull()?.slug
    Column {
        Row(Modifier.fillMaxWidth().padding(start = 42.dp, end = 42.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (onMore != null) TvAction("Xem tất cả  ›", onMore)
        }
        LazyRow(state = rowState, horizontalArrangement = Arrangement.spacedBy(15.dp),
            contentPadding = PaddingValues(horizontal = 42.dp, vertical = 16.dp),
            modifier = Modifier.focusProperties {
                onEnter = { if (rowState.layoutInfo.visibleItemsInfo.any { it.key == target }) requesters[target]?.requestFocus() }
            }.focusGroup()) {
            items(films, key = { it.slug }, contentType = { "poster" }) { film ->
                val requester = requesters.getValue(film.slug)
                FilmCard(film, { onFilm(film) }, Modifier.focusRequester(requester),
                    onFocus = { rememberedSlug = film.slug; onFocused(rowKey, film.slug) },
                    progress = progress[film.slug], reducedMotion = reducedMotion)
                if (restoreSlug == film.slug) LaunchedEffect(Unit) {
                    withFrameNanos { }; delay(80)
                    runCatching { requester.requestFocus() }
                }
            }
        }
    }
}
