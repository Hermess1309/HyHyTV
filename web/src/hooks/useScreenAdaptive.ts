import { useState, useEffect, useCallback } from 'react';

export type ScreenFitMode = 'auto' | 'fit' | 'compact' | 'large';

export interface ScreenAdaptiveState {
  width: number;
  height: number;
  aspectRatio: number;
  resolutionName: string;
  isWide: boolean;
  isClassic: boolean;
  scale: number;
  tileWidth: number;
  tileHeight: number;
  edgePadding: number;
  headerHeight: number;
  screenFitMode: ScreenFitMode;
  setScreenFitMode: (mode: ScreenFitMode) => void;
}

const STORAGE_KEY = 'hyhy_screen_fit_mode';

function getSavedFitMode(): ScreenFitMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ScreenFitMode | null;
    if (saved && ['auto', 'fit', 'compact', 'large'].includes(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'auto';
}

export function computeScreenAdaptive(fitMode: ScreenFitMode = 'auto'): Omit<ScreenAdaptiveState, 'screenFitMode' | 'setScreenFitMode'> {
  const width = typeof window !== 'undefined' ? (window.innerWidth || 1920) : 1920;
  const height = typeof window !== 'undefined' ? (window.innerHeight || 1080) : 1080;
  const aspectRatio = height > 0 ? width / height : 1.7778;

  // Determine resolution category
  let resolutionName = '1080p FHD';
  if (width >= 3200 || height >= 1800) {
    resolutionName = '4K UHD';
  } else if (width >= 2400 || height >= 1350) {
    resolutionName = '2K QHD';
  } else if (width <= 1366 && height <= 768) {
    resolutionName = '720p HD';
  }

  const isWide = aspectRatio >= 2.1;
  const isClassic = aspectRatio <= 1.55;

  // Compute baseline scale based on 1920x1080 standard TV
  // Clamp scale between 0.8 (for 720p) and 1.35 (for 4K)
  const baseScale = Math.min(width / 1920, height / 1080);
  let scale = Math.max(0.8, Math.min(1.35, baseScale));

  // User fit mode modifier
  switch (fitMode) {
    case 'compact':
      scale *= 0.88;
      break;
    case 'large':
      scale *= 1.15;
      break;
    case 'fit':
      // Overscan safe area reduction (~95% screen bounds)
      scale *= 0.94;
      break;
    case 'auto':
    default:
      break;
  }

  // Dynamic Tile dimensions (strictly 16:9 ratio)
  // At 1080p, tile is approx 230 x 130
  // At 720p, tile scales down to approx 190 x 107
  // At 4K, tile scales up to approx 290 x 163
  const tileWidth = Math.round(230 * scale);
  const tileHeight = Math.round(tileWidth * (9 / 16));

  // Dynamic Edge padding (with safe area protection for TV bezels)
  const basePadding = fitMode === 'fit' ? 68 : 52;
  const edgePadding = Math.round(Math.max(28, Math.min(80, basePadding * scale)));

  // Dynamic Header height
  const headerHeight = Math.round(Math.max(54, Math.min(84, 68 * scale)));

  return {
    width,
    height,
    aspectRatio,
    resolutionName,
    isWide,
    isClassic,
    scale,
    tileWidth,
    tileHeight,
    edgePadding,
    headerHeight,
  };
}

export function useScreenAdaptive(): ScreenAdaptiveState {
  const [fitMode, setFitModeState] = useState<ScreenFitMode>(getSavedFitMode);
  const [metrics, setMetrics] = useState(() => computeScreenAdaptive(getSavedFitMode()));

  const updateMetrics = useCallback(() => {
    const next = computeScreenAdaptive(fitMode);
    setMetrics(next);

    // Apply CSS custom properties to document root for seamless global reactive styling
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--hyhy-screen-width', `${next.width}px`);
      root.style.setProperty('--hyhy-screen-height', `${next.height}px`);
      root.style.setProperty('--hyhy-ui-scale', `${next.scale}`);
      root.style.setProperty('--hyhy-tile-width', `${next.tileWidth}px`);
      root.style.setProperty('--hyhy-tile-height', `${next.tileHeight}px`);
      root.style.setProperty('--hyhy-edge-padding', `${next.edgePadding}px`);
      root.style.setProperty('--hyhy-header-height', `${next.headerHeight}px`);
      root.style.setProperty('--hyhy-resolution-name', next.resolutionName);
    }
  }, [fitMode]);

  const setScreenFitMode = useCallback((mode: ScreenFitMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    setFitModeState(mode);
  }, []);

  useEffect(() => {
    updateMetrics();
    window.addEventListener('resize', updateMetrics);
    window.addEventListener('orientationchange', updateMetrics);
    return () => {
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', updateMetrics);
    };
  }, [updateMetrics]);

  return {
    ...metrics,
    screenFitMode: fitMode,
    setScreenFitMode,
  };
}
