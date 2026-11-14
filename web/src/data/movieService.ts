import type { RowData, TileData } from '../state/slices/contentSlice';
import {
  fetchKkphimList,
  searchKkphim,
  fetchKkphimEpisodes,
  fetchKkphimDetail,
  GHIBLI_RECOMMENDED_TILES,
} from './kkphim';

export { GHIBLI_RECOMMENDED_TILES };
import { fetchVsmovList, searchVsmov, fetchVsmovEpisodes, fetchVsmovSeasons, type SeasonSummary } from './vsmov';
import { getContinueWatching } from './continueWatching';

export interface RowConfigItem {
  title: string;
  kkphimUrl?: string;
  vsmovUrl?: string;
}

export const UNIFIED_HOME_ROW_CONFIGS: RowConfigItem[] = [
  {
    title: 'Phim Mới Cập Nhật',
    kkphimUrl: '/danh-sach/phim-moi-cap-nhat?page=1',
    vsmovUrl: '/danh-sach/phim-moi-cap-nhat?page=1',
  },
  {
    title: 'Phim Bộ Đang Hot',
    kkphimUrl: '/v1/api/danh-sach/phim-bo?page=1&limit=24',
    vsmovUrl: '/danh-sach/phim-bo?page=1',
  },
  {
    title: 'Phim Lẻ Đỉnh Cao',
    kkphimUrl: '/v1/api/danh-sach/phim-le?page=1&limit=24',
    vsmovUrl: '/danh-sach/phim-le?page=1',
  },
  {
    title: 'Anime & Hoạt Hình Tuyển Chọn',
    kkphimUrl: '/v1/api/danh-sach/hoat-hinh?page=1&limit=24',
    vsmovUrl: '/the-loai/hoat-hinh?page=1',
  },
  {
    title: 'Phim Hành Động Đặc Sắc',
    kkphimUrl: '/v1/api/the-loai/hanh-dong?page=1&limit=24',
    vsmovUrl: '/the-loai/hanh-dong?page=1',
  },
  {
    title: 'Phim Hàn Quốc Được Yêu Thích',
    kkphimUrl: '/v1/api/quoc-gia/han-quoc?page=1&limit=24',
    vsmovUrl: '/quoc-gia/han-quoc?page=1',
  },
  {
    title: 'Phim Trung Quốc Hot',
    kkphimUrl: '/v1/api/quoc-gia/trung-quoc?page=1&limit=24',
    vsmovUrl: '/quoc-gia/trung-quoc?page=1',
  },
  {
    title: 'Phim Cổ Trang & Tiên Hiệp',
    kkphimUrl: '/v1/api/the-loai/co-trang?page=1&limit=24',
    vsmovUrl: '/the-loai/co-trang?page=1',
  },
  {
    title: 'Khoa Học Viễn Tưởng',
    kkphimUrl: '/v1/api/the-loai/vien-tuong?page=1&limit=24',
    vsmovUrl: '/the-loai/khoa-hoc-vien-tuong?page=1',
  },
  {
    title: 'Phim Kinh Dị & Giật Gân',
    kkphimUrl: '/v1/api/the-loai/kinh-di?page=1&limit=24',
    vsmovUrl: '/the-loai/kinh-di?page=1',
  },
  {
    title: 'TV Shows & Truyền Hình',
    kkphimUrl: '/v1/api/danh-sach/tv-shows?page=1&limit=24',
  },
];

export function getContinueWatchingRow(): RowData | null {
  const list = getContinueWatching();
  if (!list || list.length === 0) return null;

  const tiles: TileData[] = list.map((item) => ({
    id: `cw-${item.slug}`,
    title: item.title,
    year: 2026,
    rating: item.episodeName || 'Đang xem',
    genre: item.mediaType === 'tv' ? 'Phim Bộ' : 'Phim Lẻ',
    synopsis: `${item.title} - ${item.episodeName || ''}`,
    imageIndex: 1,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath || item.posterPath,
    mediaType: item.mediaType,
    slug: item.slug,
    progress: item.progress,
    episodeName: item.episodeName,
  }));

  return {
    id: 'row-continue-watching',
    title: 'Tiếp Tục Xem Cho Bạn',
    tiles,
  };
}

export async function fetchUnifiedRow(config: RowConfigItem, idx: number): Promise<RowData | null> {
  let tiles: TileData[] = [];
  if (config.kkphimUrl) {
    tiles = await fetchKkphimList(config.kkphimUrl);
  }
  if (tiles.length === 0 && config.vsmovUrl) {
    tiles = await fetchVsmovList(config.vsmovUrl);
  }
  if (tiles.length === 0) return null;

  return {
    id: `unified-row-${idx}`,
    title: config.title,
    tiles,
  };
}

export async function fetchUnifiedHomeContentProgressive(
  onUpdate: (rows: RowData[]) => void
): Promise<RowData[]> {
  const currentRows: RowData[] = [];

  // 1. If continue watching items exist, add them first!
  const cwRow = getContinueWatchingRow();
  if (cwRow) {
    currentRows.push(cwRow);
    onUpdate([...currentRows]);
  }

  // 2. Fetch first shelf immediately for instant hero & top row
  try {
    const firstRow = await fetchUnifiedRow(UNIFIED_HOME_ROW_CONFIGS[0], 0);
    if (firstRow) {
      currentRows.push(firstRow);
      onUpdate([...currentRows]);
    }
  } catch (err) {
    console.warn('Error fetching first shelf', err);
  }

  // 3. Progressively fetch remaining shelves in background
  const remaining = UNIFIED_HOME_ROW_CONFIGS.slice(1);
  for (let i = 0; i < remaining.length; i++) {
    try {
      const row = await fetchUnifiedRow(remaining[i], i + 1);
      if (row) {
        currentRows.push(row);
        onUpdate([...currentRows]);
      }
    } catch {
      // Continue next row
    }
  }

  return currentRows;
}

export async function searchUnifiedMovies(query: string): Promise<TileData[]> {
  const clean = query.trim();
  if (!clean) return GHIBLI_RECOMMENDED_TILES;

  // Search KKPhim
  const kkResults = await searchKkphim(clean, 24);

  // If query is short or kkResults < 12, also fetch from VSMOV to combine
  let vsmovResults: TileData[] = [];
  if (kkResults.length < 12) {
    try {
      const vsmovRows = await searchVsmov(clean);
      vsmovResults = vsmovRows.flatMap((r) => r.tiles);
    } catch {
      // ignore
    }
  }

  // Deduplicate by slug and title
  const seenSlugs = new Set<string>();
  const combined: TileData[] = [];

  for (const item of [...kkResults, ...vsmovResults]) {
    const key = (item.slug || item.title).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenSlugs.has(key)) {
      seenSlugs.add(key);
      combined.push(item);
    }
  }

  return combined;
}

export async function fetchUnifiedSeasons(slug: string): Promise<SeasonSummary[]> {
  try {
    const detail = await fetchKkphimDetail(slug);
    if (detail && detail.episodes && detail.episodes.length > 0) {
      return detail.episodes.map((s, idx) => ({
        seasonNumber: idx + 1,
        name: s.server_name || `Server ${idx + 1}`,
        episodeCount: s.server_data.length,
        posterPath: null,
      }));
    }
  } catch {
    // fallback
  }

  try {
    const vsmovSeasons = await fetchVsmovSeasons(slug);
    if (vsmovSeasons && vsmovSeasons.length > 0) return vsmovSeasons;
  } catch {
    // fallback
  }

  return [];
}

export async function fetchUnifiedEpisodes(slug: string, seasonIdx = 0): Promise<any[]> {
  // Try KKPhim first
  try {
    const kkEps = await fetchKkphimEpisodes(slug, seasonIdx);
    if (kkEps && kkEps.length > 0) {
      return kkEps;
    }
  } catch {
    // fallback
  }

  // Fallback to VSMOV
  try {
    const vsmovEps = await fetchVsmovEpisodes(slug, seasonIdx);
    if (vsmovEps && vsmovEps.length > 0) {
      return vsmovEps;
    }
  } catch {
    // fallback
  }

  return [];
}
