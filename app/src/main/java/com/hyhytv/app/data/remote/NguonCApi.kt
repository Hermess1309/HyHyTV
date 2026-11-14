package com.hyhytv.app.data.remote

import com.google.gson.annotations.SerializedName
import retrofit2.http.*

interface NguonCApi {
    @GET suspend fun page(@Url path: String, @Query("page") page: Int, @Query("keyword") keyword: String?): PageDto
    @GET("film/{slug}") suspend fun detail(@Path("slug") slug: String): DetailDto
}
data class PageDto(val status: String?, val paginate: PaginationDto?, val items: List<FilmDto>?)
data class PaginationDto(@SerializedName("current_page") val page: Int?, @SerializedName("total_page") val totalPages: Int?)
data class DetailDto(val status: String?, val movie: FilmDto?)
data class FilmDto(
    val id: String?, val slug: String?, val name: String?,
    @SerializedName("original_name") val originalName: String?,
    @SerializedName("thumb_url") val thumb: String?,
    @SerializedName("poster_url") val poster: String?,
    val description: String?, val year: String?, val quality: String?, val language: String?,
    @SerializedName("current_episode") val currentEpisode: String?, val time: String?,
    val director: String?, val casts: String?, val category: Map<String, CategoryDto>?, val episodes: List<ServerDto>?
)
data class CategoryDto(val group: GroupDto?, val list: List<GroupDto>?)
data class GroupDto(val id: String?, val name: String?)
data class ServerDto(@SerializedName("server_name") val name: String?, val items: List<EpisodeDto>?)
data class EpisodeDto(val name: String?, val slug: String?, val embed: String?)
