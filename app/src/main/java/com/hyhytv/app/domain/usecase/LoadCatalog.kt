package com.hyhytv.app.domain.usecase

import com.hyhytv.app.domain.model.*
import com.hyhytv.app.domain.repository.FilmRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.supervisorScope
import javax.inject.Inject

class LoadCatalog @Inject constructor(private val repository: FilmRepository) {
    suspend operator fun invoke(): List<Pair<Shelf, Result<FilmPage>>> = supervisorScope {
        Catalog.shelves.map { shelf -> async {
            shelf to try { Result.success(repository.page(shelf.path)) }
            catch (e: kotlinx.coroutines.CancellationException) { throw e }
            catch (e: Exception) { Result.failure(e) }
        } }.map { it.await() }
    }
}
