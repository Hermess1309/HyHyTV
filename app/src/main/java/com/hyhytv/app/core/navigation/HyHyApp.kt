package com.hyhytv.app.core.navigation

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.*
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.hyhytv.app.core.theme.*
import com.hyhytv.app.presentation.common.*
import com.hyhytv.app.presentation.home.HomeScreen
import com.hyhytv.app.presentation.category.BrowseScreen
import com.hyhytv.app.presentation.detail.DetailScreen
import com.hyhytv.app.presentation.player.PlayerScreen
import com.hyhytv.app.presentation.settings.*

@Composable fun HyHyApp() {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route.orEmpty()
    val settingsViewModel: SettingsViewModel = hiltViewModel()
    val settings by settingsViewModel.settings.collectAsStateWithLifecycle()
    val fullscreen = route.startsWith("detail/") || route.startsWith("player/")
    val openFilm: (com.hyhytv.app.domain.model.Film) -> Unit = { nav.navigate("detail/${Uri.encode(it.slug)}") { launchSingleTop = true } }
    Column(Modifier.fillMaxSize().background(Background)) {
        if (!fullscreen) Row(Modifier.fillMaxWidth().padding(horizontal = 34.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Brand(Modifier.padding(end = 26.dp))
            val tabs = listOf("Trang chủ" to "home", "Phim lẻ" to "browse/movies", "Phim bộ" to "browse/series",
                "Hoạt hình" to "browse/animation", "Thể loại" to "browse/filters", "Tìm kiếm" to "browse/search", "Cài đặt" to "settings")
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(tabs, key = { it.second }) { (label, target) ->
                    val selected = entry?.destination?.route == target || (route == "browse/{mode}" && target == "browse/${entry?.arguments?.getString("mode")}")
                    TvAction(label, {
                        nav.navigate(target) {
                            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true; restoreState = true
                        }
                    }, primary = selected)
                }
            }
        }
        Box(Modifier.weight(1f)) {
            NavHost(navController = nav, startDestination = "home") {
                composable("home") {
                    HomeScreen(openFilm, { nav.navigate("player/${Uri.encode(it.slug)}/-1/-1") }, { key ->
                        nav.navigate("browse/$key")
                    }, settings.reducedMotion)
                }
                composable("browse/{mode}") { backStack -> BrowseScreen(backStack.arguments?.getString("mode") ?: "series", openFilm, settings.reducedMotion) }
                composable("detail/{slug}") {
                    DetailScreen({ nav.popBackStack() }, { slug, server, episode -> nav.navigate("player/${Uri.encode(slug)}/$server/$episode") })
                }
                composable("player/{slug}/{server}/{episode}", arguments = listOf(
                    navArgument("server") { type = NavType.IntType }, navArgument("episode") { type = NavType.IntType })) {
                    PlayerScreen(onBack = { nav.popBackStack() })
                }
                composable("settings") { SettingsScreen({ nav.navigate("library/$it") }) }
                composable("library/{mode}") { backStack -> LibraryScreen(backStack.arguments?.getString("mode") ?: "favorites", openFilm, settings.reducedMotion) }
            }
        }
    }
    if (!fullscreen && route != "home") BackHandler { nav.popBackStack("home", inclusive = false) }
}
