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
  { id: 'newPopular', label: 'Mới & Phổ Biến' },
  { id: 'myList', label: 'Danh Sách Của Tôi' },
  { id: 'search', label: 'Tìm Kiếm' },
];
