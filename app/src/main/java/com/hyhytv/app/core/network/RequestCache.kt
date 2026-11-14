package com.hyhytv.app.core.network

import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Shares in-flight work without coupling it to a caller's cancellation; caches bounded immutable results. */
class RequestCache<T>(private val scope: CoroutineScope, private val maxSize: Int = 32,
    private val ttlMillis: Long = 120_000, private val clock: () -> Long = { System.nanoTime() / 1_000_000 }) {
    private data class Entry<T>(val at: Long, val value: T)
    private val mutex = Mutex()
    private val entries = linkedMapOf<String, Entry<T>>()
    private val inFlight = mutableMapOf<String, Deferred<T>>()
    suspend fun get(key: String, load: suspend () -> T): T {
        val task = mutex.withLock {
            entries[key]?.takeIf { clock() - it.at < ttlMillis }?.let { return it.value }
            inFlight[key] ?: scope.async(start = CoroutineStart.LAZY) {
                try {
                    val result = load()
                    mutex.withLock {
                        entries.remove(key)
                        entries[key] = Entry(clock(), result)
                        while (entries.size > maxSize) entries.remove(entries.keys.first())
                    }
                    result
                } finally { mutex.withLock { inFlight.remove(key) } }
            }.also { inFlight[key] = it }
        }
        return task.await()
    }
}
