package com.hyhytv.app

import com.google.gson.Gson
import com.hyhytv.app.data.mapper.*
import com.hyhytv.app.data.remote.*
import com.hyhytv.app.domain.model.*
import org.junit.Assert.*
import org.junit.Test

class ApiContractTest {
    private val gson = Gson()
    private fun fixture(name: String) = checkNotNull(javaClass.getResource("/$name")).readText()
    @Test fun realCatalogResponseMapsAndPaginates() {
        val dto = gson.fromJson(fixture("catalog.json"), PageDto::class.java)
        assertEquals("success", dto.status)
        assertEquals(1, dto.paginate?.page)
        assertTrue(checkNotNull(dto.paginate?.totalPages) > 1)
        val films = dto.items.orEmpty().mapNotNull { it.toFilm() }
        assertEquals(10, films.size)
        assertEquals("lang-nghe-thanh-am", films.first().slug)
        assertEquals("2026", films.first().year)
        assertTrue(films.first().poster.startsWith("https://"))
    }
    @Test fun realDetailMapsNumericYearCategoriesAndEpisodeServers() {
        val film = checkNotNull(gson.fromJson(fixture("detail.json"), DetailDto::class.java).movie?.toFilm())
        assertEquals("2015", film.year)
        assertEquals(listOf("Trung Quốc"), film.countries)
        assertTrue("Tình Cảm" in film.genres)
        assertEquals("Hoa Thiên Cốt", film.name)
        assertFalse(film.description.contains("<p>"))
        assertEquals(2, film.servers.size)
        assertEquals("tap-1", film.servers.first().episodes.first().slug)
        assertNull(film.servers.first().episodes.first().directUrl)
    }
    @Test fun realSearchResponseUsesSameContract() {
        val dto = gson.fromJson(fixture("search.json"), PageDto::class.java)
        assertEquals("success", dto.status)
        assertTrue(dto.items.orEmpty().mapNotNull { it.toFilm() }.isNotEmpty())
    }
    @Test fun missingIdentityIsDroppedRatherThanInvented() {
        assertNull(gson.fromJson("{}", FilmDto::class.java).toFilm())
        assertNull(gson.fromJson("""{"slug":"x"}""", FilmDto::class.java).toFilm())
    }
    @Test fun nullOptionalFieldsAreSafe() {
        val film = checkNotNull(gson.fromJson("""{"name":"Phim","slug":"phim","episodes":null,"category":null}""", FilmDto::class.java).toFilm())
        assertEquals("", film.year)
        assertTrue(film.servers.isEmpty())
        assertTrue(film.genres.isEmpty())
    }
    @Test fun descriptionsAreReadable() { assertEquals("A & B C", cleanDescription("<p>A &amp; B</p>  <br>C")) }
    @Test fun httpsMediaUrlsMayIncludeSignedQuery() {
        assertTrue(isDirectMediaUrl("https://example.com/a/video.m3u8?token=test"))
        assertTrue(isDirectMediaUrl("https://example.com/movie.MP4"))
        assertTrue(isDirectMediaUrl("https://example.com/manifest.mpd"))
    }
    @Test fun rejectsEmbedCleartextMalformedAndCredentials() {
        listOf("https://example.com/embed.php?hash=1", "http://example.com/a.mp4", "file:///a.mp4", "https://user:pass@example.com/a.mp4", "oops", "https:///a.mp4").forEach { assertFalse(it, isDirectMediaUrl(it)) }
    }
    @Test fun completedFilmsRestartWhileUnfinishedResume() {
        val film = Film("a", "a", "A")
        assertEquals(500L, WatchRecord(film, "s", "1", "1", 500, 1000, 0).resumePosition)
        assertEquals(0L, WatchRecord(film, "s", "1", "1", 960, 1000, 0).resumePosition)
        assertFalse(WatchRecord(film, "s", "1", "1", 100, 0, 0).completed)
    }
}
