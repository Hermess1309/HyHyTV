import type { TileData } from '../state/slices/contentSlice';
import type { Episode } from './vsmov';

export const KKPHIM_API_BASE = 'https://phimapi.com';
export const KKPHIM_CDN_IMAGE = 'https://phimimg.com';

export function resolveKkphimImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${KKPHIM_CDN_IMAGE}${url}`;
  return `${KKPHIM_CDN_IMAGE}/${url}`;
}

export interface KkphimItem {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number | string;
  quality?: string;
  lang?: string;
  type?: string;
  time?: string;
  episode_current?: string;
  tmdb?: {
    id?: string | number;
    vote_average?: number;
    type?: string;
  };
}

export function toTileFromKkphim(item: KkphimItem): TileData {
  const yearVal = typeof item.year === 'number' ? item.year : parseInt(String(item.year || '2026'), 10);
  const ratingStr = item.tmdb?.vote_average
    ? `${item.tmdb.vote_average.toFixed(1)} ★`
    : (item.quality || 'FHD');

  const poster = resolveKkphimImageUrl(item.poster_url || item.thumb_url);
  const backdrop = resolveKkphimImageUrl(item.thumb_url || item.poster_url);

  let genre = 'Phim Lẻ';
  if (item.type === 'series') genre = 'Phim Bộ';
  else if (item.type === 'hoathinh') genre = 'Hoạt Hình';
  else if (item.type === 'tvshows') genre = 'TV Shows';

  return {
    id: `kk-${item.slug}`,
    title: item.name,
    year: yearVal || 2026,
    rating: ratingStr,
    genre,
    synopsis: item.origin_name || item.name,
    imageIndex: 1,
    backdropPath: backdrop,
    posterPath: poster,
    mediaType: item.type === 'series' || item.type === 'tvshows' ? 'tv' : 'movie',
    slug: item.slug,
  };
}

export async function fetchKkphimList(path: string): Promise<TileData[]> {
  try {
    const fullUrl = path.startsWith('http') ? path : `${KKPHIM_API_BASE}${path}`;
    const res = await fetch(fullUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const items: KkphimItem[] = data.data?.items || data.items || [];
    return items.map(toTileFromKkphim);
  } catch (err) {
    console.warn(`Error fetching KKPhim list for ${path}:`, err);
    return [];
  }
}

export async function searchKkphim(keyword: string, limit = 24): Promise<TileData[]> {
  try {
    const cleanKw = keyword.trim();
    if (!cleanKw) return [];
    const url = `${KKPHIM_API_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(cleanKw)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items: KkphimItem[] = data.data?.items || data.items || [];
    return items.map(toTileFromKkphim);
  } catch (err) {
    console.warn(`Error searching KKPhim for ${keyword}:`, err);
    return [];
  }
}

export interface KkphimDetailResponse {
  status: boolean;
  msg?: string;
  movie?: {
    _id: string;
    name: string;
    slug: string;
    origin_name?: string;
    content?: string;
    type?: string;
    status?: string;
    poster_url?: string;
    thumb_url?: string;
    trailer_url?: string;
    time?: string;
    episode_current?: string;
    episode_total?: number | string;
    quality?: string;
    lang?: string;
    year?: number;
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

const kkDetailCache = new Map<string, KkphimDetailResponse>();

export async function fetchKkphimDetail(slug: string): Promise<KkphimDetailResponse | null> {
  if (kkDetailCache.has(slug)) {
    return kkDetailCache.get(slug)!;
  }
  try {
    const res = await fetch(`${KKPHIM_API_BASE}/phim/${slug}`);
    if (!res.ok) return null;
    const data: KkphimDetailResponse = await res.json();
    if (data && data.movie) {
      kkDetailCache.set(slug, data);
      return data;
    }
  } catch (err) {
    console.warn(`Error fetching KKPhim detail for ${slug}:`, err);
  }
  return null;
}

export async function fetchKkphimEpisodes(slug: string, serverIndex = 0): Promise<Episode[]> {
  const detail = await fetchKkphimDetail(slug);
  if (!detail || !detail.episodes || detail.episodes.length === 0) {
    return [];
  }

  const server = detail.episodes[serverIndex] || detail.episodes[0];
  const list = server?.server_data || [];

  return list.map((item, idx) => ({
    episodeNumber: idx + 1,
    name: item.name.startsWith('Tập') ? item.name : `Tập ${item.name}`,
    overview: item.filename || `${detail.movie?.name || 'Phim'} - ${item.name}`,
    stillPath: resolveKkphimImageUrl(detail.movie?.thumb_url || detail.movie?.poster_url),
    runtime: null,
    airDate: null,
    linkEmbed: item.link_m3u8 || item.link_embed,
  }));
}

// Recommended Studio Ghibli collection (matches user's photo)
export const GHIBLI_RECOMMENDED_TILES: TileData[] = [
  {
    id: 'kk-lau-dai-bay-cua-phap-su-howl',
    title: "Howl's Moving Castle",
    year: 2004,
    rating: '8.4 ★',
    genre: 'Hoạt Hình',
    synopsis: "Howl's Moving Castle (Lâu Đài Bay Của Pháp Sư Howl)",
    imageIndex: 1,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/eb28e9a65962771b85a43027ba23acde.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/8bbee2ba76227b88764a507b0c6f3fcf.jpg',
    mediaType: 'movie',
    slug: 'lau-dai-bay-cua-phap-su-howl',
  },
  {
    id: 'kk-vung-dat-linh-hon',
    title: 'Spirited Away',
    year: 2001,
    rating: '8.6 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Vùng Đất Linh Hồn (Spirited Away)',
    imageIndex: 2,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/cdd1c3fa96086f48519393cc1ad98f7e.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/3be680dcb8b627540ea2703730db511f.jpg',
    mediaType: 'movie',
    slug: 'vung-dat-linh-hon',
  },
  {
    id: 'kk-co-be-nguoi-ca-ponyo',
    title: 'Ponyo',
    year: 2008,
    rating: '7.8 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Cô Bé Người Cá Ponyo',
    imageIndex: 3,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/9efec7674c1daadc7c82f2591a92e369.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/13af41ce65794c875c73fbb8d90bcca1.jpg',
    mediaType: 'movie',
    slug: 'co-be-nguoi-ca-ponyo',
  },
  {
    id: 'kk-thieu-nien-va-chim-diec',
    title: 'Thiếu Niên Và Chim Diệc',
    year: 2023,
    rating: '7.6 ★',
    genre: 'Hoạt Hình',
    synopsis: 'The Boy and the Heron',
    imageIndex: 4,
    posterPath: 'https://phimimg.com/upload/vod/20240625-1/da7dceada71c21e7e3a4f8131217252b.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20240625-1/b39f92dc9895f89d4a9e085920e38255.jpg',
    mediaType: 'movie',
    slug: 'thieu-nien-va-chim-diec',
  },
  {
    id: 'kk-loi-thi-tham',
    title: 'Whisper of the Heart',
    year: 1995,
    rating: '7.9 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Lời Thì Thầm Của Trái Tim',
    imageIndex: 5,
    posterPath: 'https://phimimg.com/uploads/movies/20260904/loi-thi-tham-poster.webp',
    backdropPath: 'https://phimimg.com/uploads/movies/20260904/loi-thi-tham-thumb.webp',
    mediaType: 'movie',
    slug: 'loi-thi-tham',
  },
  {
    id: 'kk-mo-dom-dom',
    title: 'Mộ Đom Đóm',
    year: 1988,
    rating: '8.5 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Grave of the Fireflies',
    imageIndex: 6,
    posterPath: 'https://phimimg.com/upload/vod/20250907-1/029dbce2d9baca1c1c8cdd0ea0108e16.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250907-1/bd0c692102c0ed564ffce84f19f100a9.jpg',
    mediaType: 'movie',
    slug: 'mo-dom-dom',
  },
  {
    id: 'kk-chu-heo-mau-do',
    title: 'Porco Rosso',
    year: 1992,
    rating: '7.7 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Chú Heo Màu Đỏ (Porco Rosso)',
    imageIndex: 7,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/8589484a6d5a9d8e8d9ef86c4ee6f82d.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/870fccf52a4451b592279c0cbdc87afe.jpg',
    mediaType: 'movie',
    slug: 'chu-heo-mau-do',
  },
  {
    id: 'kk-hang-xom-cua-toi-la-totoro',
    title: 'My Neighbor Totoro',
    year: 1988,
    rating: '8.1 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Hàng Xóm Của Tôi Là Totoro',
    imageIndex: 8,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/955eea6529face73697d1a49494fee79.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/0106ac6b04c1c11d8a83991fbf87714d.jpg',
    mediaType: 'movie',
    slug: 'hang-xom-cua-toi-la-totoro',
  },
  {
    id: 'kk-the-gioi-bi-mat-cua-arrietty',
    title: 'The Secret World of Arrietty',
    year: 2010,
    rating: '7.7 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Thế Giới Bí Mật Của Arrietty',
    imageIndex: 9,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/efd29635af493b8dbc25c755411a2124.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/1ce9dc805194c983d2db1605b1ae4f7c.jpg',
    mediaType: 'movie',
    slug: 'the-gioi-bi-mat-cua-arrietty',
  },
  {
    id: 'kk-vuong-quoc-cua-giac-mo-va-su-dien-ro',
    title: 'The Kingdom of Dreams and Madness',
    year: 2013,
    rating: '7.7 ★',
    genre: 'Tài Liệu',
    synopsis: 'Vương Quốc Của Giấc Mơ Và Sự Điên Rồ',
    imageIndex: 10,
    posterPath: 'https://phimimg.com/uploads/movies/20260919/vuong-quoc-cua-giac-mo-va-su-dien-ro-poster.webp',
    backdropPath: 'https://phimimg.com/uploads/movies/20260919/vuong-quoc-cua-giac-mo-va-su-dien-ro-thumb.webp',
    mediaType: 'movie',
    slug: 'vuong-quoc-cua-giac-mo-va-su-dien-ro',
  },
  {
    id: 'kk-chien-binh-anh-sang-teo',
    title: 'Chiến Binh Ánh Sáng TEO',
    year: 2026,
    rating: '10.0 ★',
    genre: 'Phim Bộ',
    synopsis: 'Ultraman Teo',
    imageIndex: 11,
    posterPath: 'https://phimimg.com/uploads/movies/20260708/chien-binh-anh-sang-teo-poster.webp',
    backdropPath: 'https://phimimg.com/uploads/movies/20260708/chien-binh-anh-sang-teo-thumb.webp',
    mediaType: 'tv',
    slug: 'chien-binh-anh-sang-teo',
  },
  {
    id: 'kk-luc-do-toi-da-chuyen-sinh-thanh-slime-phan-4',
    title: 'Chuyển Sinh Thành Slime (Phần 4)',
    year: 2026,
    rating: '8.4 ★',
    genre: 'Hoạt Hình',
    synopsis: 'That Time I Got Reincarnated As A Slime',
    imageIndex: 12,
    posterPath: 'https://phimimg.com/upload/vod/20260407-1/ab90a78161fa03e2b3f48f84bf250d05.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20260406-1/26f4b114b4e3d0ac0bba2f6687131a3c.jpg',
    mediaType: 'tv',
    slug: 'luc-do-toi-da-chuyen-sinh-thanh-slime-phan-4',
  },
];
