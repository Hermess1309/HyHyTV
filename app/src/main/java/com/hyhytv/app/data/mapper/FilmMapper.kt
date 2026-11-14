package com.hyhytv.app.data.mapper

import com.hyhytv.app.data.remote.*
import com.hyhytv.app.domain.model.*

fun FilmDto.toFilm(): Film? {
    val key = slug?.takeIf { it.isNotBlank() } ?: return null
    val title = name?.takeIf { it.isNotBlank() } ?: return null
    fun categories(group: String) = category.orEmpty().values
        .filter { it.group?.name.equals(group, true) }.flatMap { it.list.orEmpty() }.mapNotNull { it.name }
    return Film(id ?: key, key, title, originalName.orEmpty(), thumb.orEmpty(), poster.orEmpty(),
        cleanDescription(description.orEmpty()), year.orEmpty(), quality.orEmpty(), language.orEmpty(),
        currentEpisode.orEmpty(), time.orEmpty(), director.orEmpty(), casts.orEmpty(),
        categories("Thể loại"), categories("Quốc gia"), episodes.orEmpty().mapIndexed { index, s ->
            Server(s.name ?: "Server ${index + 1}", s.items.orEmpty().mapNotNull { e ->
                val episodeSlug = e.slug?.takeIf(String::isNotBlank) ?: return@mapNotNull null
                Episode(e.name ?: episodeSlug, episodeSlug, e.embed.orEmpty())
            }.distinctBy { it.slug })
        })
}
fun cleanDescription(value: String) = value.replace(Regex("<[^>]*>"), " ")
    .replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", "\"")
    .replace("&#039;", "'").replace(Regex("\\s+"), " ").trim()
