package com.hyhytv.app.domain.model

import java.net.URI

data class Film(
    val id: String, val slug: String, val name: String, val originalName: String = "",
    val poster: String = "", val backdrop: String = "", val description: String = "",
    val year: String = "", val quality: String = "", val language: String = "",
    val currentEpisode: String = "", val duration: String = "", val director: String = "",
    val casts: String = "", val genres: List<String> = emptyList(), val countries: List<String> = emptyList(),
    val servers: List<Server> = emptyList()
)
data class Server(val name: String, val episodes: List<Episode>)
data class Episode(val name: String, val slug: String, val embed: String) {
    val directUrl: String? get() = embed.takeIf(::isDirectMediaUrl)
}
data class FilmPage(val films: List<Film>, val page: Int, val totalPages: Int)
data class Shelf(val key: String, val title: String, val path: String)
data class WatchRecord(val film: Film, val server: String, val episodeSlug: String, val episodeName: String,
    val position: Long, val duration: Long, val lastWatched: Long) {
    val completed: Boolean get() = duration > 0 && position >= duration * 0.95
    val resumePosition: Long get() = if (completed) 0 else position.coerceAtLeast(0)
}

fun isDirectMediaUrl(value: String): Boolean = runCatching {
    val uri = URI(value.trim())
    uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() && uri.userInfo == null &&
        listOf(".m3u8", ".mp4", ".mpd", ".webm").any { uri.path.orEmpty().lowercase().endsWith(it) }
}.getOrDefault(false)

object Catalog {
    val shelves = listOf(
        Shelf("latest", "Phim mới cập nhật", "films/phim-moi-cap-nhat"),
        Shelf("series", "Phim bộ", "films/danh-sach/phim-bo"),
        Shelf("movies", "Phim lẻ", "films/danh-sach/phim-le"),
        Shelf("action", "Hành động", "films/the-loai/hanh-dong"),
        Shelf("horror", "Kinh dị", "films/the-loai/kinh-di"),
        Shelf("romance", "Tình cảm", "films/the-loai/tinh-cam"),
        Shelf("animation", "Hoạt hình", "films/the-loai/hoat-hinh")
    )
    // Slugs below are linked from the provider's own catalog, never derived from category IDs.
    val filters = shelves.drop(1) + listOf(
        Shelf("vn", "Việt Nam", "films/quoc-gia/viet-nam"),
        Shelf("cn", "Trung Quốc", "films/quoc-gia/trung-quoc"),
        Shelf("kr", "Hàn Quốc", "films/quoc-gia/han-quoc")
    )
}
