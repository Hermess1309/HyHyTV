import { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { theme } from '../styles/theme';
import { shellStyles } from '../styles/componentStyles/shellStyles';
import { selectRows, selectFocus, selectActivePage, selectNavFocused, selectHeroFocused } from '../state/selectors';
import { ContentRow } from './ContentRow';
import { HeroBanner } from './HeroBanner';
import { DetailOverlay } from './DetailOverlay';
import { NavBar } from './NavBar';
import { MobileNavBar } from './MobileNavBar';
import { SearchPage } from './SearchPage';
import { MyListPage } from './MyListPage';
import { SettingsPage } from './settings/SettingsPage';
import { PerformanceHUD } from './PerformanceHUD';
import { WelcomeModal } from './WelcomeModal';
import { useResponsive } from '../hooks/useResponsive';
import { ROW_BUFFER } from '../utils/constants';
import { useIsTvMode } from '../hooks/useMode';
import { useSettings } from '../hooks/useSettings';
import { useDispatch } from 'react-redux';
import { setActivePage } from '../state/slices/uiSlice';

const HERO_SLOT_HEIGHT = '60vh';

export function Shell() {
  const rows = useSelector(selectRows);
  const focus = useSelector(selectFocus);
  const activePage = useSelector(selectActivePage);
  const navFocused = useSelector(selectNavFocused);
  const heroFocused = useSelector(selectHeroFocused);
  const shellRef = useRef<HTMLDivElement>(null);
  const isTv = useIsTvMode();
  const { isMobile } = useResponsive();
  const settings = useSettings();
  const dispatch = useDispatch();

  const isSearch = activePage === 'search';
  const isMyList = activePage === 'myList';
  const isSettings = activePage === 'settings';

  // If My List is disabled and user is on it, bounce them home
  useEffect(() => {
    if (isMyList && settings.disableMyList) {
      dispatch(setActivePage('home'));
    }
  }, [isMyList, settings.disableMyList, dispatch]);

  // Vertical scroll offset (TV mode only)
  const rowHeight = theme.tile.height + 40 + theme.spacing.rowGap;
  const targetOffset = (isTv && !isSearch && !isMyList && !heroFocused && focus.rowIndex >= 0)
    ? Math.max(0, focus.rowIndex) * rowHeight
    : 0;

  const [webScrolled, setWebScrolled] = useState(false);
  useEffect(() => {
    if (isTv) return;
    const handleScroll = () => {
      setWebScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isTv]);

  const isScrolledTv = !navFocused && !heroFocused && focus.rowIndex > 0;
  const isScrolled = isTv ? isScrolledTv : webScrolled;

  // --- Web mode: simple layout ---
  if (!isTv) {
    return (
      <div ref={shellRef} style={shellStyles.webShell} aria-label="Content browser">
        {!isMobile && <NavBar isScrolled={isScrolled} />}
        {isSearch ? (
          <div style={{ paddingTop: isMobile ? 0 : theme.spacing.headerHeight }}>
            <SearchPage />
          </div>
        ) : isMyList ? (
          <MyListPage />
        ) : isSettings ? (
          <SettingsPage />
        ) : (
          <>
            {!isMobile && <HeroBanner />}
            {isMobile && <div style={{ height: 8 }} />}
            {rows.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#aaa', gap: 16 }}>
                <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 16, fontFamily: theme.typography.fontFamily }}>Đang tải danh sách phim...</span>
              </div>
            ) : (
              <div style={isMobile ? shellStyles.mobileRowsContainer : shellStyles.webRowsContainer}>
                {rows.map((row, idx) => (
                  <ContentRow key={row.id} row={row} rowIndex={idx} />
                ))}
              </div>
            )}
          </>
        )}
        <DetailOverlay />
        <PerformanceHUD />
        {isMobile && <MobileNavBar />}
        {/* Bottom padding for mobile nav bar */}
        {isMobile && <div style={{ height: 64 }} />}
      </div>
    );
  }

  // --- TV mode: engine-driven layout ---
  return (
    <div ref={shellRef} style={shellStyles.shell} role="grid" aria-label="Content browser">
      <NavBar isScrolled={isScrolled} />
      {isSearch ? (
        <SearchPage />
      ) : isMyList ? (
        <MyListPage />
      ) : isSettings ? (
        <SettingsPage />
      ) : (
        <>
          {rows.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#aaa', gap: 16 }}>
              <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 16, fontFamily: theme.typography.fontFamily }}>Đang tải danh sách phim...</span>
            </div>
          ) : (
            <>
              <div style={{ height: HERO_SLOT_HEIGHT, overflow: 'hidden', flexShrink: 0 }}>
                <HeroBanner />
              </div>
              <div style={shellStyles.scrollContainer(targetOffset)}>
                <div style={shellStyles.rowsContainer(rows.length * rowHeight)}>
                  {(() => {
                    const anchorRow = (heroFocused || navFocused) ? 0 : focus.rowIndex;
                    const startRow = Math.max(0, anchorRow - ROW_BUFFER);
                    const endRow = Math.min(rows.length - 1, anchorRow + ROW_BUFFER + ((heroFocused || navFocused) ? 2 : 0));

                    return rows.slice(startRow, endRow + 1).map((row, i) => {
                      const idx = startRow + i;
                      return (
                        <div key={row.id} style={shellStyles.rowWrapper(idx * rowHeight)}>
                          <ContentRow row={row} rowIndex={idx} />
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </>
          )}
        </>
      )}
      <DetailOverlay />
      <PerformanceHUD />
      <WelcomeModal />
    </div>
  );
}
