# BÁO CÁO TỔNG KẾT DỰ ÁN
**Tên dự án:** Hệ thống Quản lý và Giám sát Hồ chứa trên nền tảng GIS (Hydropulse / gis_lake)

---

## MỤC LỤC
1. [Giới thiệu chung](#1-giới-thiệu-chung)
2. [Mục tiêu và Phạm vi dự án](#2-mục-tiêu-và-phạm-vi-dự-án)
3. [Công nghệ áp dụng](#3-công-nghệ-áp-dụng)
4. [Kiến trúc Hệ thống](#4-kiến-trúc-hệ-thống)
5. [Cấu trúc Cơ sở dữ liệu](#5-cấu-trúc-cơ-sở-dữ-liệu)
6. [Chi tiết Các Quy trình Nghiệp vụ](#6-chi-tiết-các-quy-trình-nghiệp-vụ)
7. [Kết luận và Định hướng phát triển](#7-kết-luận-và-định-hướng-phát-triển)

---

## 1. Giới thiệu chung
Dự án **gis_lake** (Tên sản phẩm: Hydropulse) là một giải pháp quản lý tài nguyên nước và công trình thủy lợi (hồ chứa, mốc ranh giới) được xây dựng dựa trên cốt lõi là hệ thống thông tin địa lý (GIS). Hệ thống giúp hiện đại hóa quy trình theo dõi thực trạng, tự động hóa việc giao việc giữa bộ phận quản lý điều hành và nhân sự thực địa, đồng thời áp dụng ảnh vệ tinh để phát hiện sớm các rủi ro như hạn hán hay ngập lụt.

## 2. Mục tiêu và Phạm vi dự án
* **Mục tiêu số hóa:** Thay thế quy trình kiểm tra thực địa thủ công, giấy tờ bằng hệ thống Web/Mobile liên kết số liệu ngay lập tức.
* **Mục tiêu theo dõi diện rộng:** Cho phép thống kê và quản lý hàng loạt hồ chứa, lưu vực song song. Áp dụng nguồn dữ liệu mở (vệ tinh) nhằm phân loại, đo đạc vùng diện tích mặt nước và ra các cảnh báo dựa theo % biến động mà không cần có người tới tận nơi do đạc.
* **Phạm vi sử dụng:** Dành cho các đơn vị quản lý, tập đoàn thủy điện hoặc cơ quan quản lý nguồn nước của nhà nước.

## 3. Công nghệ áp dụng

Hệ thống được thiết kế hoàn toàn theo mô hình Client-Server với stack công nghệ hiện đại:

* **Frontend (Trang quản trị Web):**
  * Giao diện phát triển bằng **React 19** với **Vite**, sử dụng ngôn ngữ **TypeScript**.
  * Bản đồ tích hợp qua thư viện **Leaflet.js** (`react-leaflet`).
  * Style giao diện: **TailwindCSS v4**, Framer Motion (hiệu ứng Animation đồ thị/bản đồ), và icon của `lucide-react`.
  
* **Backend (RESTful API Server):**
  * Xây dựng trên nền tảng **Node.js** với Framework **Express (v5.x)**.
  * Xác thực qua JWT (JSON Web Tokens) và bảo mật mật khẩu với `bcryptjs`.
  * Upload và lưu trữ hình ảnh báo cáo thực địa bằng thư viện `multer` kết nối trực tiếp với **Azure Blob Storage** (`@azure/storage-blob`).

* **Cơ sở dữ liệu (Database):**
  * Hệ quản trị: **PostgreSQL** kết hợp phân hệ **PostGIS** mạnh mẽ, xử lý chuyên sâu các trường dữ liệu đa giác (Polygon, Point), hỗ trợ các Index không gian như `GIST(boundary)` để tối ưu hóa truy vấn tọa độ.

* **Tích hợp bên thứ 3:**
  * **Planet Insights Platform API:** API cung cấp dữ liệu hình ảnh vệ tinh và phân tích mask mặt nước.

## 4. Kiến trúc Hệ thống
Hệ thống vận hành song hành 02 "điểm chạm" dành cho hai nhóm người dùng chính yếu:
* **Web Admin Portal:** Dành cho Admin / Quản trị viên điều hành chung. Bảng điều khiển (Dashboard) này là một Single Page Application (SPA), truy xuất qua REST API tới máy chủ Backend. Tính năng bao gồm hiển thị các lớp bản đồ, quản lý Users, xem danh sách Task, báo cáo lỗi từ hiện trường và theo dõi các Alert do vệ tinh gửi về.
* **Mobile Field App (Dành cho Worker):** Bắt buộc đối với lực lượng thực địa. Có khả năng nhận Push Notification và cơ chế đồng bộ ngoại tuyến. Người dùng có thể thao tác ghi nhận sự cố vùng lõm sóng, lưu log lại rồi Upload khi có Internet (với cờ trạng thái `offline/pending`). 

*(Bạn có thể vẽ biểu đồ, ví dụ như: Web/Mobile <-> Nginx/API Gateway <-> Node.js <-> PostgreSQL/PostGIS & Azure Cloud)*.

## 5. Cấu trúc Cơ sở dữ liệu (DB Schema Analytics)
Dự án có các thực thể xoay quanh cấu trúc liên kết chặt chẽ:
* `users` & `auth_sessions`: Cơ sở dữ liệu danh tính. Có chia Role (admin, worker) và token bảo mật phiên đăng nhập, kể cả token thiết bị mobile phục vụ push-notification (`mobile_device_tokens`). 
* `reservoirs` (Hồ chứa): Trung tâm dữ liệu của hệ thống, chứa trường thông tin `boundary` (Polygon 4326). Các Function trong PostgreSQL sẽ bắt Trigger để tự động tính `area_ha` khi có lệnh Insert/Update dữ liệu.
* `boundary_markers` (Mốc ranh giới): Tập con của hồ chứa, lưu tọa độ GPS chính xác (`Point`). Function Trigger của PostgreSQL đảm bảo Mốc bắt buộc phải nằm lọt trong hoặc trùng với boundary theo luật ST_Covers().
* `tasks` & `task_reports`: Quản lý quy trình vòng đời của các sự kiện. Kết nối từ Worker với Mốc vị trí, bao gồm tiến độ, trạng thái và file upload ảnh (`report_photos`).
* `notifications`: Hệ thống tracking Message của user.
* `satellite_analysis`: Hệ thống table song song, theo dõi sự kiện "capture_date" và diện tích nước.

## 6. Chi tiết Các Quy trình Nghiệp vụ
*Bạn có thể copy các ý có trong file `BUSINESS_LOGIC.md` và giải thích kỹ càng hơn ở phần này. Ví dụ:*
* **Luồng xử lý (Workflow) cho một Nhiệm vụ (Task):**
   * (1) Admin vào trang Web chọn Marker đang bị cảnh báo -> Nhấn "Giao việc" (Assign).
   * (2) Database Trigger (`trg_notify_task_changes`) chạy tự động, tạo mới Record trong table Notification và gọi Push API.
   * (3) App Mobile của Nhân viên sáng màn hình, nhận lệnh. Nhân viên di chuyển tới vị trí (hỗ trợ bởi GPS bản đồ trên điện thoại).
   * (4) Chụp hình, nhập ghi chú tình trạng (Tốt/Hư hỏng). Request API lên server, Server lưu vào bảng `task_reports`, xử lý Upload File ảnh lên Azure Storage.
   * (5) Trạng thái Task chuyển thành Completed.

## 7. Kết luận và Định hướng phát triển
**Kết quả đạt được:**
* Xây dựng lõi GIS trơn tru với PostGIS và Leaflet, xử lý được quy mô dữ liệu không gian phức tạp.
* Hệ thống quản lý công việc xuyên suốt tạo tính thực tế cao cho quy trình vận hành thuỷ nông hoặc môi trường.
* Tích hợp thành công API Vệ tinh để có cái nhìn vĩ mô và phòng ngừa thiên tai từ xa.

**Định hướng trong tương lai:**
* Hiện thực hóa quy trình Auto-routing (Tìm hướng đi tối ưu cho nhân viên thực địa đi qua 10 hồ chứa trong 1 ngày).
* Nâng cao tính năng thống kê tích hợp AI: Sử dụng Machine Learning để mô phỏng tương lai xu hướng cạn kiệt, chu kỳ nước theo mùa dựa trên số liệu Vệ tinh (Mở rộng từ `003_satellite_analysis`). 
* Cải thiện bộ UI của bản đồ qua các hình ảnh Heatmap (bản đồ nhiệt mật độ sự cố).

---
*(Lưu ý: Báo cáo này là một khung mẫu. Bạn hãy bổ sung thêm các Hình ảnh UI/UX (Screenshots giao diện Dashboard, Bản đồ, Code Snippets) của dự án để bản báo cáo thêm sinh động)*
