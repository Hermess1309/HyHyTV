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

export const GENRES_ROW_CONFIGS: RowConfigItem[] = [
  {
    title: 'Phim Hành Động & Phiêu Lưu',
    kkphimUrl: '/v1/api/the-loai/hanh-dong?page=1&limit=24',
    vsmovUrl: '/the-loai/hanh-dong?page=1',
  },
  {
    title: 'Tình Cảm & Lãng Mạn',
    kkphimUrl: '/v1/api/the-loai/tinh-cam?page=1&limit=24',
    vsmovUrl: '/the-loai/tinh-cam?page=1',
  },
  {
    title: 'Phim Kinh Dị & Rùng Rợn',
    kkphimUrl: '/v1/api/the-loai/kinh-di?page=1&limit=24',
    vsmovUrl: '/the-loai/kinh-di?page=1',
  },
  {
    title: 'Hài Hước & Vui Nhộn',
    kkphimUrl: '/v1/api/the-loai/hai-huoc?page=1&limit=24',
    vsmovUrl: '/the-loai/hai?page=1',
  },
  {
    title: 'Anime & Hoạt Hình Tuyển Chọn',
    kkphimUrl: '/v1/api/danh-sach/hoat-hinh?page=1&limit=24',
    vsmovUrl: '/the-loai/hoat-hinh?page=1',
  },
  {
    title: 'Khoa Học Viễn Tưởng (Sci-Fi)',
    kkphimUrl: '/v1/api/the-loai/vien-tuong?page=1&limit=24',
    vsmovUrl: '/the-loai/khoa-hoc-vien-tuong?page=1',
  },
  {
    title: 'Cổ Trang & Tiên Hiệp',
    kkphimUrl: '/v1/api/the-loai/co-trang?page=1&limit=24',
    vsmovUrl: '/the-loai/co-trang?page=1',
  },
  {
    title: 'Tâm Lý & Chính Kịch',
    kkphimUrl: '/v1/api/the-loai/tam-ly?page=1&limit=24',
    vsmovUrl: '/the-loai/tam-ly?page=1',
  },
  {
    title: 'Võ Thuật & Kiếm Đạo',
    kkphimUrl: '/v1/api/the-loai/vo-thuat?page=1&limit=24',
    vsmovUrl: '/the-loai/vo-thuat?page=1',
  },
  {
    title: 'Hình Sự & Trinh Thám',
    kkphimUrl: '/v1/api/the-loai/hinh-su?page=1&limit=24',
    vsmovUrl: '/the-loai/hinh-su?page=1',
  },
];

export const COUNTRIES_ROW_CONFIGS: RowConfigItem[] = [
  {
    title: 'Phim Hàn Quốc Đặc Sắc',
    kkphimUrl: '/v1/api/quoc-gia/han-quoc?page=1&limit=24',
    vsmovUrl: '/quoc-gia/han-quoc?page=1',
  },
  {
    title: 'Phim Trung Quốc Tuyển Chọn',
    kkphimUrl: '/v1/api/quoc-gia/trung-quoc?page=1&limit=24',
    vsmovUrl: '/quoc-gia/trung-quoc?page=1',
  },
  {
    title: 'Phim Nhật Bản Được Yêu Thích',
    kkphimUrl: '/v1/api/quoc-gia/nhat-ban?page=1&limit=24',
    vsmovUrl: '/quoc-gia/nhat-ban?page=1',
  },
  {
    title: 'Phim Âu Mỹ & Hollywood Bom Tấn',
    kkphimUrl: '/v1/api/quoc-gia/au-my?page=1&limit=24',
    vsmovUrl: '/quoc-gia/au-my?page=1',
  },
  {
    title: 'Phim Thái Lan Đình Đám',
    kkphimUrl: '/v1/api/quoc-gia/thai-lan?page=1&limit=24',
    vsmovUrl: '/quoc-gia/thai-lan?page=1',
  },
  {
    title: 'Phim Việt Nam',
    kkphimUrl: '/v1/api/quoc-gia/viet-nam?page=1&limit=24',
    vsmovUrl: '/quoc-gia/viet-nam?page=1',
  },
  {
    title: 'Phim Đài Loan',
    kkphimUrl: '/v1/api/quoc-gia/dai-loan?page=1&limit=24',
    vsmovUrl: '/quoc-gia/dai-loan?page=1',
  },
  {
    title: 'Phim Ấn Độ / Bollywood',
    kkphimUrl: '/v1/api/quoc-gia/an-do?page=1&limit=24',
    vsmovUrl: '/quoc-gia/an-do?page=1',
  },
  {
    title: 'Phim Hồng Kông',
    kkphimUrl: '/v1/api/quoc-gia/hong-kong?page=1&limit=24',
    vsmovUrl: '/quoc-gia/hong-kong?page=1',
  },
];

export const TOP_MOVIES_ROW_CONFIGS: RowConfigItem[] = [
  {
    title: 'Top 10 Phim Thịnh Hành Hôm Nay',
    kkphimUrl: '/danh-sach/phim-moi-cap-nhat?page=1',
    vsmovUrl: '/danh-sach/phim-moi-cap-nhat?page=1',
  },
  {
    title: 'Top Phim Bộ Được Xem Nhiều Nhất',
    kkphimUrl: '/v1/api/danh-sach/phim-bo?page=1&limit=24',
    vsmovUrl: '/danh-sach/phim-bo?page=1',
  },
  {
    title: 'Top Phim Lẻ Đỉnh Cao 2026',
    kkphimUrl: '/v1/api/danh-sach/phim-le?page=1&limit=24',
    vsmovUrl: '/danh-sach/phim-le?page=1',
  },
  {
    title: 'Top Anime & Hoạt Hình Hot',
    kkphimUrl: '/v1/api/danh-sach/hoat-hinh?page=1&limit=24',
    vsmovUrl: '/the-loai/hoat-hinh?page=1',
  },
  {
    title: 'Top TV Shows Truyền Hình',
    kkphimUrl: '/v1/api/danh-sach/tv-shows?page=1&limit=24',
  },
];

export const TV_SHOWS_ROW_CONFIGS: RowConfigItem[] = [
  {
    title: 'Phim Bộ Mới Cập Nhật',
    kkphimUrl: '/v1/api/danh-sach/phim-bo?page=1&limit=24',
    vsmovUrl: '/danh-sach/phim-bo?page=1',
  },
  {
    title: 'Phim Bộ Hàn Quốc',
    kkphimUrl: '/v1/api/quoc-gia/han-quoc?page=1&limit=24',
    vsmovUrl: '/quoc-gia/han-quoc?page=1',
  },
  {
    title: 'Phim Bộ Trung Quốc',
    kkphimUrl: '/v1/api/quoc-gia/trung-quoc?page=1&limit=24',
    vsmovUrl: '/quoc-gia/trung-quoc?page=1',
  },
  {
    title: 'Phim Bộ Âu Mỹ',
    kkphimUrl: '/v1/api/quoc-gia/au-my?page=1&limit=24',
  },
  {
    title: 'Phim Bộ Cổ Trang',
    kkphimUrl: '/v1/api/the-loai/co-trang?page=1&limit=24',
  },
];

export const MOVIES_ROW_CONFIGS: RowConfigItem[] = [
  {
    title: 'Phim Lẻ Mới Nhất',
    kkphimUrl: '/v1/api/danh-sach/phim-le?page=1&limit=24',
    vsmovUrl: '/danh-sach/phim-le?page=1',
  },
  {
    title: 'Phim Chiếu Rạp Bom Tấn',
    kkphimUrl: '/v1/api/the-loai/hanh-dong?page=1&limit=24',
    vsmovUrl: '/the-loai/hanh-dong?page=1',
  },
  {
    title: 'Khoa Học Viễn Tưởng',
    kkphimUrl: '/v1/api/the-loai/vien-tuong?page=1&limit=24',
  },
  {
    title: 'Phim Kinh Dị & Rùng Rợn',
    kkphimUrl: '/v1/api/the-loai/kinh-di?page=1&limit=24',
  },
  {
    title: 'Phim Hài Hước',
    kkphimUrl: '/v1/api/the-loai/hai-huoc?page=1&limit=24',
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

export async function fetchUnifiedPageContentProgressive(
  pageId: string,
  onUpdate: (rows: RowData[]) => void
): Promise<RowData[]> {
  let configs: RowConfigItem[] = UNIFIED_HOME_ROW_CONFIGS;
  if (pageId === 'genres') configs = GENRES_ROW_CONFIGS;
  else if (pageId === 'countries') configs = COUNTRIES_ROW_CONFIGS;
  else if (pageId === 'topMovies') configs = TOP_MOVIES_ROW_CONFIGS;
  else if (pageId === 'tvShows') configs = TV_SHOWS_ROW_CONFIGS;
  else if (pageId === 'movies') configs = MOVIES_ROW_CONFIGS;

  const currentRows: RowData[] = [];

  // If home page and continue watching items exist, add them first!
  if (pageId === 'home') {
    const cwRow = getContinueWatchingRow();
    if (cwRow) {
      currentRows.push(cwRow);
      onUpdate([...currentRows]);
    }
  }

  // Fetch first shelf immediately for instant hero & top row
  try {
    const firstRow = await fetchUnifiedRow(configs[0], 0);
    if (firstRow) {
      currentRows.push(firstRow);
      onUpdate([...currentRows]);
    }
  } catch (err) {
    console.warn(`Error fetching first shelf for ${pageId}`, err);
  }

  // Progressively fetch remaining shelves in background
  const remaining = configs.slice(1);
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

export async function fetchUnifiedHomeContentProgressive(
  onUpdate: (rows: RowData[]) => void
): Promise<RowData[]> {
  return fetchUnifiedPageContentProgressive('home', onUpdate);
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

export interface UnifiedMovieDetail {
  title: string;
  synopsis: string;
  year?: number;
  rating?: string;
  genre?: string;
  actors?: string[];
  director?: string[];
  quality?: string;
  time?: string;
}

export async function fetchUnifiedDetail(slug: string): Promise<UnifiedMovieDetail | null> {
  if (!slug) return null;
  const cleanSlug = slug.replace(/^kk-/, '').replace(/^vsmov-/, '');
  try {
    const detail = await fetchKkphimDetail(cleanSlug);
    if (detail && detail.movie) {
      const raw = detail.movie.content || '';
      const cleanSynopsis = raw.replace(/<[^>]*>?/gm, '').trim();
      return {
        title: detail.movie.name,
        synopsis: cleanSynopsis || detail.movie.origin_name || detail.movie.name,
        year: detail.movie.year,
        rating: detail.movie.quality || 'FHD',
        genre: detail.movie.category?.map((c) => c.name).join(', ') || '',
        actors: detail.movie.actor,
        director: detail.movie.director,
        quality: detail.movie.quality,
        time: detail.movie.time,
      };
    }
  } catch {
    // fallback
  }
  return null;
}
