import { type CSSProperties, memo, useState, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { theme } from '../styles/theme';
import { selectSearchQuery, selectSearchResults, selectFocus, selectNavFocused } from '../state/selectors';
import { openDetail } from '../state/slices/uiSlice';
import { setSearchQuery, clearSearchQuery } from '../state/slices/uiSlice';
import { setSearchResults, type TileData } from '../state/slices/contentSlice';
import { setTrailerPaused } from '../state/slices/trailerSlice';
import { searchVsmov } from '../data/vsmov';
import { getTmdbBackdropUrl, getTmdbPosterUrl } from '../data/tmdb';
import { KEYBOARD_GRID, KEYBOARD_COLS } from '../utils/constants';

const KEYBOARD_ROW_COUNT = Math.ceil(KEYBOARD_GRID.length / KEYBOARD_COLS);
const KEY_SIZE = 46;
const KEY_GAP = 6;

const POPULAR_TAGS = [
  'Hành Động', 'Tình Cảm', 'Kinh Dị', 'Hàn Quốc',
  'Trung Quốc', 'Cổ Trang', 'Hoạt Hình', 'Hài Hước'
];

export const SearchPage = memo(function SearchPage() {
  const dispatch = useDispatch();
  const query = useSelector(selectSearchQuery);
  const results = useSelector(selectSearchResults);
  const focus = useSelector(selectFocus);
  const navFocused = useSelector(selectNavFocused);

  const [loading, setLoading] = useState(false);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const searchDebounceRef = useRef<number | null>(null);

  const isKeyboardFocused = !navFocused && focus.rowIndex >= 0 && focus.rowIndex < KEYBOARD_ROW_COUNT;
  const focusedKeyRow = isKeyboardFocused ? focus.rowIndex : -1;
  const focusedKeyCol = isKeyboardFocused ? focus.tileIndex : -1;

  const executeSearch = useCallback((searchTerm: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchTerm.trim()) {
      dispatch(setSearchResults([]));
      setLoading(false);
      return;
    }

    setLoading(true);
    searchDebounceRef.current = window.setTimeout(async () => {
      try {
        const rows = await searchVsmov(searchTerm);
        dispatch(setSearchResults(rows));
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [dispatch]);

  const handleInputChange = (newQuery: string) => {
    dispatch(setSearchQuery(newQuery));
    executeSearch(newQuery);
  };

  const handleKeyPress = (key: string) => {
    let nextQuery = query;
    if (key === 'DEL') {
      nextQuery = query.slice(0, -1);
    } else if (key === 'CLR') {
      nextQuery = '';
    } else if (key === 'SPACE') {
      nextQuery = query + ' ';
    } else {
      nextQuery = query + key.toLowerCase();
    }
    handleInputChange(nextQuery);
  };

  const handleTileClick = (tile: TileData) => {
    dispatch(openDetail(tile));
    dispatch(setTrailerPaused(true));
  };

  // Flatten tiles from results rows
  const allTiles: TileData[] = results.flatMap((r) => r.tiles);

  const containerStyle: CSSProperties = {
    paddingTop: theme.spacing.headerHeight + 20,
    paddingLeft: theme.spacing.edgePadding,
    paddingRight: theme.spacing.edgePadding,
    paddingBottom: 160,
    minHeight: '100vh',
  };

  const searchBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    maxWidth: 720,
  };

  const inputWrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    padding: '10px 16px',
    transition: 'border-color 0.2s, background 0.2s',
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 20,
    fontWeight: 500,
    fontFamily: theme.typography.fontFamily,
    marginLeft: 10,
  };

  const clearBtnStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#aaa',
    fontSize: 18,
    cursor: 'pointer',
    padding: '4px 8px',
  };

  const tagListStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  };

  const tagStyle: CSSProperties = {
    padding: '6px 14px',
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#ccc',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const keyboardStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${KEYBOARD_COLS}, ${KEY_SIZE}px)`,
    gap: KEY_GAP,
    marginBottom: 36,
  };

  const gridContainerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '20px 14px',
    marginTop: 20,
  };

  return (
    <div style={containerStyle}>
      {/* Search Input Bar */}
      <div style={searchBoxStyle}>
        <div style={inputWrapperStyle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            type="text"
            placeholder="Tìm tên phim, diễn viên, thể loại..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            style={inputStyle}
            autoFocus
          />
          {loading && (
            <div style={{
              width: 18,
              height: 18,
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: '#e50914',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginRight: 8,
            }} />
          )}
          {query && (
            <button
              style={clearBtnStyle}
              onClick={() => {
                dispatch(clearSearchQuery());
                dispatch(setSearchResults([]));
              }}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Popular Search Tags */}
      <div style={tagListStyle}>
        <span style={{ color: '#888', fontSize: 13, marginRight: 6 }}>Gợi ý:</span>
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            style={tagStyle}
            onClick={() => handleInputChange(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* On-Screen Keyboard */}
      <div style={keyboardStyle}>
        {KEYBOARD_GRID.map((key, i) => {
          const row = Math.floor(i / KEYBOARD_COLS);
          const col = i % KEYBOARD_COLS;
          const isFocused = isKeyboardFocused && focusedKeyRow === row && focusedKeyCol === col;
          const label = key === 'SPACE' ? '␣ Dấu cách' : key === 'DEL' ? '⌫ Xóa' : key === 'CLR' ? '✕ Đặt lại' : key;

          return (
            <button
              key={`${key}-${i}`}
              style={{
                width: KEY_SIZE,
                height: KEY_SIZE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isFocused ? '#fff' : 'rgba(255,255,255,0.08)',
                color: isFocused ? '#000' : 'rgba(255,255,255,0.85)',
                border: isFocused ? '2px solid #e50914' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                fontSize: key.length > 1 ? 10 : 16,
                fontWeight: 600,
                fontFamily: theme.typography.fontFamily,
                cursor: 'pointer',
                transform: isFocused ? 'scale(1.12)' : 'scale(1)',
                transition: 'all 0.15s ease',
                zIndex: isFocused ? 2 : 1,
              }}
              onClick={() => handleKeyPress(key)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search Results Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, fontFamily: theme.typography.fontFamily }}>
            {query ? `Kết quả tìm kiếm cho "${query}" (${allTiles.length} phim)` : 'Phim phổ biến & Đề xuất'}
          </div>
        </div>

        {query && allTiles.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 18, color: '#fff', fontWeight: 600, marginBottom: 6 }}>
              Không tìm thấy kết quả nào phù hợp
            </div>
            <div style={{ fontSize: 14 }}>
              Hãy thử tìm kiếm với từ khóa khác như "hành động", "tình cảm", "mới nhất"...
            </div>
          </div>
        )}

        {/* Netflix Card Grid */}
        <div style={gridContainerStyle}>
          {allTiles.map((tile) => {
            const isHovered = hoveredTileId === tile.id;
            const posterSrc = tile.posterPath
              ? getTmdbPosterUrl(tile.posterPath)
              : (tile.backdropPath ? getTmdbBackdropUrl(tile.backdropPath) : '');

            return (
              <div
                key={tile.id}
                style={{
                  position: 'relative',
                  aspectRatio: '16/9',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#222',
                  cursor: 'pointer',
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: isHovered ? '0 10px 25px rgba(0,0,0,0.85), 0 0 12px rgba(229,9,20,0.4)' : 'none',
                  border: isHovered ? '2px solid #e50914' : '1px solid rgba(255,255,255,0.06)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  zIndex: isHovered ? 10 : 1,
                }}
                onClick={() => handleTileClick(tile)}
                onMouseEnter={() => setHoveredTileId(tile.id)}
                onMouseLeave={() => setHoveredTileId(null)}
              >
                <img
                  src={posterSrc}
                  alt={tile.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />

                {/* Rating Badge Top Right */}
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(4px)',
                  color: '#46d369',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 3,
                }}>
                  {tile.rating}
                </div>

                {/* Bottom Title Bar */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '28px 10px 8px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#aaa', marginTop: 2 }}>
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
