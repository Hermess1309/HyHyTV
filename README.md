# HyHyTv

Ứng dụng Android TV native, package `com.hyhytv.app`, Android 6.0+ (API 23), giao diện tiếng Việt, dùng remote D-pad. Mã nguồn Kotlin/Jetpack Compose for TV; không có WebView hoặc ứng dụng web phụ.

## Trạng thái nguồn phát — đọc trước khi cài

NguonC đã được tích hợp bằng các endpoint và JSON kiểm tra thực tế. Danh sách, tìm kiếm, bộ lọc, chi tiết phim và tập/server hoạt động với dữ liệu trực tiếp.

**Các phim lấy mẫu hiện chỉ trả trang nhúng `embed`, không có URL video trực tiếp cho Media3. Một trang nhúng kiểm tra còn chặn truy cập bằng Cloudflare. HyHyTv hiển thị trạng thái nguồn chưa hỗ trợ và không vượt cơ chế bảo vệ. Vì vậy bản này chưa thể cung cấp trải nghiệm bấm xem toàn bộ kho NguonC.** Cần nhà cung cấp cấp URL native có quyền truy cập để khép kín luồng này. Không gán video mẫu cho các phim thật để che giới hạn.

Có thể nhập URL HTTPS `.m3u8`, `.mp4`, `.mpd`, `.webm` mà bạn có quyền sử dụng. URL được lưu riêng theo phim/server/tập. Media3 hỗ trợ phát, tua, tiếp tục xem, đổi server/tập, tự sang tập tiếp, chọn track chất lượng/phụ đề khi luồng cung cấp. Không trích xuất quảng cáo hay chạy trình phát nhúng của bên thứ ba.

## Chức năng

- Home: hero chuyển ảnh, gradient điện ảnh, hàng poster lazy, focus đỏ, giảm chuyển động.
- Phim mới, phim bộ/lẻ, hoạt hình, hành động, kinh dị, tình cảm; bộ lọc Việt Nam/Trung Quốc/Hàn Quốc có dữ liệu xác minh.
- Search debounce 450ms, hủy truy vấn cũ, grid, phân trang, loading/empty/error/retry.
- Chi tiết, đạo diễn/diễn viên, thể loại/quốc gia, server và tập thật.
- Yêu thích, lịch sử tối đa 100 phim, tiếp tục xem và URL nguồn riêng lưu bằng Room; DataStore cho tùy chọn.
- Media3 một player trên màn hình, dừng khi ra nền/rời player, ghi tiến độ mỗi 5 giây và khi dừng/thoát.
- OkHttp cache, cache request có TTL và gộp yêu cầu trùng, tối đa 3 lần thử cho lỗi tạm thời; Coil memory/disk cache.

## Cài APK

APK release trong `deliverables/HyHyTv-1.0.0-release.apk`, được ký bằng khóa release cục bộ của workspace. Bật quyền cài ứng dụng không rõ nguồn cho ứng dụng quản lý file trên TV, chép APK sang TV và mở để cài, hoặc dùng:

```powershell
adb connect DIA_CHI_IP_TV:5555
adb install -r deliverables/HyHyTv-1.0.0-release.apk
```

Thiết bị phải là Android TV/Google TV API 23 trở lên; khả năng giải mã phụ thuộc phần cứng và codec của nguồn video. Đã cấu hình Leanback launcher, banner, icon và splash HyHyTv. Đây chưa phải bản phát hành qua Google Play.

Bản debug và release dùng chứng thư khác nhau. Nếu đã cài debug trên thiết bị test, hãy gỡ debug trước khi cài release; việc gỡ sẽ xóa dữ liệu của bản debug. Các bản cập nhật release cần giữ cùng khóa ký.

## Mở và build

Mở thư mục này trong Android Studio, chọn JDK 21 đầy đủ, cài Android SDK Platform 35 và Build Tools 35.0.0, rồi Sync. `local.properties` do Android Studio tạo trên máy của bạn; không đưa đường dẫn máy cũ vào version control.

Các phiên bản stable được pin để giữ tương thích: AGP 8.10.1, Gradle 8.13, Kotlin/Compose compiler 2.1.21, Compose BOM 2025.05.01, TV Material 1.0.1, Media3 1.7.1, Hilt 2.56.2, Retrofit 2.11.0, OkHttp 4.12.0, Coil 2.7.0, Room 2.7.1, DataStore 1.1.7. Đây không phải tuyên bố dùng bản mới nhất.

```powershell
# Windows, JDK và SDK đã cài; script cũng tự nhận bộ công cụ .tools nếu có.
./scripts/build.ps1
./scripts/build.ps1 -Release
./scripts/build.ps1 -DeviceTest

# Hoặc dùng wrapper trên mọi hệ điều hành:
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
./gradlew :app:connectedDebugAndroidTest
```

`-Release` tự tạo một khóa cục bộ ngẫu nhiên khi chưa có. **Sao lưu riêng** `.tools/hyhytv-local-release.jks` và `.tools/signing.properties` để ký các bản cập nhật cùng chứng thư. Chúng không nằm trong gói source. Khi phát hành chính thức, dùng khóa do bạn quản lý qua `HYHYTV_KEYSTORE`, `HYHYTV_STORE_PASSWORD`, `HYHYTV_KEY_PASSWORD`, alias `hyhytv`. Không commit khóa hoặc mật khẩu.

## Remote

| Nút | Hành động |
| --- | --- |
| D-pad | Di chuyển focus giữa menu, hero, hàng poster, grid, tập |
| OK | Chọn nút/phim; hiện điều khiển khi đang ẩn; Play/Pause ở nút phát |
| Trái/phải trong player khi ẩn điều khiển | Tua −/+10 giây |
| Lên/xuống trong player khi ẩn điều khiển | Hiện điều khiển |
| Trái/phải khi điều khiển hiện | Di chuyển giữa các nút; nút −10s/+10s để tua |
| Back | Đóng bảng chọn hoặc thoát player; quay lại màn hình trước |
| Media Play/Pause/Rewind/Fast-forward | Điều khiển phát/tua trực tiếp |

Chọn tập/server/chất lượng/CC từ thanh điều khiển. Phụ đề cháy sẵn trong hình không thể tắt; nút CC chỉ điều khiển subtitle track của luồng. Khi app ra nền, video dừng và không tự phát lại ngoài ý muốn.

Khi nhập nguồn bằng bàn phím TV, chọn hoàn tất/tìm kiếm trên bàn phím, hoặc dùng Back để đóng bàn phím rồi nhấn xuống để focus “Lưu nguồn & phát”.

## Kiến trúc và kiểm thử

`core` (theme, network, navigation), `domain` (model, repository contract, use case), `data` (Retrofit DTO/mapper, Room/DataStore, repository), `presentation` (ViewModel + Compose), `di` (Hilt). UI giữ stable item keys, trạng thái cuộn và slug focus theo hàng; Compose xử lý D-pad và virtualization.

Xem [báo cáo kiểm thử](docs/TEST_REPORT.md), [hợp đồng API đã xác minh](docs/API_VERIFICATION.md), [đánh giá tài liệu tham khảo](docs/REFERENCE_REVIEW.md). Các fixture JSON trong test lấy từ API thật; chỉ được dùng trong test.

Instrumentation dùng Android TV API 30 để kiểm tra Room tồn tại sau reopen, focus D-pad và Media3 phát/tua/dừng/lưu tiến độ với một video kiểm thử công khai của ExoPlayer. Video đó không nằm trong catalog ứng dụng. Cần Internet để chạy test player.

## Quyền riêng tư và nguồn tham khảo

Không có tài khoản, analytics hoặc SDK quảng cáo. Lịch sử/yêu thích/URL riêng lưu tại thiết bị; ứng dụng gửi request đến NguonC, host ảnh và host nguồn video bạn chọn. URL có token được giữ trong dữ liệu riêng ứng dụng; Android backup bị tắt.

Thiết kế được nghiên cứu từ [jposn3r/tv-ui](https://github.com/jposn3r/tv-ui), triển khai Kotlin độc lập. Không tìm thấy LICENSE trong tree tham khảo nên không tái phân phối mã nguồn hoặc tài sản của repo đó. Không sử dụng tên/logo/tài sản Netflix trong ứng dụng. Thư viện dependency giữ giấy phép riêng của nhà cung cấp.
