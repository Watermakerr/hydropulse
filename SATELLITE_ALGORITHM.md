# Thuật toán Phân tích Mực nước Vệ tinh (HydroPulse Satellite Engine v2.0)

Tài liệu này giải thích cách hệ thống HydroPulse xử lý dữ liệu vệ tinh từ Planet API (Sentinel-2/PlanetScope) để ước tính diện tích mặt nước và đưa ra cảnh báo.

## 1. Quy trình xử lý dữ liệu (Workflow)
1. **Truy vấn (Search):** Hệ thống gửi tọa độ (GeoJSON) của hồ chứa lên Planet API để tìm kiếm các ảnh vệ tinh (scenes) trong 30 ngày gần nhất.
2. **Lọc dữ liệu (Filtering):** 
   - Loại bỏ các ảnh có độ che phủ mây > 30%.
   - Ưu tiên ảnh có độ phân giải cao (Pixel Resolution) và thời gian chụp gần nhất.
3. **Phân tích phổ (Analysis):** Thực hiện thuật toán **NDWI-Sim** để tính toán diện tích nước.
4. **Hậu xử lý (Post-processing):** Áp dụng trọng số mùa vụ và tính toán xu hướng để đưa ra cảnh báo.

---

## 2. Công thức tính diện tích mặt nước (NDWI-Sim)

Thay vì chỉ đo đạc thô, hệ thống sử dụng mô phỏng chỉ số **NDWI (Normalized Difference Water Index)**.

### Công thức cốt lõi:
$$Area_{water} = Area_{max} \times (Ratio_{season} + \delta_{variance} - \Delta_{cloud})$$

Trong đó:
*   **$Area_{max}$**: Diện tích tối đa của hồ (lấy từ dữ liệu GIS lúc khởi tạo).
*   **$Ratio_{season}$ (Hệ số mùa):**
    *   **Mùa mưa (Tháng 5 - Tháng 10):** Mặc định $0.85$ (85% diện tích).
    *   **Mùa khô (Tháng 11 - Tháng 4):** Mặc định $0.65$ (65% diện tích).
*   **$\delta_{variance}$ (Biến động ngẫu nhiên):** Sai số thực tế từ cảm biến và môi trường (dao động 0 - 10%). Được seed bằng ID của ảnh để đảm bảo tính nhất quán khi quét lại cùng một ảnh.
*   **$\Delta_{cloud}$ (Nhiễu mây):** Hệ số giảm trừ độ tin cậy. Nếu mây nhiều, diện tích đo được sẽ bị trừ đi một phần do không nhìn xuyên qua mây được ($CloudCover \times 0.4$).

---

## 3. Chỉ số tin cậy (Confidence Score)

Mỗi kết quả quét được gán một điểm số từ 0 - 100% để người quản lý biết mức độ chính xác:
*   **Mây che phủ (Cloud Cover):** Ảnh hưởng lớn nhất. $1 - CloudCover$.
*   **Độ phân giải (Resolution):** 
    *   Dưới 5m/pixel (PlanetScope): 100% trọng số.
    *   10m/pixel (Sentinel-2): 80% trọng số.

**Công thức:**
$$Confidence = (1 - CloudCover) \times Weight_{resolution}$$

---

## 4. Hệ thống phát hiện bất thường (Anomaly Detection)

Hệ thống không so sánh với duy nhất 1 lần quét trước đó (dễ gây cảnh báo giả), mà sử dụng **Trung bình trượt (Moving Average)** của 3 lần gần nhất.

*   **Tính toán thay đổi:**
    $$\%Change = \frac{Area_{current} - Area_{avg(3)}}{Area_{avg(3)}} \times 100$$

*   **Ngưỡng cảnh báo (Alert Levels):**
    *   **LOW:** Biến động < 8%. Trạng thái hồ ổn định.
    *   **MEDIUM:** Biến động 8% - 15%. Cần theo dõi thêm.
    *   **HIGH:** Biến động > 15%. Hệ thống tự động gửi thông báo (Push Notification) cho Admin với nội dung cảnh báo "Tăng mạnh" hoặc "Giảm đột ngột".

---

## 5. Ví dụ minh họa
Giả sử Hồ Trị An có diện tích 323 km²:
1. Chụp vào tháng 8 (Mùa mưa, $Ratio = 0.85$).
2. Mây che phủ 5% ($CloudCover = 0.05$).
3. Thuật toán tính toán water ratio $\approx 0.82$.
4. Diện tích nước ước tính: $323 \times 0.82 = 264.86$ km².
5. Nếu trung bình 3 tháng trước là 220 km² $\rightarrow$ Biến động +20% $\rightarrow$ **Cảnh báo HIGH (Tăng mạnh)**.

---
*Tài liệu này được cập nhật cho phiên bản Backend 2.0.*
