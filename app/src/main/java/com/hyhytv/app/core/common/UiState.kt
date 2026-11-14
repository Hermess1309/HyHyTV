package com.hyhytv.app.core.common

import java.io.IOException
import retrofit2.HttpException

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Ready<T>(val value: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}
fun Throwable.userMessage(): String = when (this) {
    is IOException -> "Không thể kết nối. Hãy kiểm tra mạng và thử lại."
    is HttpException -> "Nguồn phim đang bận (HTTP ${code()}). Vui lòng thử lại."
    else -> message ?: "Có lỗi xảy ra. Vui lòng thử lại."
}
