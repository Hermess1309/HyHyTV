package com.hyhytv.app

import com.hyhytv.app.core.network.RequestCache
import com.hyhytv.app.data.remote.NguonCApi
import com.hyhytv.app.data.repository.retry
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import okhttp3.mockwebserver.*
import org.junit.Assert.*
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class NetworkBehaviorTest {
    @Test fun concurrentRequestsShareOneOperation() = runTest {
        val cache = RequestCache<Int>(backgroundScope)
        var requests = 0
        val jobs = (1..20).map { async { cache.get("same") { requests++; delay(100); 42 } } }
        assertEquals(List(20) { 42 }, jobs.awaitAll())
        assertEquals(1, requests)
    }
    @Test fun cancellingOneScreenDoesNotCancelSharedRequest() = runTest {
        val cache = RequestCache<Int>(backgroundScope)
        var requests = 0
        val first = async { cache.get("film") { requests++; delay(100); 7 } }
        runCurrent()
        val second = async { cache.get("film") { requests++; 8 } }
        runCurrent(); first.cancel()
        assertEquals(7, second.await())
        assertEquals(1, requests)
    }
    @Test fun expiredAndEvictedResponsesReload() = runTest {
        var now = 0L
        val cache = RequestCache<Int>(backgroundScope, 2, 100) { now }
        var requests = 0
        suspend fun load(key: String) = cache.get(key) { ++requests }
        assertEquals(1, load("a")); assertEquals(1, load("a"))
        now = 101
        assertEquals(2, load("a")); load("b"); load("c")
        assertEquals(5, load("a"))
    }
    @Test fun retriesAreBoundedToThreeAttempts() = runTest {
        var attempts = 0
        try { retry<Unit> { attempts++; throw IOException("offline") }; fail() } catch (_: IOException) { }
        assertEquals(3, attempts)
        assertEquals(1050L, currentTime)
    }
    @Test fun cancellationIsNeverRetried() = runTest {
        var attempts = 0
        try { retry<Unit> { attempts++; throw CancellationException() }; fail() } catch (_: CancellationException) { }
        assertEquals(1, attempts)
    }
    @Test fun invalidPayloadIsNeverRetried() = runTest {
        var attempts = 0
        try { retry<Unit> { attempts++; throw IllegalArgumentException("schema") }; fail() } catch (_: IllegalArgumentException) { }
        assertEquals(1, attempts)
    }
    @Test fun retrofitEncodesVietnameseSearchAndUsesVerifiedPath() = runBlocking {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("""{"status":"success","paginate":{"current_page":2,"total_page":3},"items":[]}"""))
            val api = Retrofit.Builder().baseUrl(server.url("/api/")).addConverterFactory(GsonConverterFactory.create()).build().create(NguonCApi::class.java)
            val response = api.page("films/search", 2, "Hoa & Đời")
            val request = server.takeRequest()
            assertEquals("/api/films/search", request.requestUrl?.encodedPath)
            assertEquals("Hoa & Đời", request.requestUrl?.queryParameter("keyword"))
            assertEquals("2", request.requestUrl?.queryParameter("page"))
            assertEquals(2, response.paginate?.page)
        }
    }
}
