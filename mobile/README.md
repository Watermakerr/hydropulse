# 📱 Hướng Dẫn Tích Hợp Đồng Bộ Dữ Liệu Thực Địa (Mobile <-> Backend)

Tài liệu này hướng dẫn cách thức đồng bộ dữ liệu báo cáo khảo sát thực địa từ ứng dụng Flutter di động về hệ thống cơ sở dữ liệu (PostgreSQL/PostGIS) thông qua máy chủ API Backend.

> [!IMPORTANT]
> **Trạng thái tương thích:** **100% Tương thích**. 
> Bạn **KHÔNG CẦN** thay đổi hay sửa bất kỳ dòng mã nguồn Dart/Flutter nào trên ứng dụng di động. Các thay đổi của chúng tôi hoàn toàn nằm ở phía Cơ sở dữ liệu và API Backend nhằm sửa lỗi và kích hoạt đầy đủ khả năng lưu trữ của Mobile.

---

## 🚀 Điểm Cải Tiến Đã Thực Hiện Phía Backend
Trước đây, khi ứng dụng di động thực hiện đẩy báo cáo thực địa (`syncReport`), hệ thống có thể gặp lỗi crash: **`column "weather" does not exist`**. 
Điều này xảy ra do CSDL Postgres thiếu các trường thông tin mở rộng. Chúng tôi đã tiến hành chạy các file di chuyển dữ liệu (Database Migrations) và cập nhật API:
1. **Thêm Cột Bảng `task_reports`**: Đã bổ sung đầy đủ các cột dữ liệu còn thiếu bao gồm `weather` (thời tiết), `water_level` (mực nước), `damage_type` (phân loại hư hỏng), `template` (mẫu biểu), và `form_data` (biểu mẫu động dạng JSONB).
2. **Kích Hoạt Đồng Bộ Đầy Đủ**: Giờ đây, mọi báo cáo khảo sát gửi từ ứng dụng di động thông qua hàm `syncReport` sẽ được tiếp nhận hoàn hảo, lưu trữ trọn vẹn và hiển thị đồng bộ tức thì trên Web Dashboard.

---

## 📊 Ma Trận Ánh Xạ Dữ Liệu (Data Mapping Matrix)

Khi hàm `ReportService.syncReport(Map reportData)` của Flutter gửi yêu cầu `MultipartRequest (POST)` lên cổng `/api/reports`, dữ liệu sẽ được khớp vào bảng `task_reports` của Postgres như sau:

| Trường Phía Flutter (`reportData`) | Định Dạng Gửi Đi (HTTP multipart) | Cột CSDL Postgres (`task_reports`) | Kiểu Dữ Liệu CSDL | Ý Nghĩa / Mô Tả |
| :--- | :--- | :--- | :--- | :--- |
| `taskId` | `fields['taskId']` (UUID string) | `task_id` | `UUID` | ID của Công việc khảo sát |
| *Mã nhân viên lấy từ bộ nhớ* | `fields['inspectorId']` | `worker_id` | `UUID` | ID của nhân viên thực địa gửi báo cáo |
| `notes` | `fields['notes']` | `description` | `TEXT` | Nội dung mô tả / ghi chú thực địa |
| `conditionStatus` | `fields['conditionStatus']` | `condition_status` | `VARCHAR(20)` | Trạng thái hư hại (good, minor_damage...) |
| `weather` | `fields['weather']` | `weather` | `VARCHAR(100)` | 🌦️ Tình trạng thời tiết thực hiện |
| `waterLevel` | `fields['waterLevel']` | `water_level` | `NUMERIC` | 📏 Mực nước đo được tại cột mốc (m) |
| `damageType` | `fields['damageType']` | `damage_type` | `VARCHAR(100)` | Kiểu hư hại nếu có (thấm, nứt...) |
| `template` | `fields['template']` | `template` | `VARCHAR(100)` | Tên mẫu biểu khảo sát mẫu |
| `formData` | `fields['formData']` (JSON string) | `form_data` | `JSONB` | 🎛️ Dữ liệu các trường khảo sát động dạng JSON |
| `coordinates` | `fields['coordinates']` (Chuỗi `"lat,lng"`) | `location` | `GEOMETRY(Point, 4326)` | 📍 Tọa độ GPS dạng hình học GIS (PostGIS) |
| `photoPaths` | Gắn file nhị phân trong mảng `photos` | Lưu thông qua bảng phụ `report_photos` | Đường dẫn Azure Blob | 📸 Danh sách các ảnh chụp hiện hiện trường |

---

## ⚙️ Quy Trình Đồng Bộ Hoạt Động (How it works)

1. **Gửi Text & Metadata**: 
   Dữ liệu thô và các trường nhập liệu được gửi dưới dạng `MultipartRequest` thông thường. Hệ thống tự động phân tách tọa độ chuỗi `"lat,lng"` để nạp vào hàm hình học `ST_GeomFromGeoJSON` của PostGIS, lưu trữ dưới dạng điểm địa lý chuẩn quốc tế để hiển thị trên bản đồ số Web.
2. **Tải Ảnh Lên Cloud Storage**:
   * API Backend tự động đón nhận các file ảnh gửi kèm từ Mobile qua mảng `photos`.
   * Tải các file ảnh này trực tiếp lên bộ lưu trữ đám mây **Azure Blob Storage**.
   * Lưu trữ liên kết URL ảnh truy cập nhanh có chữ ký bảo mật SAS vào bảng liên kết `report_photos`.
3. **Cập Nhật Trạng Thái Tự Động**:
   * Khi gửi thành công, CSDL cập nhật cột `sync_status = 'synced'` (đã đồng bộ) và ghi nhận thời gian tại `synced_at`.
   * Trạng thái của công việc (`tasks`) tương ứng cũng sẽ tự động chuyển sang trạng thái **`completed`** (đã hoàn thành) trên Dashboard của Quản trị viên.

---

## 🛠️ Xác Minh Thiết Lập Cục Bộ (Cho Nhà Phát Triển Mobile)

Để đảm bảo kết nối giữa App Flutter và Backend cục bộ hoạt động trơn tru:
1. **Kiểm tra File cấu hình kết nối ứng dụng**:
   * Mở file chứa hằng số kết nối trên Mobile (ví dụ: [api_constants.dart](file:///d:/New%20folder/gis_lake/mobile/lib/utils/api_constants.dart)).
   * Đảm bảo `API_BASE_URL` trỏ đúng về địa chỉ IP máy tính chạy Backend của bạn (thường là dạng `http://192.168.x.x:4000` hoặc IP localhost giả lập tương ứng tùy môi trường thử nghiệm).
2. **Khởi động Backend & DB**:
   * Đảm bảo cơ sở dữ liệu `gis_lake` Postgres đang chạy.
   * Chạy máy chủ backend bằng lệnh:
     ```bash
     cd backend
     npm run dev
     ```
