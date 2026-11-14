package com.hyhytv.app.core.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.BringIntoViewSpec
import androidx.compose.foundation.gestures.LocalBringIntoViewSpec
import androidx.compose.ui.graphics.Color
import androidx.tv.material3.*

val Background = Color(0xFF090A0E)
val Panel = Color(0xFF191B23)
val Accent = Color(0xFFF22546)
val Muted = Color(0xFFB8BBC9)
@OptIn(ExperimentalFoundationApi::class)
private val MinimalScroll = object : BringIntoViewSpec {
    override fun calculateScrollDistance(offset: Float, size: Float, containerSize: Float): Float = when {
        offset < 0 -> offset
        offset + size > containerSize -> offset + size - containerSize
        else -> 0f
    }
}
@OptIn(ExperimentalFoundationApi::class)
@Composable fun HyHyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = darkColorScheme(primary = Accent, onPrimary = Color.White,
        background = Background, onBackground = Color.White, surface = Panel, onSurface = Color.White)) {
        CompositionLocalProvider(LocalContentColor provides Color.White, LocalBringIntoViewSpec provides MinimalScroll) { content() }
    }
}
