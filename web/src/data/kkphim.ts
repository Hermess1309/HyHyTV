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
  const cleanSlug = (slug || '').replace(/^kk-/, '').replace(/^vsmov-/, '').trim();
  if (!cleanSlug) return null;
  if (kkDetailCache.has(cleanSlug)) {
    return kkDetailCache.get(cleanSlug)!;
  }
  try {
    const res = await fetch(`${KKPHIM_API_BASE}/phim/${cleanSlug}`);
    if (!res.ok) return null;
    const data: KkphimDetailResponse = await res.json();
    if (data && data.movie) {
      kkDetailCache.set(cleanSlug, data);
      return data;
    }
  } catch (err) {
    console.warn(`Error fetching KKPhim detail for ${cleanSlug}:`, err);
  }
  return null;
}

export async function fetchKkphimEpisodes(slug: string, serverIndex = 0): Promise<Episode[]> {
  const cleanSlug = (slug || '').replace(/^kk-/, '').replace(/^vsmov-/, '').trim();
  const detail = await fetchKkphimDetail(cleanSlug);
  if (!detail || !detail.episodes || detail.episodes.length === 0) {
    return [];
  }

  const server = detail.episodes[serverIndex] || detail.episodes[0];
  const list = server?.server_data || [];

  // Guarantee stable ascending sort by episode number (Tập 1, 2, 3...)
  const sortedList = [...list].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.name.replace(/\D/g, '') || '0', 10);
    if (numA && numB && numA !== numB) {
      return numA - numB;
    }
    return 0;
  });

  return sortedList.map((item, idx) => ({
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
    synopsis: "Sophie, một cô thợ làm mũ trầm lặng, bị một phù thủy độc ác nguyền rủa biến thành bà lão 90 tuổi. Cô bắt đầu cuộc hành trình và tìm đến Lâu đài bay kỳ diệu của pháp sư Howl bí ẩn.",
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
    synopsis: 'Cô bé Chihiro 10 tuổi lạc vào thế giới linh hồn đầy ma thuật sau khi cha mẹ bị biến thành heo. Cô phải dũng cảm làm việc tại nhà tắm công cộng của phù thủy Yubaba để tìm cách cứu cha mẹ.',
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
    synopsis: 'Ponyo, một cô bé người cá tò mò, khao khát trở thành con người sau khi kết bạn với cậu bé Sosuke 5 tuổi trên bờ biển, mang đến câu chuyện thần tiên rực rỡ sắc màu.',
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
    synopsis: 'Mahito, một cậu bé đau buồn vì mất mẹ sau chiến tranh, chuyển về vùng nông thôn và bước vào tòa tháp bí ẩn dẫn tới một thế giới kỳ ảo nơi sự sống và cái chết cùng tồn tại.',
    imageIndex: 4,
    posterPath: 'https://phimimg.com/upload/vod/20240625-1/da7dceada71c21e7e3a4f8131217252b.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20240625-1/b39f92dc9895f89d4a9e085920e38255.jpg',
    mediaType: 'movie',
    slug: 'thieu-nien-va-chim-diec',
  },
  {
    id: 'kk-loi-thi-tham-cua-trai-tim',
    title: 'Whisper of the Heart',
    year: 1995,
    rating: '7.9 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Shizuku, một nữ sinh yêu sách, phát hiện ra tất cả thẻ thư viện sách cô mượn đều từng có tên chàng trai Seiji Amasawa. Tình cảm thanh xuân trong sáng đã tiếp lửa cho ước mơ của cả hai.',
    imageIndex: 5,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/75eb0f6538f59924a3df834a692d6ca9.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/ad2c58ddccbbde919d1081c9d64965c1.jpg',
    mediaType: 'movie',
    slug: 'loi-thi-tham-cua-trai-tim',
  },
  {
    id: 'kk-mo-dom-dom',
    title: 'Mộ Đom Đóm',
    year: 1988,
    rating: '8.5 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Kiệt tác đầy nước mắt khắc họa tình cảm thiêng liêng giữa người anh trai Seita và cô em gái nhỏ Setsuko trong những ngày tháng khốc liệt của Thế chiến thứ hai tại Nhật Bản.',
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
    synopsis: 'Marco Pagot, một cựu phi công thời Thế chiến I bị biến thành chú heo, trở thành thợ săn tiền thưởng tự do trên vùng trời biển Adriatic lãng mạn.',
    imageIndex: 7,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/8589484a6d5a9d8e8d9ef86c4ee6f82d.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/870fccf52a4451b592279c0cbdc87afe.jpg',
    mediaType: 'movie',
    slug: 'chu-heo-mau-do',
  },
  {
    id: 'kk-gio-noi',
    title: 'The Wind Rises',
    year: 2013,
    rating: '8.1 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Jiro Horikoshi nuôi dưỡng ước mơ cả đời về bầu trời và thiết kế những chiếc máy bay tuyệt đẹp, bên cạnh câu chuyện tình lãng mạn đầy cảm xúc với Naoko.',
    imageIndex: 8,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/582dea5da84b31f0f37b74ec627ffe7b.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/2dc44d6b6239296df0e3021595fd91bd.jpg',
    mediaType: 'movie',
    slug: 'gio-noi',
  },
  {
    id: 'kk-chuyen-cong-chua-kaguya',
    title: 'The Tale of the Princess Kaguya',
    year: 2013,
    rating: '8.0 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Được tìm thấy trong một thân tre phát sáng, cô bé tí hon nhanh chóng lớn lên thành nàng công chúa kiều diễm nhưng mang trong mình định mệnh xa xôi bí ẩn.',
    imageIndex: 9,
    posterPath: 'https://phimimg.com/upload/vod/20231210-1/561c5b5317ba409b12af8cb0210ab893.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20231210-1/045429f8a5f17616be4d2c585cc983eb.jpg',
    mediaType: 'movie',
    slug: 'chuyen-cong-chua-kaguya',
  },
  {
    id: 'kk-song-dai-duong',
    title: 'Ocean Waves',
    year: 1993,
    rating: '7.5 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Mối tình tay ba học trò tại trường trung học vùng Kochi ven biển, tái hiện những rung động đầu đời và hoài niệm tuổi trẻ trong sáng.',
    imageIndex: 10,
    posterPath: 'https://phimimg.com/upload/vod/20250715-1/8c4034ce583e07e4b01318e7c771ff86.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250715-1/e0c292311c5efd187f535116ea4c72bb.jpg',
    mediaType: 'movie',
    slug: 'song-dai-duong',
  },
  {
    id: 'kk-ngon-doi-hoa-hong-anh',
    title: 'From Up on Poppy Hill',
    year: 2011,
    rating: '7.7 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Tại Yokohama năm 1963, cô nữ sinh Umi và cậu bạn Shun cùng nỗ lực bảo vệ ngôi nhà câu lạc bộ lịch sử khỏi bị phá dỡ trước Thế vận hội Tokyo.',
    imageIndex: 11,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/2f292080fbc97a9746f61bf2d72e9005.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/ebe434c66a2fbb14e8857f020e86ee67.jpg',
    mediaType: 'movie',
    slug: 'ngon-doi-hoa-hong-anh',
  },
  {
    id: 'kk-dich-vu-giao-hang-kiki',
    title: "Kiki's Delivery Service",
    year: 1989,
    rating: '7.9 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Cô phù thủy nhỏ Kiki 13 tuổi cùng chú mèo đen Jiji chuyển đến thành phố biển mới, tự lập và mở dịch vụ giao hàng bay trên chiếc chổi thần kỳ.',
    imageIndex: 12,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/94ec2af944b111067d821e219bcf19a0.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/3053819af571daf02e44f2edf58847cc.jpg',
    mediaType: 'movie',
    slug: 'dich-vu-giao-hang-kiki',
  },
  {
    id: 'kk-hang-xom-cua-toi-la-totoro',
    title: 'My Neighbor Totoro',
    year: 1988,
    rating: '8.1 ★',
    genre: 'Hoạt Hình',
    synopsis: 'Hai chị em Satsuki và Mei theo bố dọn về vùng quê yên bình và tình cờ kết bạn với vị thần hộ mệnh của khu rừng - sinh vật khổng lồ Totoro tốt bụng.',
    imageIndex: 13,
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
    synopsis: 'Cô bé tý hon 14 tuổi Arrietty cùng gia đình sống bí mật dưới sàn nhà của con người. Tình bạn kỳ diệu nảy nở giữa cô và cậu bé loài người Sho.',
    imageIndex: 14,
    posterPath: 'https://phimimg.com/upload/vod/20250716-1/efd29635af493b8dbc25c755411a2124.jpg',
    backdropPath: 'https://phimimg.com/upload/vod/20250716-1/1ce9dc805194c983d2db1605b1ae4f7c.jpg',
    mediaType: 'movie',
    slug: 'the-gioi-bi-mat-cua-arrietty',
  },
];
