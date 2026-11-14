package com.hyhytv.app

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import dagger.hilt.android.AndroidEntryPoint
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fullscreen immersive TV mode
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        // Enable remote webview debugging
        WebView.setWebContentsDebuggingEnabled(true)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#141414"))
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            isFocusable = true
            isFocusableInTouchMode = true

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                useWideViewPort = true
                loadWithOverviewMode = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                userAgentString = "Mozilla/5.0 (Linux; Android 11; Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HyHyTv"
            }

            // Expose native bridge for Subtitles, Version, and Auto-Update
            addJavascriptInterface(AndroidBridge(this@MainActivity, this), "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    val urlString = request.url.toString()
                    // Proxy VSMOV stream, KKPhim stream & API, GitHub updates, and Catbox requests to attach clean CORS headers
                    if (urlString.contains("streamvsmov.com") || urlString.contains("vsmov.com") ||
                        urlString.contains("catbox.moe") || urlString.contains("phimapi.com") ||
                        urlString.contains("kkphim") || urlString.contains("phimimg.com") ||
                        urlString.contains("kkphimplayer") || urlString.contains("githubusercontent.com") ||
                        urlString.contains("github.com")) {
                        val proxyResp = handleCorsProxyRequest(request)
                        if (proxyResp != null) return proxyResp
                    }
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    android.util.Log.e("HyHyWebClient", "Error loading ${request?.url}: ${error?.description}")
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    android.util.Log.d(
                        "HyHyWebConsole",
                        "[${consoleMessage?.messageLevel()}] ${consoleMessage?.message()} (at ${consoleMessage?.sourceId()}:${consoleMessage?.lineNumber()})"
                    )
                    return true
                }
            }

            loadUrl("https://appassets.androidplatform.net/assets/dist/index.html")
        }

        setContentView(webView)
        webView.requestFocus()
    }

    private fun handleCorsProxyRequest(request: WebResourceRequest): WebResourceResponse? {
        return try {
            val requestUrl = request.url.toString()
            if (request.method.equals("OPTIONS", ignoreCase = true)) {
                val corsHeaders = mutableMapOf(
                    "Access-Control-Allow-Origin" to "*",
                    "Access-Control-Allow-Methods" to "GET, POST, OPTIONS, HEAD",
                    "Access-Control-Allow-Headers" to "*",
                    "Access-Control-Max-Age" to "86400"
                )
                return WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    200,
                    "OK",
                    corsHeaders,
                    ByteArrayInputStream(ByteArray(0))
                )
            }

            val url = URL(requestUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = request.method
            for ((key, value) in request.requestHeaders) {
                conn.setRequestProperty(key, value)
            }
            conn.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            if (requestUrl.contains("phimapi.com") || requestUrl.contains("kkphim") || requestUrl.contains("phimimg.com")) {
                conn.setRequestProperty("Referer", "https://kkphim2.com/")
            } else {
                conn.setRequestProperty("Referer", "https://vsmov.com/")
            }
            conn.connectTimeout = 8000
            conn.readTimeout = 12000

            val statusCode = conn.responseCode
            val statusMsg = conn.responseMessage ?: "OK"

            val responseHeaders = mutableMapOf<String, String>()
            for ((k, v) in conn.headerFields) {
                if (k != null && v.isNotEmpty()) {
                    if (!k.startsWith("Access-Control-", ignoreCase = true)) {
                        responseHeaders[k] = v[0]
                    }
                }
            }
            responseHeaders["Access-Control-Allow-Origin"] = "*"
            responseHeaders["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, HEAD"
            responseHeaders["Access-Control-Allow-Headers"] = "*"
            responseHeaders["Access-Control-Expose-Headers"] = "*"

            val rawContentType = conn.contentType ?: if (requestUrl.contains(".m3u8")) {
                "application/vnd.apple.mpegurl"
            } else if (requestUrl.contains(".vtt")) {
                "text/vtt"
            } else {
                "video/mp2t"
            }

            val mimeType = rawContentType.substringBefore(";").trim()
            val encoding = if (rawContentType.contains("charset=")) {
                rawContentType.substringAfter("charset=").trim()
            } else {
                "UTF-8"
            }

            val stream = if (statusCode in 200..299) conn.inputStream else conn.errorStream
            WebResourceResponse(mimeType, encoding, statusCode, statusMsg, responseHeaders, stream)
        } catch (e: Exception) {
            android.util.Log.e("HyHyCorsProxy", "Failed to proxy ${request.url}: ${e.message}")
            null
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_BACK -> {
                    // Send Escape to close overlays/modals in the UI
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_DPAD_UP -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_DPAD_DOWN -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_DPAD_LEFT -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_NEXT -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', keyCode: 78, which: 78, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', keyCode: 80, which: 80, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true }));",
                        null
                    )
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_REWIND -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true }));",
                        null
                    )
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }

    class AndroidBridge(private val activity: MainActivity, private val webView: WebView) {

        @JavascriptInterface
        fun getAppVersion(): String {
            return try {
                val pInfo = activity.packageManager.getPackageInfo(activity.packageName, 0)
                pInfo.versionName ?: "1.0.0"
            } catch (e: Exception) {
                "1.0.0"
            }
        }

        @JavascriptInterface
        fun getAppVersionCode(): Int {
            return try {
                val pInfo = activity.packageManager.getPackageInfo(activity.packageName, 0)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    pInfo.longVersionCode.toInt()
                } else {
                    @Suppress("DEPRECATION")
                    pInfo.versionCode
                }
            } catch (e: Exception) {
                1
            }
        }

        @JavascriptInterface
        fun extractSubtitles(embedUrl: String): String {
            return try {
                val url = URL(embedUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                if (embedUrl.contains("phimapi.com") || embedUrl.contains("kkphim") || embedUrl.contains("phimimg.com")) {
                    conn.setRequestProperty("Referer", "https://kkphim2.com/")
                } else {
                    conn.setRequestProperty("Referer", "https://vsmov.com/")
                }
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                val html = conn.inputStream.bufferedReader().use { it.readText() }
                val regex = Regex("""subtitles\s*:\s*(\[[^\]]+\])""")
                val match = regex.find(html)
                if (match != null) {
                    val json = match.groupValues[1]
                    val base = "${url.protocol}://${url.host}"
                    json.replace(""""url":"/""", """"url":"$base/""")
                } else {
                    "[]"
                }
            } catch (e: Exception) {
                android.util.Log.e("HyHySubtitle", "Subtitle extraction failed: ${e.message}")
                "[]"
            }
        }

        @JavascriptInterface
        fun downloadAndInstallUpdate(apkUrl: String) {
            Thread {
                try {
                    val url = URL(apkUrl)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.connect()
                    val total = conn.contentLength
                    val updateFile = File(activity.cacheDir, "update.apk")
                    if (updateFile.exists()) updateFile.delete()

                    val input = conn.inputStream
                    val output = FileOutputStream(updateFile)
                    val buffer = ByteArray(8192)
                    var downloaded: Long = 0
                    var count: Int

                    while (input.read(buffer).also { count = it } != -1) {
                        downloaded += count
                        output.write(buffer, 0, count)
                        if (total > 0) {
                            val percent = ((downloaded * 100) / total).toInt()
                            activity.runOnUiThread {
                                webView.evaluateJavascript("window.onUpdateDownloadProgress && window.onUpdateDownloadProgress($percent);", null)
                            }
                        }
                    }
                    output.flush()
                    output.close()
                    input.close()

                    activity.runOnUiThread {
                        webView.evaluateJavascript("window.onUpdateDownloadComplete && window.onUpdateDownloadComplete();", null)
                        installApk(updateFile)
                    }
                } catch (e: Exception) {
                    android.util.Log.e("HyHyUpdate", "Update download failed: ${e.message}")
                    activity.runOnUiThread {
                        webView.evaluateJavascript("window.onUpdateDownloadError && window.onUpdateDownloadError('${e.message}');", null)
                    }
                }
            }.start()
        }

        private fun installApk(file: File) {
            try {
                val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                android.util.Log.e("HyHyUpdate", "Launch installer error: ${e.message}")
            }
        }
    }
}
