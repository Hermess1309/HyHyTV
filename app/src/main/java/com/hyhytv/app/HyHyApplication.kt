package com.hyhytv.app

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class HyHyApplication : Application(), ImageLoaderFactory {
    override fun newImageLoader() = ImageLoader.Builder(this)
        .memoryCache { MemoryCache.Builder(this).maxSizePercent(0.15).build() }
        .diskCache { DiskCache.Builder().directory(cacheDir.resolve("images")).maxSizeBytes(120L * 1024 * 1024).build() }
        .crossfade(250).respectCacheHeaders(false).build()
}
