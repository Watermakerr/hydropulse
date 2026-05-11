# HydroPulse - Monorepo Project

Dự án tích hợp quản lý hồ chứa nước với 3 thành phần chính:
- **Backend API** (Node.js + Express + PostgreSQL)
- **Admin Web** (React + TypeScript)
- **Mobile App** (Flutter)

## 📁 Cấu trúc Thư mục

```
hydropulse/
├── backend/              # Backend API - port 4000
│   ├── src/
│   ├── package.json
│   ├── .env             # Config (DB, JWT, Azure Storage)
│   └── README.md
├── admin-frontend/       # React admin web - port 5173
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── mobile/              # Flutter mobile app
│   ├── lib/
│   ├── pubspec.yaml
│   └── README.md
└── README.md (this file)
```

---

## 🚀 Quick Start (Chạy Toàn Bộ Dự Án)

### 1. **Chuẩn bị Môi Trường**

#### Backend (Node.js + PostgreSQL)
```bash
# Kiểm tra Node.js đã cài
node --version    # v18+ được khuyên dùng
npm --version

# Kiểm tra PostgreSQL đã chạy
# Mặc định: localhost:5432, user=postgres, password=12345, database=hydropulse
psql -U postgres -d hydropulse -c "SELECT version();"
```

#### Admin Frontend (React + Node.js)
```bash
# Node.js required (same as backend)
```

#### Mobile (Flutter)
```bash
# Kiểm tra Flutter đã cài
flutter --version     # >= 3.0
flutter doctor        # Kiểm tra đầy đủ setup
```

---

## 📦 Khởi Chạy Từng Thành Phần

### **Step 1: Backend API**

```bash
cd hydropulse/backend

# Cài dependencies
npm install

# Kiểm tra .env config (đặc biệt DB connection)
cat .env

# Khởi chạy dev server (tự restart khi sửa file)
npm run dev
# Output: "HydroPulse API listening on port 4000"
```

**Kiểm tra API:**
```bash
# Terminal khác
curl http://localhost:4000/health

# Kết quả mong đợi:
# { "status": "ok" }
```

---

### **Step 2: Admin Frontend**

```bash
cd hydropulse/admin-frontend

# Cài dependencies
npm install

# Khởi chạy dev server (Vite)
npm run dev
# Output: "Local: http://localhost:5173/"
```

**Truy cập:** Mở browser http://localhost:5173

---

### **Step 3: Flutter Mobile App**

```bash
cd hydropulse/mobile

# Cài dependencies
flutter pub get

# Chạy trên Android Emulator (cần Android Studio + Emulator)
flutter run -d emulator-5554

# Hoặc chạy trên iOS Simulator (macOS only)
flutter run -d "iPhone 15 Pro"

# Hoặc build APK
flutter build apk --release
```

**Lưu ý:**
- Update `API_BASE_URL` trong [lib/utils/api_constants.dart](lib/utils/api_constants.dart) nếu backend chạy ở IP khác
- Mặc định: `http://172.16.107.221:3000/api` (cần đổi thành IP của máy bạn)

---

## 🔧 Configuration

### Backend `.env`

```env
PORT=4000
NODE_ENV=development

# PostgreSQL
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=12345
PGPORT=5432
PGDATABASE=hydropulse
PGSSLMODE=disable

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1d

# Azure Blob Storage (for report photos)
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
AZURE_STORAGE_CONTAINER=report-photos

# Planet API (satellite)
PLANET_API_KEY=your-planet-api-key
```

### Mobile `lib/utils/api_constants.dart`

```dart
class ApiConstants {
  // Change to your machine IP for development
  static const String baseUrl = 'http://YOUR_IP:4000/api';
  
  static const String loginEndpoint = '$baseUrl/auth/login';
  static const String lakesEndpoint = '$baseUrl/lakes';
  static const String tasksEndpoint = '$baseUrl/tasks';
  static const String reportsEndpoint = '$baseUrl/reports';
}
```

---

## 🧪 API Endpoints (Mobile Client)

### Authentication
```bash
# Login
POST /api/auth/login
Body: { "email": "user@example.com", "password": "123456", "platform": "mobile" }

# Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "abc123...",
    "user": { "id": "uuid", "email": "...", "role": "inspector" }
  }
}
```

### Lakes/Reservoirs
```bash
# Get all lakes
GET /api/lakes
Headers: { "Authorization": "Bearer <accessToken>" }

# Response:
{
  "success": true,
  "data": [
    {
      "_id": "lake-id",
      "name": "Hồ Tây",
      "boundary": { "type": "Polygon", "coordinates": [[...]] }
    }
  ]
}
```

### Tasks
```bash
# Get tasks
GET /api/tasks?status=pending
Headers: { "Authorization": "Bearer <accessToken>" }

# Get tasks for specific reservoir
GET /api/tasks?reservoirId=uuid
```

### Reports
```bash
# Submit report with photos
POST /api/reports
Content-Type: multipart/form-data
Headers: { "Authorization": "Bearer <accessToken>" }

Body:
- taskId: uuid
- description: "Báo cáo kiểm tra"
- coordinates: "105.123,20.456" (lng,lat)
- photos: [file1.jpg, file2.jpg, ...]
```

---

## 📊 Database Schema

Tôi đã tích hợp 2 hệ thống:
- **Hydropulse (Postgres)**: reservoirs, tasks, task_reports, report_photos
- **GIS Water App (Compatibility Layer)**: Endpoints tự động chuyển đổi dữ liệu

Các trường tương thích:
| Hydropulse | Mobile (GIS) | Ghi Chú |
|-----------|-------------|--------|
| `id` | `_id` | UUID |
| `boundary_geojson` | `boundary` | Polygon coords |
| `location_geojson` | `coordinates` | Point [lng, lat] |

---

## 🐛 Troubleshooting

### Backend không kết nối PostgreSQL
```bash
# Kiểm tra service chạy
sudo systemctl status postgresql    # Linux
brew services list                  # macOS

# Hoặc connect trực tiếp
psql -U postgres -h localhost
```

### Mobile không kết nối API
1. Kiểm tra IP backend: `ipconfig` (Windows) / `ifconfig` (Linux/Mac)
2. Firewall cho phép port 4000
3. Update `api_constants.dart` với IP đúng
4. Kiểm tra Token hợp lệ (expires_in = 1d)

### React admin không load
```bash
# Xóa node_modules + reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Flutter build fail
```bash
# Clean & rebuild
flutter clean
flutter pub get
flutter run
```

---

## 📝 API Documentation

Swagger UI tự động được tạo:
- **URL**: http://localhost:4000/api-docs
- Tất cả endpoint đều có description chi tiết

---

## 🔐 Security Notes

⚠️ **Development Only!**
- JWT_SECRET: "change_this_secret" → cần thay đổi khi production
- Database password: bạn nên thay đổi
- CORS: cho phép localhost:5173, localhost:3000

---

## 📱 Mobile App Features

✅ Đã tích hợp:
- Đăng nhập + xác thực Token
- Xem danh sách hồ (map overlay)
- Xem danh sách task (markers)
- Gửi báo cáo với ảnh chụp offline-sync
- LocalDB (Hive) lưu dữ liệu offline

---

## 🎯 Next Steps

1. ✅ Backend chạy ổn?
2. ✅ Admin web kết nối API thành công?
3. ✅ Mobile app login OK + xem hồ/task?
4. 🔄 Submit report → check Azure Blob upload

---

## 📞 Support

Nếu gặp lỗi, check:
- Backend console (port 4000)
- Browser console (admin web)
- Flutter debugger (mobile)

---

**Created**: May 10, 2026  
**Status**: Development Mode ✨
