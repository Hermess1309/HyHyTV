import type { RowConfig } from './vsmov';
import type { PageId } from '../state/slices/uiSlice';
import { HOME_ROW_CONFIGS } from './vsmov';

export const PAGE_CONFIGS: Record<Exclude<PageId, 'myList' | 'search' | 'settings'>, RowConfig[]> = {
  home: HOME_ROW_CONFIGS,
  tvShows: [
    { title: 'Phim Bộ Mới Nhất', url: '/danh-sach/phim-bo?page=1' },
    { title: 'Phim Bộ Hàn Quốc', url: '/quoc-gia/han-quoc?page=1' },
    { title: 'Phim Bộ Trung Quốc', url: '/quoc-gia/trung-quoc?page=1' },
    { title: 'Phim Cổ Trang', url: '/the-loai/co-trang?page=1' },
    { title: 'Phim Hoạt Hình', url: '/the-loai/hoat-hinh?page=1' },
    { title: 'Phim Hình Sự', url: '/the-loai/hinh-su?page=1' },
  ],
  movies: [
    { title: 'Phim Lẻ Mới Nhất', url: '/danh-sach/phim-le?page=1' },
    { title: 'Phim Hành Động', url: '/the-loai/hanh-dong?page=1' },
    { title: 'Khoa Học Viễn Tưởng', url: '/the-loai/khoa-hoc-vien-tuong?page=1' },
    { title: 'Phim Kinh Dị', url: '/the-loai/kinh-di?page=1' },
    { title: 'Phim Hài Hước', url: '/the-loai/hai?page=1' },
    { title: 'Phim Phiêu Lưu', url: '/the-loai/phieu-luu?page=1' },
  ],
  genres: [
    { title: 'Phim Hành Động & Phiêu Lưu', url: '/the-loai/hanh-dong?page=1' },
    { title: 'Tình Cảm & Lãng Mạn', url: '/the-loai/tinh-cam?page=1' },
    { title: 'Phim Kinh Dị & Rùng Rợn', url: '/the-loai/kinh-di?page=1' },
    { title: 'Hài Hước & Giải Trí', url: '/the-loai/hai?page=1' },
    { title: 'Anime & Hoạt Hình Tuyển Chọn', url: '/the-loai/hoat-hinh?page=1' },
    { title: 'Khoa Học Viễn Tưởng (Sci-Fi)', url: '/the-loai/khoa-hoc-vien-tuong?page=1' },
    { title: 'Cổ Trang & Tiên Hiệp', url: '/the-loai/co-trang?page=1' },
    { title: 'Tâm Lý & Chính Kịch', url: '/the-loai/tam-ly?page=1' },
    { title: 'Võ Thuật & Kiếm Đạo', url: '/the-loai/vo-thuat?page=1' },
  ],
  countries: [
    { title: 'Phim Hàn Quốc Đặc Sắc', url: '/quoc-gia/han-quoc?page=1' },
    { title: 'Phim Trung Quốc Tuyển Chọn', url: '/quoc-gia/trung-quoc?page=1' },
    { title: 'Phim Nhật Bản Được Yêu Thích', url: '/quoc-gia/nhat-ban?page=1' },
    { title: 'Phim Âu Mỹ & Hollywood Bom Tấn', url: '/quoc-gia/au-my?page=1' },
    { title: 'Phim Thái Lan Đình Đám', url: '/quoc-gia/thai-lan?page=1' },
    { title: 'Phim Việt Nam', url: '/quoc-gia/viet-nam?page=1' },
    { title: 'Phim Đài Loan', url: '/quoc-gia/dai-loan?page=1' },
    { title: 'Phim Ấn Độ / Bollywood', url: '/quoc-gia/an-do?page=1' },
  ],
  topMovies: [
    { title: 'Top 10 Phim Thịnh Hành Hôm Nay', url: '/danh-sach/phim-moi-cap-nhat?page=1' },
    { title: 'Top Phim Bộ Được Xem Nhiều Nhất', url: '/danh-sach/phim-bo?page=1' },
    { title: 'Top Phim Lẻ Đỉnh Cao 2026', url: '/danh-sach/phim-le?page=1' },
    { title: 'Top Anime & Hoạt Hình Hot', url: '/the-loai/hoat-hinh?page=1' },
  ],
  newPopular: [
    { title: 'Mới Cập Nhật - Trang 1', url: '/danh-sach/phim-moi-cap-nhat?page=1' },
    { title: 'Mới Cập Nhật - Trang 2', url: '/danh-sach/phim-moi-cap-nhat?page=2' },
    { title: 'Mới Cập Nhật - Trang 3', url: '/danh-sach/phim-moi-cap-nhat?page=3' },
    { title: 'Mới Cập Nhật - Trang 4', url: '/danh-sach/phim-moi-cap-nhat?page=4' },
  ],
};

export const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Trang Chủ' },
  { id: 'tvShows', label: 'Phim Bộ' },
  { id: 'movies', label: 'Phim Lẻ' },
  { id: 'genres', label: 'Thể Loại' },
  { id: 'countries', label: 'Quốc Gia' },
  { id: 'topMovies', label: 'Top Phim' },
  { id: 'myList', label: 'Danh Sách' },
  { id: 'search', label: 'Tìm Kiếm' },
];
