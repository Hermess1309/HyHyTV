package com.hyhytv.app

import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.*
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.runtime.mutableStateOf
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hyhytv.app.core.theme.HyHyTheme
import com.hyhytv.app.presentation.common.TvAction
import com.hyhytv.app.presentation.common.FilmRow
import com.hyhytv.app.domain.model.Film
import com.hyhytv.app.presentation.category.TvTextInput
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalTestApi::class)
class RemoteFocusTest {
    @get:Rule val compose = createComposeRule()
    @Test fun dpadMovesFocusAndCenterActivatesNativeTvButtons() {
        val requester = FocusRequester()
        var clicked = false
        compose.setContent { HyHyTheme { Row {
            TvAction("Trang chủ", {}, Modifier.focusRequester(requester))
            TvAction("Chi tiết", { clicked = true })
        } } }
        compose.runOnIdle { requester.requestFocus() }
        compose.onNodeWithText("Trang chủ").assertIsFocused().performKeyInput { pressKey(Key.DirectionRight) }
        compose.onNodeWithText("Chi tiết").assertIsFocused().performKeyInput { pressKey(Key.DirectionCenter) }
        compose.runOnIdle { assertTrue(clicked) }
    }
    @Test fun verticalNavigationRestoresEachRowsLastPoster() {
        val firstRow = listOf(Film("hoa", "hoa-thien-cot", "Hoa Thiên Cốt"), Film("lie", "loi-noi-doi-hoan-hao-2026", "Lời Nói Dối Hoàn Hảo"))
        val secondRow = listOf(Film("sound", "lang-nghe-thanh-am", "Lắng Nghe Thanh Âm"), Film("crow", "hoi-qua-den", "Hội Quạ Đen"))
        val visibleFirst = mutableStateOf(firstRow)
        compose.setContent { HyHyTheme { Column {
            FilmRow("Phim bộ", visibleFirst.value, {}, "series", null, { _, _ -> })
            FilmRow("Mới cập nhật", secondRow, {}, "latest", null, { _, _ -> })
        } } }
        compose.onNodeWithText("Hoa Thiên Cốt").performSemanticsAction(SemanticsActions.RequestFocus) { it() }
        compose.onNodeWithText("Hoa Thiên Cốt").performKeyInput { pressKey(Key.DirectionRight) }
        compose.onNodeWithText("Lời Nói Dối Hoàn Hảo").assertIsFocused().performKeyInput { pressKey(Key.DirectionDown) }
        compose.onNodeWithText("Lắng Nghe Thanh Âm").assertIsFocused().performKeyInput { pressKey(Key.DirectionRight) }
        compose.onNodeWithText("Hội Quạ Đen").assertIsFocused().performKeyInput { pressKey(Key.DirectionUp) }
        compose.onNodeWithText("Lời Nói Dối Hoàn Hảo").assertIsFocused()
        compose.onNodeWithText("Lời Nói Dối Hoàn Hảo").performKeyInput { pressKey(Key.DirectionDown) }
        compose.runOnIdle { visibleFirst.value = firstRow.take(1) }
        compose.onNodeWithText("Hội Quạ Đen").performKeyInput { pressKey(Key.DirectionUp) }
        compose.onNodeWithText("Hoa Thiên Cốt").assertIsFocused()
    }
    @Test fun dpadCanLeaveTextInputForSubmitButton() {
        val input = FocusRequester()
        val submit = FocusRequester()
        compose.setContent { HyHyTheme { Column {
            TvTextInput("https://example.com/owned.mp4", {}, "URL", Modifier.focusRequester(input), onSubmit = { submit.requestFocus() })
            TvAction("Lưu nguồn", {}, Modifier.focusRequester(submit))
        } } }
        compose.runOnIdle { input.requestFocus() }
        compose.onNode(hasSetTextAction()).assertIsFocused().performKeyInput { pressKey(Key.DirectionDown) }
        compose.onNodeWithText("Lưu nguồn").assertIsFocused()
    }
}
