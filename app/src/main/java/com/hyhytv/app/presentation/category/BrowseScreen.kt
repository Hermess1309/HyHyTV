package com.hyhytv.app.presentation.category

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.*
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.Text
import com.hyhytv.app.core.theme.*
import com.hyhytv.app.domain.model.*
import com.hyhytv.app.presentation.common.*

@Composable fun BrowseScreen(mode: String, onFilm: (Film) -> Unit, reducedMotion: Boolean,
    viewModel: BrowseViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var selected by rememberSaveable { mutableStateOf(mode) }
    val title = when (mode) { "search" -> "Tìm câu chuyện của bạn"; "filters" -> "Khám phá"; else -> Catalog.shelves.firstOrNull { it.key == mode }?.title ?: "Phim bộ" }
    val gridState = rememberLazyGridState()
    var lastSlug by rememberSaveable { mutableStateOf("") }
    val restoreSlug = remember { lastSlug }
    val inputFocus = remember { FocusRequester() }
    Column(Modifier.fillMaxSize()) {
        Text(title, Modifier.padding(start = 42.dp, top = 20.dp, bottom = 18.dp), fontSize = 29.sp, fontWeight = FontWeight.Bold)
        if (mode == "search") {
            TvTextInput(state.query, viewModel::search, "Tên phim, tên gốc…", Modifier.padding(horizontal = 42.dp).width(570.dp).focusRequester(inputFocus))
            LaunchedEffect(Unit) { if (restoreSlug.isBlank()) { withFrameNanos { }; inputFocus.requestFocus() } }
        }
        if (mode == "filters") LazyRow(contentPadding = PaddingValues(horizontal = 42.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            items(Catalog.filters, key = { it.key }) { filter ->
                TvAction(filter.title, { selected = filter.key; lastSlug = ""; viewModel.filter(filter.path) }, primary = selected == filter.key)
            }
        }
        if (mode == "search" && state.query.isBlank()) {
            Text("Nhập bằng bàn phím TV, điện thoại hoặc giọng nói trên remote.", Modifier.padding(42.dp), color = Muted, fontSize = 14.sp)
        } else if (state.loading && state.films.isEmpty()) LoadingPanel()
        else if (state.error != null && state.films.isEmpty()) StatusPanel("Không tải được phim", state.error.orEmpty(), "Thử lại", viewModel::loadMore)
        else if (state.films.isEmpty()) StatusPanel("Chưa tìm thấy phim", "Thử từ khóa hoặc danh mục khác.")
        else LazyVerticalGrid(columns = GridCells.Adaptive(138.dp), state = gridState,
            modifier = Modifier.fillMaxSize().padding(top = 8.dp), contentPadding = PaddingValues(horizontal = 42.dp, vertical = 18.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            items(state.films, key = { it.slug }, contentType = { "poster" }) { film ->
                val requester = remember { FocusRequester() }
                FilmCard(film, { onFilm(film) }, Modifier.focusRequester(requester), { lastSlug = film.slug }, reducedMotion = reducedMotion)
                if (restoreSlug == film.slug) LaunchedEffect(Unit) { withFrameNanos { }; runCatching { requester.requestFocus() } }
            }
            item(span = { GridItemSpan(maxLineSpan) }, key = "pagination") {
                Column(Modifier.padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    state.error?.let { Text(it, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(bottom = 10.dp)) }
                    if (state.page < state.totalPages) TvAction(if (state.loading) "Đang tải…" else "Tải thêm  ·  ${state.page}/${state.totalPages}", viewModel::loadMore, enabled = !state.loading)
                    else Text("Bạn đã xem hết danh mục này", color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable fun TvTextInput(value: String, onValueChange: (String) -> Unit, hint: String, modifier: Modifier = Modifier, onSubmit: (() -> Unit)? = null) {
    var focused by remember { mutableStateOf(false) }
    val keyboard = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    val submit = { keyboard?.hide(); if (onSubmit != null) onSubmit() else { focusManager.moveFocus(FocusDirection.Down); Unit } }
    BasicTextField(value = value, onValueChange = onValueChange, singleLine = true,
        textStyle = TextStyle(color = Color.White, fontSize = 16.sp), cursorBrush = androidx.compose.ui.graphics.SolidColor(Accent),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { submit() }, onDone = { submit() }),
        modifier = modifier.onPreviewKeyEvent {
            if (it.type == KeyEventType.KeyDown && it.key == Key.DirectionDown) { submit(); true } else false
        }.onFocusChanged { focused = it.isFocused }
            .background(Panel, RoundedCornerShape(8.dp)).border(if (focused) 2.dp else 1.dp, if (focused) Accent else Color(0xFF393C48), RoundedCornerShape(8.dp))
            .padding(16.dp), decorationBox = { inner -> Box { if (value.isEmpty()) Text(hint, color = Muted, fontSize = 16.sp); inner() } })
}
