import { type CSSProperties, memo, useState, useRef, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { theme } from '../styles/theme';
import { selectSearchQuery, selectSearchResults, selectNavFocused } from '../state/selectors';
import { openDetail, setSearchQuery, clearSearchQuery } from '../state/slices/uiSlice';
import { setSearchResults, type TileData } from '../state/slices/contentSlice';
import { setTrailerPaused } from '../state/slices/trailerSlice';
import { searchUnifiedMovies, GHIBLI_RECOMMENDED_TILES } from '../data/movieService';
import { useIsTvMode } from '../hooks/useMode';

// TV Keyboard layout: Action row + 6-column letters & numbers
export const ACTION_KEYS = [
  { id: 'SPACE', label: '␣ Dấu cách' },
  { id: 'DEL', label: '⌫ Xóa' },
  { id: 'CLR', label: '✕ Xóa hết' },
];

export const KEYBOARD_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['G', 'H', 'I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V', 'W', 'X'],
  ['Y', 'Z', '1', '2', '3', '4'],
  ['5', '6', '7', '8', '9', '0'],
  ['Ă', 'Â', 'Đ', 'Ê', 'Ô', 'Ư'],
];

const QUICK_TAGS = [
  'Studio Ghibli', 'Hành Động', 'Hoạt Hình', 'Hàn Quốc',
  'Kinh Dị', 'Tình Cảm', 'Cổ Trang', 'Hài Hước',
  'Viễn Tưởng', 'Võ Thuật', 'Âu Mỹ', 'Trung Quốc'
];

export const SearchPage = memo(function SearchPage() {
  const dispatch = useDispatch();
  const query = useSelector(selectSearchQuery);
  const searchResultsRows = useSelector(selectSearchResults);
  const navFocused = useSelector(selectNavFocused);
  const isTv = useIsTvMode();

  // Flattened search results
  const resultsTiles: TileData[] = searchResultsRows.flatMap((r) => r.tiles);
  // If no query or results, show Ghibli recommendations as in photo
  const displayedTiles: TileData[] = query.trim() ? resultsTiles : GHIBLI_RECOMMENDED_TILES;

  const [loading, setLoading] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);

  // TV Navigation Focus State
  // zone: 'actions' | 'keyboard' | 'tags' | 'grid'
  const [zone, setZone] = useState<'actions' | 'keyboard' | 'tags' | 'grid'>('keyboard');
  const [actionIndex, setActionIndex] = useState(0); // 0..2
  const [kbPos, setKbPos] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [tagIndex, setTagIndex] = useState(0);
  const [gridIndex, setGridIndex] = useState(0);

  const focusedCardRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll grid when focused card changes
  useEffect(() => {
    if (zone === 'grid' && focusedCardRef.current) {
      focusedCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [zone, gridIndex]);

  // Execute debounced search
  const executeSearch = useCallback((searchTerm: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const clean = searchTerm.trim();
    if (!clean) {
      dispatch(setSearchResults([]));
      setLoading(false);
      return;
    }

    setLoading(true);
    searchDebounceRef.current = window.setTimeout(async () => {
      try {
        const tiles = await searchUnifiedMovies(clean);
        dispatch(setSearchResults([{
          id: 'search-results-row',
          title: `Kết quả cho "${clean}"`,
          tiles,
        }]));
      } finally {
        setLoading(false);
      }
    }, 280);
  }, [dispatch]);

  const handleInputChange = useCallback((newQuery: string) => {
    dispatch(setSearchQuery(newQuery));
    executeSearch(newQuery);
  }, [dispatch, executeSearch]);

  const handleKeyPress = useCallback((key: string) => {
    let nextQuery = query;
    if (key === 'DEL') {
      nextQuery = query.slice(0, -1);
    } else if (key === 'CLR') {
      nextQuery = '';
      dispatch(clearSearchQuery());
      dispatch(setSearchResults([]));
      return;
    } else if (key === 'SPACE') {
      nextQuery = query + ' ';
    } else {
      nextQuery = query + key.toLowerCase();
    }
    handleInputChange(nextQuery);
  }, [query, dispatch, handleInputChange]);

  const handleTileClick = useCallback((tile: TileData) => {
    dispatch(openDetail(tile));
    dispatch(setTrailerPaused(true));
  }, [dispatch]);

  // Handle TV Remote Navigation (Arrow keys + Enter + Back)
  useEffect(() => {
    if (!isTv || navFocused) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.keyCode || e.which;
      const key = e.key;

      // Enter / Select
      if (key === 'Enter' || code === 13) {
        e.preventDefault();
        if (zone === 'actions') {
          handleKeyPress(ACTION_KEYS[actionIndex].id);
        } else if (zone === 'keyboard') {
          const char = KEYBOARD_ROWS[kbPos.row]?.[kbPos.col];
          if (char) handleKeyPress(char);
        } else if (zone === 'tags') {
          const tag = QUICK_TAGS[tagIndex];
          if (tag) handleInputChange(tag);
        } else if (zone === 'grid') {
          const tile = displayedTiles[gridIndex];
          if (tile) handleTileClick(tile);
        }
        return;
      }

      // Backspace key
      if (key === 'Backspace' || code === 8) {
        if (zone !== 'grid') {
          e.preventDefault();
          handleKeyPress('DEL');
        }
        return;
      }

      // Arrow navigation
      if (key === 'ArrowUp' || code === 38) {
        e.preventDefault();
        if (zone === 'grid') {
          if (gridIndex >= 4) {
            setGridIndex((prev) => prev - 4);
          }
        } else if (zone === 'tags') {
          setZone('keyboard');
          setKbPos({ row: KEYBOARD_ROWS.length - 1, col: Math.min(2, KEYBOARD_ROWS[0].length - 1) });
        } else if (zone === 'keyboard') {
          if (kbPos.row > 0) {
            setKbPos((prev) => ({ ...prev, row: prev.row - 1 }));
          } else {
            setZone('actions');
            setActionIndex(Math.min(actionIndex, ACTION_KEYS.length - 1));
          }
        } else if (zone === 'actions') {
          // At top of actions -> let user reach top nav
        }
      } else if (key === 'ArrowDown' || code === 40) {
        e.preventDefault();
        if (zone === 'grid') {
          if (gridIndex + 4 < displayedTiles.length) {
            setGridIndex((prev) => prev + 4);
          }
        } else if (zone === 'actions') {
          setZone('keyboard');
          setKbPos({ row: 0, col: actionIndex * 2 });
        } else if (zone === 'keyboard') {
          if (kbPos.row < KEYBOARD_ROWS.length - 1) {
            setKbPos((prev) => ({ ...prev, row: prev.row + 1 }));
          } else {
            setZone('tags');
            setTagIndex(0);
          }
        }
      } else if (key === 'ArrowLeft' || code === 37) {
        e.preventDefault();
        if (zone === 'grid') {
          if (gridIndex % 4 === 0) {
            // Jump from left edge of grid back to keyboard
            setZone('keyboard');
            setKbPos((prev) => ({ ...prev, col: KEYBOARD_ROWS[0].length - 1 }));
          } else {
            setGridIndex((prev) => Math.max(0, prev - 1));
          }
        } else if (zone === 'actions') {
          setActionIndex((prev) => Math.max(0, prev - 1));
        } else if (zone === 'keyboard') {
          setKbPos((prev) => ({ ...prev, col: Math.max(0, prev.col - 1) }));
        } else if (zone === 'tags') {
          setTagIndex((prev) => Math.max(0, prev - 1));
        }
      } else if (key === 'ArrowRight' || code === 39) {
        e.preventDefault();
        if (zone === 'actions') {
          if (actionIndex < ACTION_KEYS.length - 1) {
            setActionIndex((prev) => prev + 1);
          } else if (displayedTiles.length > 0) {
            setZone('grid');
            setGridIndex(0);
          }
        } else if (zone === 'keyboard') {
          if (kbPos.col < KEYBOARD_ROWS[kbPos.row].length - 1) {
            setKbPos((prev) => ({ ...prev, col: prev.col + 1 }));
          } else if (displayedTiles.length > 0) {
            // Jump from right edge of keyboard into movie grid!
            setZone('grid');
            const targetRow = Math.min(Math.floor(displayedTiles.length / 4), Math.floor(kbPos.row / 2));
            setGridIndex(Math.min(displayedTiles.length - 1, targetRow * 4));
          }
        } else if (zone === 'tags') {
          if (tagIndex < QUICK_TAGS.length - 1) {
            setTagIndex((prev) => prev + 1);
          } else if (displayedTiles.length > 0) {
            setZone('grid');
            setGridIndex(0);
          }
        } else if (zone === 'grid') {
          if (gridIndex < displayedTiles.length - 1) {
            setGridIndex((prev) => prev + 1);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTv, navFocused, zone, actionIndex, kbPos, tagIndex, gridIndex, displayedTiles, handleKeyPress, handleInputChange, handleTileClick]);

  // Main Container Styles
  const pageContainerStyle: CSSProperties = {
    display: 'flex',
    paddingTop: theme.spacing.headerHeight + 10,
    paddingLeft: 36,
    paddingRight: 36,
    paddingBottom: 60,
    minHeight: '100vh',
    boxSizing: 'border-box',
    gap: 32,
    background: '#141414',
  };

  const leftPaneStyle: CSSProperties = {
    width: 320,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  const searchBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    padding: '8px 12px',
    gap: 10,
  };

  const rightPaneStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minWidth: 0,
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '20px 16px',
    maxHeight: 'calc(100vh - 170px)',
    overflowY: 'auto',
    paddingRight: 8,
    paddingBottom: 40,
  };

  return (
    <div style={pageContainerStyle}>
      {/* LEFT PANE: Search Bar + Action Keys + TV Keyboard + Quick Tags */}
      <div style={leftPaneStyle}>
        {/* Search Query Display / Input */}
        <div style={searchBoxStyle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            type="text"
            placeholder="Studio Ghibli, One Piece..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 17,
              fontWeight: 600,
              fontFamily: theme.typography.fontFamily,
            }}
          />
          {loading && (
            <div style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: '#e50914',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
        </div>

        {/* Action Keys (Space, Delete, Clear) */}
        <div style={{ display: 'flex', gap: 6 }}>
          {ACTION_KEYS.map((act, i) => {
            const isFocused = !navFocused && zone === 'actions' && actionIndex === i;
            return (
              <button
                key={act.id}
                onClick={() => handleKeyPress(act.id)}
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  background: isFocused ? '#ffffff' : 'rgba(255,255,255,0.08)',
                  color: isFocused ? '#000000' : 'rgba(255,255,255,0.85)',
                  border: isFocused ? '2px solid #e50914' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transform: isFocused ? 'scale(1.04)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                  boxShadow: isFocused ? '0 0 12px rgba(229,9,20,0.6)' : 'none',
                }}
              >
                {act.label}
              </button>
            );
          })}
        </div>

        {/* 6-Column TV Keyboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {KEYBOARD_ROWS.map((rowLetters, rIdx) => (
            <div key={rIdx} style={{ display: 'flex', gap: 5 }}>
              {rowLetters.map((char, cIdx) => {
                const isFocused = !navFocused && zone === 'keyboard' && kbPos.row === rIdx && kbPos.col === cIdx;
                return (
                  <button
                    key={char}
                    onClick={() => handleKeyPress(char)}
                    style={{
                      flex: 1,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isFocused ? '#ffffff' : 'rgba(255,255,255,0.08)',
                      color: isFocused ? '#000000' : 'rgba(255,255,255,0.88)',
                      border: isFocused ? '2px solid #e50914' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: theme.typography.fontFamily,
                      cursor: 'pointer',
                      transform: isFocused ? 'scale(1.12)' : 'scale(1)',
                      transition: 'all 0.12s ease',
                      zIndex: isFocused ? 5 : 1,
                      boxShadow: isFocused ? '0 0 10px rgba(255,255,255,0.8)' : 'none',
                    }}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Quick Suggestion Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {QUICK_TAGS.map((tag, tIdx) => {
            const isFocused = !navFocused && zone === 'tags' && tagIndex === tIdx;
            return (
              <button
                key={tag}
                onClick={() => handleInputChange(tag)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 16,
                  background: isFocused ? '#ffffff' : 'rgba(255,255,255,0.08)',
                  color: isFocused ? '#000000' : '#bbb',
                  border: isFocused ? '1.5px solid #e50914' : '1px solid rgba(255,255,255,0.15)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transform: isFocused ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.12s ease',
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANE: 4-Column Poster Grid (Matches User's Photo) */}
      <div style={rightPaneStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 8,
        }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            fontFamily: theme.typography.fontFamily,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>{query.trim() ? `Kết quả tìm kiếm: "${query}"` : 'Studio Ghibli & Đề Xuất Cho Bạn'}</span>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>
              ({displayedTiles.length} phim)
            </span>
          </h2>
          <span style={{ fontSize: 12, color: '#666' }}>
            {zone === 'grid' ? 'Bấm ◄ để quay lại bàn phím' : 'Bấm ► để duyệt phim'}
          </span>
        </div>

        <div ref={gridContainerRef} style={gridStyle}>
          {displayedTiles.map((tile, idx) => {
            const isFocused = !navFocused && zone === 'grid' && gridIndex === idx;
            const poster = tile.posterPath || tile.backdropPath || '';

            return (
              <div
                key={tile.id || idx}
                ref={isFocused ? focusedCardRef : null}
                onClick={() => handleTileClick(tile)}
                style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  aspectRatio: '2 / 3',
                  background: '#222',
                  outline: isFocused ? '3.5px solid #ffffff' : 'none',
                  boxShadow: isFocused
                    ? '0 0 20px rgba(255, 255, 255, 0.75), 0 8px 24px rgba(0,0,0,0.8)'
                    : '0 4px 12px rgba(0,0,0,0.4)',
                  transform: isFocused ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.16s ease, outline 0.16s ease, box-shadow 0.16s ease',
                  zIndex: isFocused ? 10 : 1,
                }}
              >
                <img
                  src={poster}
                  alt={tile.title}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />

                {/* Badge Rating */}
                <div style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#46d369',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 3,
                }}>
                  {tile.rating || 'FHD'}
                </div>

                {/* Bottom title gradient */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '24px 8px 8px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)',
                }}>
                  <div style={{
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: theme.typography.fontFamily,
                  }}>
                    {tile.title}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 10,
                    color: '#bbb',
                    marginTop: 2,
                  }}>
                    <span>{tile.year}</span>
                    <span>•</span>
                    <span>{tile.genre}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
