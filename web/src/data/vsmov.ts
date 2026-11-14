import type { RowData, TileData } from '../state/slices/contentSlice';

export const VSMOV_API_BASE = 'https://vsmov.com/api';

export interface VsmovMovieItem {
  _id?: number | string;
  name: string;
  origin_name?: string;
  slug: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number | string;
  quality?: string;
  type?: string;
  tmdb?: {
    vote_average?: string | number;
    vote_count?: number;
  };
}

export interface VsmovDetailResponse {
  status: boolean | string;
  msg?: string;
  movie?: {
    _id: number | string;
    name: string;
    origin_name?: string;
    slug: string;
    content?: string;
    type?: string;
    status?: string;
    poster_url?: string;
    thumb_url?: string;
    trailer_url?: string;
    time?: string;
    episode_current?: string;
    episode_total?: string;
    quality?: string;
    lang?: string;
    year?: number | string;
    actor?: string[];
    director?: string[];
    category?: { id: string; name: string; slug: string }[];
    country?: { id: string; name: string; slug: string }[];
  };
  episodes?: {
    server_name: string;
    server_data: {
      name: string;
      slug: string;
      filename?: string;
      link_embed: string;
      link_m3u8?: string;
    }[];
  }[];
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterPath: string | null;
}

export interface Episode {
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  runtime: number | null;
  airDate: string | null;
  linkEmbed?: string;
}

const detailCache = new Map<string, VsmovDetailResponse>();

export function cleanHtml(html?: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

export function toTile(item: VsmovMovieItem): TileData {
  const yearVal = typeof item.year === 'number' ? item.year : parseInt(item.year || '2025', 10);
  const ratingStr = item.tmdb?.vote_average ? `${item.tmdb.vote_average} ★` : (item.quality || 'HD');
  const poster = item.poster_url || item.thumb_url || '';
  const backdrop = item.thumb_url || item.poster_url || '';

  return {
    id: `vsmov-${item._id || item.slug}`,
    title: item.name,
    year: yearVal || 2025,
    rating: ratingStr,
    genre: item.type === 'single' ? 'Phim Lẻ' : 'Phim Bộ',
    synopsis: item.origin_name || item.name,
    imageIndex: typeof item._id === 'number' ? item._id : 1,
    backdropPath: backdrop,
    posterPath: poster,
    tmdbId: typeof item._id === 'number' ? item._id : 1,
    mediaType: item.type === 'single' ? 'movie' : 'tv',
    slug: item.slug,
  };
}

export async function fetchVsmovList(path: string): Promise<TileData[]> {
  try {
    const res = await fetch(`${VSMOV_API_BASE}${path}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: VsmovMovieItem[] = data.items || [];
    return items.map(toTile);
  } catch (err) {
    console.error(`Error fetching Vsmov list for ${path}:`, err);
    return [];
  }
}

export interface RowConfig {
  title: string;
  url: string;
}

export const HOME_ROW_CONFIGS: RowConfig[] = [
  { title: 'Phim Mới Cập Nhật', url: '/danh-sach/phim-moi-cap-nhat?page=1' },
  { title: 'Phim Bộ Đang Hot', url: '/danh-sach/phim-bo?page=1' },
  { title: 'Phim Lẻ Đỉnh Cao', url: '/danh-sach/phim-le?page=1' },
  { title: 'Phim Hành Động', url: '/the-loai/hanh-dong?page=1' },
  { title: 'Phim Hàn Quốc', url: '/quoc-gia/han-quoc?page=1' },
  { title: 'Phim Việt Nam', url: '/quoc-gia/viet-nam?page=1' },
  { title: 'Phim Trung Quốc', url: '/quoc-gia/trung-quoc?page=1' },
  { title: 'Phim Hoạt Hình', url: '/the-loai/hoat-hinh?page=1' },
  { title: 'Khoa Học Viễn Tưởng', url: '/the-loai/khoa-hoc-vien-tuong?page=1' },
  { title: 'Phim Cổ Trang', url: '/the-loai/co-trang?page=1' },
  { title: 'Phim Kinh Dị', url: '/the-loai/kinh-di?page=1' },
  { title: 'Phim Hài Hước', url: '/the-loai/hai?page=1' },
];

const CACHE_PREFIX = 'hyhy_cache_vsmov_';

export function getCachedRows(pageKey: string): RowData[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${pageKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function saveCachedRows(pageKey: string, rows: RowData[]): void {
  try {
    if (rows && rows.length > 0) {
      localStorage.setItem(`${CACHE_PREFIX}${pageKey}`, JSON.stringify(rows));
    }
  } catch {
    // Ignore storage quota
  }
}

export async function fetchVsmovContent(): Promise<RowData[]> {
  const results = await Promise.all(
    HOME_ROW_CONFIGS.map(async (config, idx) => {
      try {
        const tiles = await fetchVsmovList(config.url);
        if (tiles.length === 0) return null;
        return {
          id: `vsmov-row-${idx}`,
          title: config.title,
          tiles,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is RowData => r !== null && r.tiles.length > 0);
}

export async function fetchVsmovContentProgressive(
  onUpdate: (rows: RowData[]) => void
): Promise<RowData[]> {
  // 1. Immediately return cached content if available
  const cached = getCachedRows('home');
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }

  // 2. Fetch the first row immediately for instant hero & first shelf
  try {
    const firstTiles = await fetchVsmovList(HOME_ROW_CONFIGS[0].url);
    if (firstTiles.length > 0) {
      const firstRow: RowData = {
        id: 'vsmov-row-0',
        title: HOME_ROW_CONFIGS[0].title,
        tiles: firstTiles,
      };
      if (!cached || cached.length === 0) {
        onUpdate([firstRow]);
      }
    }
  } catch (err) {
    console.warn('Initial shelf fetch error', err);
  }

  // 3. Fetch full content in background
  const fullRows = await fetchVsmovContent();
  if (fullRows.length > 0) {
    saveCachedRows('home', fullRows);
    onUpdate(fullRows);
    return fullRows;
  }

  if (cached && cached.length > 0) {
    return cached;
  }
  return [];
}

export async function fetchRowsFromConfigs(configs: RowConfig[]): Promise<RowData[]> {
  const results = await Promise.all(
    configs.map(async (config, idx) => {
      try {
        const tiles = await fetchVsmovList(config.url);
        if (tiles.length === 0) return null;
        return {
          id: `row-${idx}`,
          title: config.title,
          tiles,
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is RowData => r !== null && r.tiles.length > 0);
}

export async function fetchRowsFromConfigsProgressive(
  pageKey: string,
  configs: RowConfig[],
  onUpdate: (rows: RowData[]) => void
): Promise<RowData[]> {
  const cached = getCachedRows(pageKey);
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }

  if (configs.length > 0) {
    try {
      const firstTiles = await fetchVsmovList(configs[0].url);
      if (firstTiles.length > 0 && (!cached || cached.length === 0)) {
        onUpdate([{ id: 'row-0', title: configs[0].title, tiles: firstTiles }]);
      }
    } catch {
      // Continue to full fetch
    }
  }

  const fullRows = await fetchRowsFromConfigs(configs);
  if (fullRows.length > 0) {
    saveCachedRows(pageKey, fullRows);
    onUpdate(fullRows);
    return fullRows;
  }

  return cached || [];
}

export async function searchVsmov(query: string): Promise<RowData[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`${VSMOV_API_BASE}/tim-kiem?keyword=${encodeURIComponent(query)}&limit=24`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: VsmovMovieItem[] = data.items || [];
    const tiles = items.map(toTile);
    if (tiles.length === 0) return [];

    return [
      {
        id: 'search-results',
        title: `Kết quả tìm kiếm cho "${query}"`,
        tiles,
      },
    ];
  } catch {
    return [];
  }
}

export async function fetchVsmovDetail(slug: string): Promise<VsmovDetailResponse | null> {
  const cached = detailCache.get(slug);
  if (cached) return cached;

  try {
    const res = await fetch(`${VSMOV_API_BASE}/phim/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data: VsmovDetailResponse = await res.json();
    detailCache.set(slug, data);
    return data;
  } catch {
    return null;
  }
}

export async function fetchVsmovSeasons(slug: string): Promise<SeasonSummary[]> {
  const detail = await fetchVsmovDetail(slug);
  if (!detail || !detail.episodes || detail.episodes.length === 0) {
    return [];
  }

  return detail.episodes.map((ep, idx) => ({
    seasonNumber: idx + 1,
    name: ep.server_name.trim().replace(/\r?\n\s*/g, ' '),
    episodeCount: ep.server_data ? ep.server_data.length : 0,
    posterPath: detail.movie?.poster_url || null,
  }));
}

export async function fetchVsmovEpisodes(slug: string, serverIndex: number): Promise<Episode[]> {
  const detail = await fetchVsmovDetail(slug);
  if (!detail || !detail.episodes || !detail.episodes[serverIndex]) {
    return [];
  }

  const server = detail.episodes[serverIndex];
  return (server.server_data || []).map((ep, idx) => ({
    episodeNumber: idx + 1,
    name: `Tập ${ep.name}`,
    overview: `${detail.movie?.name || ''} - Tập ${ep.name}`,
    stillPath: detail.movie?.thumb_url || detail.movie?.poster_url || null,
    runtime: null,
    airDate: null,
    linkEmbed: ep.link_embed,
  }));
}

export function getCachedVsmovDetail(slug: string): VsmovDetailResponse | null {
  return detailCache.get(slug) ?? null;
}

export function extractYoutubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}
