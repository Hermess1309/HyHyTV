package com.hyhytv.app.presentation.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.Text
import com.hyhytv.app.core.theme.*
import com.hyhytv.app.domain.model.Film
import com.hyhytv.app.presentation.common.*

@Composable fun SettingsScreen(onLibrary: (String) -> Unit, viewModel: SettingsViewModel = hiltViewModel()) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    var confirming by remember { mutableStateOf(false) }
    LazyColumn(contentPadding = PaddingValues(42.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        item { Brand(size = 36); Text("Rạp phim của bạn", Modifier.padding(top = 12.dp), color = Muted, fontSize = 16.sp) }
        item { Text("Thư viện", fontSize = 21.sp, fontWeight = FontWeight.Bold) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TvAction("♡  Yêu thích", { onLibrary("favorites") })
            TvAction("◷  Lịch sử xem", { onLibrary("history") })
        } }
        item { Text("Trải nghiệm xem", fontSize = 21.sp, fontWeight = FontWeight.Bold) }
        item { TvAction("Tự phát tập tiếp theo: ${if (settings.autoNext) "Bật" else "Tắt"}", { viewModel.autoNext(!settings.autoNext) }) }
        item { TvAction("Giảm chuyển động: ${if (settings.reducedMotion) "Bật" else "Tắt"}", { viewModel.reducedMotion(!settings.reducedMotion) }) }
        item { TvAction(if (confirming) "Xác nhận xóa lịch sử" else "Xóa lịch sử xem", {
            if (confirming) { viewModel.clearHistory(); confirming = false } else confirming = true
        }) }
        if (confirming) item { TvAction("Hủy", { confirming = false }) }
        item { Text("Về HyHyTv", fontSize = 21.sp, fontWeight = FontWeight.Bold) }
        item { Text("Phiên bản 1.0.0 · Android TV / Google TV\nDữ liệu phim: NguonC. Không yêu cầu tài khoản.\nYêu thích, nguồn video riêng và tiến độ xem được lưu trên thiết bị.\nChỉ phát nội dung bạn có quyền truy cập. Một số nguồn chỉ hỗ trợ trình phát nhúng.\nỨng dụng hỗ trợ video HTTPS trực tiếp và phụ đề được cung cấp trong luồng.\nChất lượng và phụ đề khả dụng phụ thuộc nguồn phát.", color = Muted, fontSize = 13.sp, lineHeight = 23.sp) }
    }
}

@Composable fun LibraryScreen(mode: String, onFilm: (Film) -> Unit, reducedMotion: Boolean, viewModel: SettingsViewModel = hiltViewModel()) {
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()
    val films = if (mode == "favorites") favorites else history.map { it.film }
    if (films.isEmpty()) StatusPanel(if (mode == "favorites") "Danh sách yêu thích đang trống" else "Chưa có lịch sử xem",
        if (mode == "favorites") "Mở một bộ phim và chọn + Yêu thích." else "Những bộ phim bạn xem sẽ xuất hiện ở đây.")
    else LazyColumn(contentPadding = PaddingValues(vertical = 30.dp)) {
        item { FilmRow(if (mode == "favorites") "Yêu thích" else "Lịch sử xem", films, onFilm, mode, null, { _, _ -> }, reducedMotion) }
    }
}
