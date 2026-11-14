import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setActivePage, type PageId } from '../state/slices/uiSlice';
import { setContent, setPageContent, switchPage, setSearchResults } from '../state/slices/contentSlice';
import { selectPageCache } from '../state/selectors';
import { fetchUnifiedPageContentProgressive } from '../data/movieService';

export function usePageLoader() {
  const dispatch = useDispatch();
  const pageCache = useSelector(selectPageCache);
  const activePageRef = useRef<PageId>('home');

  const loadPage = useCallback(async (pageId: PageId) => {
    activePageRef.current = pageId;
    dispatch(setActivePage(pageId));

    if (pageId === 'search') {
      dispatch(setSearchResults([]));
      return;
    }
    if (pageId === 'myList' || pageId === 'settings') return;

    // Cache-first: if already loaded, switch instantly (0ms)
    if (pageCache[pageId] && pageCache[pageId].length > 0) {
      dispatch(switchPage(pageId));
      return;
    }

    try {
      await fetchUnifiedPageContentProgressive(pageId, (fetchedRows) => {
        if (fetchedRows.length > 0 && activePageRef.current === pageId) {
          dispatch(setPageContent({ page: pageId, rows: fetchedRows }));
          dispatch(setContent(fetchedRows));
        }
      });
    } catch (err) {
      console.warn(`Error loading content for ${pageId}`, err);
    }
  }, [dispatch, pageCache]);

  return loadPage;
}
