package com.hyhytv.app.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "favorites")
data class FavoriteEntity(@PrimaryKey val slug: String, val filmJson: String, val added: Long)
@Entity(tableName = "history")
data class HistoryEntity(@PrimaryKey val slug: String, val filmJson: String, val server: String,
    val episodeSlug: String, val episodeName: String, val position: Long, val duration: Long, val lastWatched: Long)
@Entity(tableName = "sources", primaryKeys = ["slug", "server", "episode"])
data class SourceEntity(val slug: String, val server: String, val episode: String, val url: String)

@Dao
interface LibraryDao {
    @Query("SELECT * FROM favorites ORDER BY added DESC") fun favorites(): Flow<List<FavoriteEntity>>
    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE slug = :slug)") suspend fun isFavorite(slug: String): Boolean
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun favorite(entity: FavoriteEntity)
    @Query("DELETE FROM favorites WHERE slug = :slug") suspend fun deleteFavorite(slug: String)
    @Query("SELECT * FROM history ORDER BY lastWatched DESC LIMIT 100") fun history(): Flow<List<HistoryEntity>>
    @Query("SELECT * FROM history WHERE slug = :slug") suspend fun progress(slug: String): HistoryEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun history(entity: HistoryEntity)
    @Query("DELETE FROM history WHERE slug = :slug") suspend fun deleteHistory(slug: String)
    @Query("DELETE FROM history") suspend fun clearHistory()
    @Query("DELETE FROM history WHERE slug NOT IN (SELECT slug FROM history ORDER BY lastWatched DESC LIMIT 100)") suspend fun pruneHistory()
    @Query("SELECT url FROM sources WHERE slug = :slug AND server = :server AND episode = :episode")
    suspend fun source(slug: String, server: String, episode: String): String?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun source(entity: SourceEntity)
    @Query("DELETE FROM sources WHERE slug = :slug AND server = :server AND episode = :episode")
    suspend fun deleteSource(slug: String, server: String, episode: String)
}

@Database(entities = [FavoriteEntity::class, HistoryEntity::class, SourceEntity::class], version = 1, exportSchema = true)
abstract class HyHyDatabase : RoomDatabase() { abstract fun library(): LibraryDao }
