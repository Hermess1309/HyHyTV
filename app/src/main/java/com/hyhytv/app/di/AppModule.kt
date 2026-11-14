package com.hyhytv.app.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import com.hyhytv.app.data.local.*
import com.hyhytv.app.data.remote.NguonCApi
import com.hyhytv.app.data.repository.NguonCRepository
import com.hyhytv.app.domain.repository.FilmRepository
import dagger.*
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.*
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module @InstallIn(SingletonComponent::class)
object AppModule {
    @Provides @Singleton fun gson() = Gson()
    @Provides @Singleton fun client(@ApplicationContext context: Context) = OkHttpClient.Builder()
        .cache(Cache(context.cacheDir.resolve("api"), 20L * 1024 * 1024))
        .connectTimeout(12, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).callTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("Accept", "application/json").header("User-Agent", "HyHyTv/1.0 AndroidTV").build()) }
        .addNetworkInterceptor { chain ->
            val response = chain.proceed(chain.request())
            if (response.isSuccessful && response.header("Cache-Control") == null)
                response.newBuilder().header("Cache-Control", "public, max-age=120").build() else response
        }.build()
    @Provides @Singleton fun api(client: OkHttpClient, gson: Gson): NguonCApi = Retrofit.Builder()
        .baseUrl("https://phim.nguonc.com/api/").client(client).addConverterFactory(GsonConverterFactory.create(gson)).build().create(NguonCApi::class.java)
    @Provides @Singleton fun database(@ApplicationContext context: Context) = Room.databaseBuilder(context, HyHyDatabase::class.java, "hyhytv.db").build()
    @Provides fun dao(database: HyHyDatabase) = database.library()
    @Provides @Singleton fun repository(repository: NguonCRepository): FilmRepository = repository
}
