# Tài liệu Mô tả Nghiệp vụ Hệ thống (Business Logic)
**Dự án:** Quản lý Hồ chứa/Lưu vực trên nền tảng Bản đồ GIS (Hydropulse / gis_lake)

## 1. Tổng quan Hệ thống
Đây là một hệ thống quản lý các hồ chứa nước, nguồn nước và các thực thể liên quan (mốc ranh giới, tài sản) thông qua công nghệ bản đồ số GIS.
Hệ thống cho phép quản lý vận hành từ xa, giao và giám sát công việc cho nhân viên thực địa, kết hợp với các hình ảnh vệ tinh để theo dõi sự thay đổi của diện tích mặt nước theo thời gian.

## 2. Các Chủ thể (Roles) trong hệ thống
* **Quản trị viên (Admin):** Sử dụng hệ thống trên nền tảng Web. Có quyền thêm, sửa, xóa các hồ chứa, quản lý nhân sự, giao việc (Task), giám sát và theo dõi các báo cáo hình ảnh, số liệu.
* **Nhân viên thực địa (Worker):** Bắt buộc sử dụng qua thiết bị Mobile App. Nhận thông báo giao việc, đi thực địa tới các hồ chứa/mốc ranh giới để chụp ảnh báo cáo, cập nhật trạng thái các mốc hoặc tài sản, sau đó đồng bộ báo cáo về hệ thống trung tâm.

## 3. Các Nghiệp vụ Cốt lõi (Core Business Operations)

### 3.1. Quản lý Hồ chứa bản đồ (Reservoir / GIS Management)
* Hệ thống lưu trữ thông tin không gian của hồ chứa dưới dạng Đa giác (Polygon) trên bản đồ số (chuẩn tọa độ WGS84).
* Tự động tính toán tham số diện tích mặt nước bằng hecta (`area_ha`) dựa theo đối tượng không gian được vẽ hoặc nhập vào.
* Mọi hồ chứa tham gia vào hệ thống luôn trải qua các chu kỳ trạng thái: `active` (đang hoạt động), `inactive` (ngừng), `under_review` (cần xem xét).

### 3.2. Quản lý Mốc Ranh Giới (Boundary Marker Management)
* Mỗi hồ chứa sẽ phân rã thành nhiều mốc tọa độ thực địa định vị ranh giới của hồ.
* Hệ thống áp dụng luồng kiểm tra nghiệp vụ nội tại về mặt không gian: Một mốc ranh giới **bắt buộc** phải có tọa độ lọt vào trong hoặc nằm ngay trên đường mép ranh giới của hồ chứa đó.
* Theo dõi vòng đời hiện trạng mốc: Bình thường, Hư hỏng, Bị mất, Cần ưu tiên kiểm tra.

### 3.3. Quy trình Giao và Thực thi Công việc (Task & Workflow)
Đây là quy trình tương tác cốt lõi liên kết giữa trung tâm điều hành máy tính và thực địa:
1. **Khởi tạo:** Admin tạo một nhiệm vụ điều tra, bảo trì hoặc sự cố (Thấp, Trung bình, Cao, Khẩn cấp) tại một hồ chứa/mốc ranh giới cụ thể và gán cho một Worker.
2. **Thông báo chủ động:** Ngay khi Task đổi trạng thái hoặc được gán, hệ thống đẩy trực tiếp cảnh báo (push notification) tới số điện thoại của Worker.
3. **Thực địa:** Worker sử dụng App, định vị GPS đến khu vực chỉ định và ghi nhận tình trạng thực tế của công trình (Tốt, hỏng nhẹ, hỏng nặng, phá hủy...).
4. **Báo cáo và chụp ảnh:** Thông qua việc chụp bằng camera di động kèm theo dữ liệu vị trí ảnh. Ứng dụng cung cấp luồng làm việc ngoại tuyến (Offline-First), các báo cáo sẽ nằm trong hàng đợi chờ tải lên mạng (`sync_status: pending`) và tự động bơm dữ liệu hình ảnh về Cloud (Azure Blob storage) khi mạng có kết nối trở lại.
5. **Nghiệm thu:** Khi Task đổi trạng thái sang `completed`, hệ thống sẽ nảy thông báo phản hồi lại cho Admin đã khởi tạo công việc để theo dõi.

### 3.4. Tích hợp và Phân tích Ảnh Vệ tinh (Satellite Analytics)
* Kết nối tự động với API của bên thứ 3 về ảnh vệ tinh (Planet Insights Platform).
* Thường xuyên quét và yêu cầu ảnh mới cho bề mặt của các khu vực hồ chứa.
* Hệ thống thực hiện việc tính toán sự thay đổi bất thường về diện tích mặt nước so sánh theo các chu kỳ trong quá khứ nhờ cơ chế ngụy trang mặt nước (water surface masking).
* Tự động sinh ra các cấp độ cảnh báo rủi ro (Alert level: LOW, MEDIUM, HIGH) nếu nhận thấy dấu hiệu thu hẹp mặt nước (nguy cơ hạn hán/chiếm dụng) hoặc mở rộng (nguy cơ tràn).

### 3.5. Hệ thống Cảnh báo và Bảng điều khiển Tổng hợp (Dashboard)
* Dashboard thống kê lưu lượng tổng hợp: Thể hiện báo cáo tức năng trên diện rộng như tổng hồ đang theo dõi, tổng số lượng mốc, tỷ lệ hoàn thành công việc tuần tự và danh sách hoạt động của nhân viên.
* Hệ thống lưu lượng truy cập và giám sát hệ thống bảo mật bằng Json Web Token và cơ chế kiểm soát thiết bị, phiên làm việc gắt gao nhằm tránh các việc thay đổi dữ liệu trái phép ở ngoài hiện trường.
