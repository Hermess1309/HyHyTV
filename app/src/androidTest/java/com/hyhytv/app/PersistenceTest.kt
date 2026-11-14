package com.hyhytv.app

import androidx.room.Room
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hyhytv.app.data.local.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PersistenceTest {
    @Test fun favoritesHistoryAndSourcesSurviveDatabaseReopen() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "persistence-test.db"
        context.deleteDatabase(name)
        var database = Room.databaseBuilder(context, HyHyDatabase::class.java, name).build()
        database.library().favorite(FavoriteEntity("hoa-thien-cot", "{}", 1))
        database.library().history(HistoryEntity("hoa-thien-cot", "{}", "Vietsub #1", "tap-2", "2", 60000, 120000, 2))
        database.library().source(SourceEntity("hoa-thien-cot", "Vietsub #1", "tap-2", "https://example.com/owned.mp4"))
        database.close()
        database = Room.databaseBuilder(context, HyHyDatabase::class.java, name).build()
        assertTrue(database.library().isFavorite("hoa-thien-cot"))
        assertEquals(60000L, database.library().progress("hoa-thien-cot")?.position)
        assertEquals("https://example.com/owned.mp4", database.library().source("hoa-thien-cot", "Vietsub #1", "tap-2"))
        database.library().deleteFavorite("hoa-thien-cot")
        database.library().clearHistory()
        assertTrue(database.library().favorites().first().isEmpty())
        assertTrue(database.library().history().first().isEmpty())
        database.close(); context.deleteDatabase(name)
        Unit
    }
}
