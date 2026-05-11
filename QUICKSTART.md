# 🚀 QUICK START GUIDE - HydroPulse Monorepo

Hướng dẫn nhanh chạy toàn bộ hệ thống GIS Water Reservoir + HydroPulse Admin.

---

## 📋 Chuẩn Bị (Cần có sẵn)

```bash
# 1. Node.js + npm (cho backend + admin web)
node --version      # >= 18.0
npm --version

# 2. PostgreSQL (cho backend)
psql --version
# Database: hydropulse, user: postgres, password: 12345

# 3. Flutter (cho mobile)
flutter --version   # >= 3.0
flutter doctor

# 4. Git (để clone / version control)
git --version
```

---

## 🎯 Chạy 3 Thành Phần

Mở **3 terminal riêng biệt** (hoặc tabs) và chạy từng phần dưới đây:

### **Terminal 1: Backend API (Port 4000)**

```powershell
# Windows PowerShell
cd d:\NCKH\hydropulse\backend

npm install           # Chỉ lần đầu
npm run dev          # Chạy dev server với auto-restart

# Output mong đợi:
# HydroPulse API listening on port 4000
```

**Kiểm tra:**
```bash
curl http://localhost:4000/health
# Phải trả về: { "status": "ok" }
```

---

### **Terminal 2: Admin Web (Port 5173)**

```powershell
# Windows PowerShell (sau khi Backend chạy OK)
cd d:\NCKH\hydropulse\admin-frontend

npm install           # Chỉ lần đầu
npm run dev          # Chạy Vite dev server

# Output:
# Local: http://localhost:5173
# Truy cập browser: http://localhost:5173
```

**Login Test:**
```
Email: admin@hydropulse.vn
Password: Admin@123456
```

---

### **Terminal 3: Flutter Mobile**

```bash
# Terminal riêng (Linux/Mac/PowerShell)
cd hydropulse/mobile

# Lần đầu tiên
flutter pub get

# Kiểm tra emulator/device available
flutter devices
# Phải thấy emulator hoặc thiết bị

# Chạy app
flutter run

# Hoặc chỉ định device:
flutter run -d emulator-5554          # Android Emulator
flutter run -d "iPhone 15 Pro"        # iOS Simulator
```

**Cấu hình API endpoint:**
```dart
// Trước khi chạy, kiểm tra:
# hydropulse/mobile/lib/utils/api_constants.dart

// Nếu backend ở IP khác localhost, update:
static const String baseUrl = 'http://YOUR_MACHINE_IP:4000/api';
```

---

## ⚙️ Database Setup (PostgreSQL)

### Nếu database chưa tạo

```bash
# 1. Tạo database
createdb -U postgres hydropulse

# 2. Khởi tạo schema (chạy từ backend folder)
cd hydropulse/backend
npm run db:init

# 3. Tạo admin test account
# Windows PowerShell:
$env:ADMIN_EMAIL="admin@hydropulse.vn"
$env:ADMIN_PASSWORD="Admin@123456"
npm run seed:admin

# Linux/Mac:
ADMIN_EMAIL=admin@hydropulse.vn ADMIN_PASSWORD=Admin@123456 npm run seed:admin
```

---

## 🔐 Default Test Accounts

Sau khi seed:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hydropulse.vn | Admin@123456 |
| Worker | inspector@hydropulse.vn | Password123! |

---

## 📱 Mobile App Config

Trước khi `flutter run`, kiểm tra:

**File: `hydropulse/mobile/lib/utils/api_constants.dart`**

```dart
class ApiConstants {
  // ❌ WRONG (won't work):
  // static const String baseUrl = 'http://localhost:4000/api';

  // ✅ RIGHT (use your machine IP):
  static const String baseUrl = 'http://192.168.1.100:4000/api';
  
  static const String loginEndpoint = '$baseUrl/auth/login';
  static const String lakesEndpoint = '$baseUrl/lakes';
  static const String tasksEndpoint = '$baseUrl/tasks';
  static const String reportsEndpoint = '$baseUrl/reports';
}
```

**Tìm IP máy:**
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
```

---

## 🧪 Test Each Component

### 1️⃣ Backend Health

```bash
curl http://localhost:4000/health
# Expected: { "status": "ok" }
```

### 2️⃣ Backend Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hydropulse.vn","password":"Admin@123456","platform":"web"}'

# Expected response with accessToken
```

### 3️⃣ Get Lakes

```bash
# Using token from login above
TOKEN="..."

curl http://localhost:4000/api/lakes \
  -H "Authorization: Bearer $TOKEN"

# Expected: list of reservoirs/lakes
```

### 4️⃣ Admin Web Login

- Open http://localhost:5173 in browser
- Enter: admin@hydropulse.vn / Admin@123456
- Should see dashboard

### 5️⃣ Mobile App

- Run `flutter run`
- Login with same credentials
- Should see map + lakes
- Can submit reports (if online)

---

## 🐛 Common Issues & Fixes

### ❌ Backend won't start

```bash
# Port 4000 already in use?
netstat -tlnp | grep 4000    # Linux
lsof -i :4000                # macOS

# Kill process & restart
npm run dev

# PostgreSQL not running?
sudo systemctl status postgresql    # Linux
brew services start postgresql      # macOS
```

### ❌ Admin web can't connect to API

```bash
# CORS issue? Check backend console
# Frontend tries to reach wrong API URL?

# Solution: Verify .env or hardcoded API URL
# Backend should allow http://localhost:5173 in CORS
```

### ❌ Mobile can't connect

```bash
# Emulator can't reach localhost:4000?
# Use 10.0.2.2 for Android emulator:
static const String baseUrl = 'http://10.0.2.2:4000/api';

# Real device can't connect?
# 1. Check IP: ipconfig
# 2. Firewall: Allow port 4000
# 3. Update api_constants.dart with correct IP
```

### ❌ Database connection fails

```bash
# Check PostgreSQL
psql -U postgres -h localhost -c "SELECT 1;"

# Check .env in backend folder
cat .env

# Should have:
# PGHOST=localhost
# PGUSER=postgres
# PGPASSWORD=12345
# PGDATABASE=hydropulse
```

---

## 📊 Workflow

### Admin (Web)
```
1. Go to http://localhost:5173
2. Login (admin account)
3. Create Reservoirs (lakes)
4. Add Boundary Markers (cột mốc)
5. Create Tasks (assign to workers)
6. View Reports (from workers' submissions)
```

### Worker (Mobile)
```
1. Open Flutter app
2. Login (worker account)
3. See assigned tasks on map
4. Tap task → Create report
5. Add photos + location
6. Submit report (uploads when online)
7. App shows sync status
```

---

## 🚀 Production Checklist

Before deploying:

- [ ] Backend: `.env` has secure JWT_SECRET
- [ ] Backend: Database password changed from default
- [ ] Backend: NODE_ENV set to "production"
- [ ] Admin Web: API base URL points to production domain
- [ ] Mobile: API base URL points to production domain
- [ ] All CORS origins whitelisted
- [ ] SSL certificates installed (HTTPS)
- [ ] Azure Blob Storage configured
- [ ] Database backups configured
- [ ] Monitoring/logging enabled

---

## 📞 Support / Debug

### View Logs

**Backend:**
```bash
# Console shows: request/response, errors
# Check src/ files for console.log() calls
```

**Admin Web:**
```bash
# F12 → Console in browser
# Check Network tab for API calls
```

**Mobile:**
```bash
# Run with verbose:
flutter run -v

# Check device logs:
flutter logs
```

---

## 🎉 Success Indicators

✅ **All running when:**
- Backend: Terminal shows "HydroPulse API listening on port 4000"
- Admin: Browser shows login page at localhost:5173
- Mobile: App shows login screen + can submit reports
- All 3 components can communicate

---

## 📁 Project Structure

```
hydropulse/
├── backend/               ← API server (port 4000)
│   ├── package.json
│   ├── .env (config)
│   └── src/
├── admin-frontend/        ← React web (port 5173)
│   ├── package.json
│   └── src/
├── mobile/               ← Flutter app
│   ├── pubspec.yaml
│   ├── lib/
│   └── lib/utils/api_constants.dart (update IP here!)
└── README.md (this guide)
```

---

## 🔗 Quick Links

- Backend README: [hydropulse/backend/README.md](backend/README.md)
- Mobile README: [hydropulse/mobile/SETUP.md](mobile/SETUP.md)
- Main README: [hydropulse/README.md](README.md)
- API Docs (Swagger): http://localhost:4000/api-docs

---

## ⏱️ Estimated Time

- Setup (first time): **10-15 minutes**
- Subsequent runs: **2-3 minutes**
- Testing flow: **5 minutes**

---

**🎯 Goal**: All 3 services running → Mobile can submit reports → Admin can see them

**Status**: Ready to Run ✨

---

**Last Updated**: May 10, 2026  
**Created by**: HydroPulse Team
