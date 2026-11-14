# HyHyTv — báo cáo kiểm thử

Ngày thực hiện: 2026-11-14, Asia/Bangkok. Môi trường: Windows, Temurin JDK 21, Android SDK 35 / Build Tools 35.0.0, Gradle 8.13.

## Phạm vi và giới hạn

Đã xây dựng ứng dụng Android TV native và APK release có ký. Catalog, bộ lọc, tìm kiếm, chi tiết và tập phim dùng API NguonC thật. Nguồn nhúng NguonC trong bốn phim lấy mẫu chưa thể phát native: API chỉ có HTML embed và một URL embed kiểm tra bị Cloudflare chặn. Không có cơ chế vượt chặn, WebView hay video thay thế gắn sẵn vào catalog.

Player được kiểm tra bằng video công khai dành cho test ExoPlayer, được cấp riêng trong instrumentation. Điều này xác minh Media3, không chứng minh các tập NguonC hiện phát được. Cần URL native được nhà cung cấp cho phép để hoàn thành trải nghiệm bấm xem kho NguonC.

## Các phase và tệp chính

| Phase | Tệp / thư mục tạo | Kết quả |
| --- | --- | --- |
| 1 · Foundation | Gradle Kotlin DSL, wrapper, manifest, MainActivity, HyHyApplication, core/theme, core/navigation, res | Native Kotlin, TV launcher, logo/banner/splash, Hilt và navigation; debug/release build được |
| 2 · TV UI | presentation/home, detail, common/Components.kt | Hero, backdrop/gradient, animation nhẹ, lazy poster rows, native focus, row memory, khôi phục hero action |
| 3 · API | data/remote, mapper, repository, core/network, di, domain | DTO theo JSON thật, null mapping, caching, deduplication và retry có giới hạn |
| 4 · Features | presentation/category, detail | Search debounce, phân trang, lọc, tập và server thật; loading/empty/error/retry |
| 5 · Player | presentation/player | Media3, remote, tua, tracks, tập/server, auto-next, lưu/khôi phục tiến độ; nguồn nhúng chưa hỗ trợ như mô tả trên |
| 6 · User data | data/local, presentation/settings | Room favorites/history/sources, DataStore settings, tiếp tục xem |
| 7 · Optimization | RequestCache, Coil cache, lazy layouts, lifecycle | Giới hạn cache/list/history, stable keys, không chặn main, pause/release và chặn autoplay khi ra nền |
| 8 · Release | scripts, README, docs, deliverables | APK ký cục bộ, source archive, hướng dẫn cài/build và báo cáo |

## Kiểm thử tự động

JVM: **16 test qua**, không bỏ qua. `ApiContractTest`: 9; `NetworkBehaviorTest`: 7. Kiểm tra JSON catalog/detail/search thật, year string/number, null, thể loại/quốc gia/tập, URL an toàn, mốc hoàn thành, request encoding, deduplication, TTL/eviction, cancellation và retry tối đa ba lần.

Thiết bị: **5 test qua**, không bỏ qua, trên Android TV API 30 x86, Android 11, 1280×720, density 213, máy ảo WHPX. Các test gồm Room persistence sau đóng/mở database; D-pad di chuyển/OK; nhớ poster mỗi hàng và không focus lại poster đã xóa; rời ô nhập bằng D-pad; Media3 có PlayerView thực để phát/tua/pause/lưu vị trí.

Lượt pipeline cuối: `:app:testDebugUnitTest :app:lintDebug :app:connectedDebugAndroidTest :app:assembleRelease` — **BUILD SUCCESSFUL**, 145 task, không lỗi test. Nhật ký và XML được sao chép vào `deliverables/reports`.

Lint không có lỗi. Các cảnh báo còn lại chủ yếu là thư viện có bản mới hơn và cố định landscape cho TV. Phiên bản stable hiện được pin; không nâng dependency chỉ để tắt cảnh báo.

## Kiểm tra runtime và APK

Bản release đã cài và cold-start thành công trên Android TV API 30. Catalog và detail trả dữ liệu thật sau R8 minification; yêu thích hiện trên Home; Back từ detail khôi phục đúng nút “Chi tiết”. Không thấy AndroidRuntime exception trong lượt kiểm tra đó.

Đã nhập riêng URL video ExoPlayer công khai bằng ô nguồn của APK release, đóng IME, dùng D-pad xuống/OK để lưu và phát. PlayerView hiển thị khung hình, thời lượng 09:56 và tiến độ tăng. Sau khi Back về Home có hàng “Tiếp tục xem”; force-stop/mở lại rồi chọn bằng D-pad khôi phục mốc 00:57. URL và dữ liệu test sau đó được xóa khỏi máy ảo; APK không kèm dữ liệu này. Ảnh video test không dùng để minh họa rằng phim NguonC phát được.

`apksigner verify --verbose --print-certs`: hợp lệ, v1 và v2. `zipalign -c -P 16 4`: thành công. Chứng thư release cục bộ `CN=HyHyTv Local Release, O=HyHyTv, C=VN`; khóa riêng và mật khẩu không nằm trong source archive. Xem báo cáo chữ ký trong `deliverables/reports`.

Ảnh Home, detail và trạng thái nguồn không hỗ trợ trong `docs/screenshots` được chụp từ ứng dụng chạy thật, không phải mockup.

## Chưa xác minh

- Chưa chạy trên TV vật lý hoặc đo hiệu năng trên máy cấu hình thấp; không cam kết FPS/memory ngoài môi trường test.
- Chưa kiểm tra trên toàn bộ API 23–35, mọi codec/phần cứng hoặc mọi nguồn CDN.
- Chưa kiểm chứng phụ đề/chất lượng nhiều track với tất cả nguồn; UI chỉ hiện track do Media3 nhận được.
- Auto-next/server switch có triển khai nhưng không thể xác minh xuyên suốt các tập NguonC thiếu URL native.
- Chưa có URL phát native được nhà cung cấp cấp quyền cho những nguồn nhúng lấy mẫu.

Mọi giới hạn trên vẫn được ghi nhận; bản này không được đánh dấu hoàn thành toàn bộ yêu cầu streaming NguonC.
