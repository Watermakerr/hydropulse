# Flutter Mobile App - GIS Water Reservoir

Ứng dụng mobile Flutter cho cán bộ kiểm tra hồ chứa nước.

## 📱 Features

✅ **Authentication**
- Login với email + password
- JWT token management
- Automatic token refresh

✅ **Map & Lakes**
- Hiển thị danh sách hồ trên bản đồ
- Tải offline: hồ được lưu local

✅ **Tasks**
- Xem nhiệm vụ giao cho bạn
- Hiển thị task markers trên bản đồ
- Lọc theo status (pending, in-progress, completed)

✅ **Field Reports**
- Gửi báo cáo hiện trường
- Chụp ảnh offline (lưu local)
- Đồng bộ (sync) khi có internet
- Báo cáo chứa: vị trí, mô tả, tính chất, ảnh

✅ **Offline First**
- Hive local database
- Shared Preferences (user data)
- Auto-sync khi reconnect

---

## 🛠️ Prerequisites

### Install Flutter
```bash
# Download Flutter
# https://flutter.dev/docs/get-started/install

# Verify installation
flutter --version
flutter doctor

# Nếu Missing items, cài Android Studio / Xcode
```

### Backend API Running
```bash
# Backend cần chạy ở port 4000
curl http://localhost:4000/health
```

---

## 🚀 Setup & Run

```bash
# 1. Navigate to mobile app
cd hydropulse/mobile

# 2. Get dependencies
flutter pub get

# 3. Update API endpoint (if needed)
# Edit: lib/utils/api_constants.dart
# Change: static const String baseUrl = 'http://YOUR_IP:4000/api'

# 4. Run on emulator
flutter run

# Or specify device
flutter run -d emulator-5554          # Android Emulator
flutter run -d "iPhone 15 Pro"        # iOS Simulator
```

---

## 📋 File Structure

```
lib/
├── main.dart                    # App entry point
├── screens/
│   ├── login_screen.dart       # Login UI
│   ├── map_screen.dart         # Map + Lakes + Tasks
│   ├── report_screen.dart      # Create report
│   └── sync_screen.dart        # Sync status
├── services/
│   ├── auth_service.dart       # JWT + token
│   ├── lake_service.dart       # Fetch lakes (reservoirs)
│   ├── task_service.dart       # Fetch tasks
│   ├── report_service.dart     # Upload report + photos
│   ├── location_service.dart   # GPS location
│   └── local_db_service.dart   # Hive storage
└── utils/
    └── api_constants.dart      # API base URL
```

---

## 🔧 Configuration

### API Endpoint

Edit `lib/utils/api_constants.dart`:

```dart
class ApiConstants {
  // Change to your backend IP
  static const String baseUrl = 'http://YOUR_MACHINE_IP:4000/api';
  
  static const String loginEndpoint = '$baseUrl/auth/login';
  static const String lakesEndpoint = '$baseUrl/lakes';
  static const String tasksEndpoint = '$baseUrl/tasks';
  static const String reportsEndpoint = '$baseUrl/reports';
}
```

**Find your IP:**
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
```

### Android Emulator Networking

For emulator to connect to localhost backend:
```dart
// In emulator:
'http://10.0.2.2:4000/api'  // 10.0.2.2 = host localhost from Android emulator

// In real device:
'http://YOUR_ACTUAL_IP:4000/api'
```

---

## 📱 User Flow

### 1. Login
```
Input: email + password
Action: POST /api/auth/login
Output: accessToken, refreshToken, user
Storage: SharedPreferences
```

### 2. Home Screen (Map)
```
Action: Fetch lakes from backend
Display: Map with lake boundaries
Storage: Save to Hive (offline)
```

### 3. View Tasks
```
Action: Fetch tasks assigned to current user
Display: Task markers on map
Filter: By status (pending, in-progress, completed)
```

### 4. Create Report
```
Input: Select task → describe → take photos
Action: Store locally (Hive) if offline
Sync: Upload to backend when online
  - POST /api/reports (multipart)
  - Photos → Azure Blob
  - Update task status → completed
```

---

## 🔌 API Integration

### Login
```dart
// lib/services/auth_service.dart
Future<bool> login(String email, String password) async {
  final response = await http.post(
    Uri.parse(ApiConstants.loginEndpoint),
    body: jsonEncode({
      'email': email,
      'password': password,
      'platform': 'mobile'
    }),
  );
  
  if (response.statusCode == 200) {
    // Save tokens to SharedPreferences
    final token = jsonDecode(response.body)['data']['accessToken'];
    await _prefs.setString('auth_token', token);
    return true;
  }
  return false;
}
```

### Fetch Lakes
```dart
// lib/services/lake_service.dart
static Future<List<List<LatLng>>> fetchLakeBoundaries() async {
  final token = await AuthService.getToken();
  final response = await http.get(
    Uri.parse(ApiConstants.lakesEndpoint),
    headers: {'Authorization': 'Bearer $token'},
  );
  
  if (response.statusCode == 200) {
    final lakes = jsonDecode(response.body)['data'];
    return lakes.map((lake) {
      // Parse coordinates from boundary
      List<LatLng> coords = ...;
      return coords;
    }).toList();
  }
  return [];
}
```

### Fetch Tasks
```dart
// lib/services/task_service.dart
static Future<List<TaskMarker>> fetchTasks() async {
  final token = await AuthService.getToken();
  final response = await http.get(
    Uri.parse(ApiConstants.tasksEndpoint),
    headers: {'Authorization': 'Bearer $token'},
  );
  
  if (response.statusCode == 200) {
    final tasks = jsonDecode(response.body)['data'];
    return tasks.map((task) {
      return TaskMarker(
        id: task['_id'],
        title: task['title'],
        position: LatLng(task['coordinates'][1], task['coordinates'][0]),
        status: task['status'],
      );
    }).toList();
  }
  return [];
}
```

### Submit Report
```dart
// lib/services/report_service.dart
static Future<bool> syncReport(Map reportData) async {
  final token = await AuthService.getToken();
  var request = http.MultipartRequest(
    'POST',
    Uri.parse(ApiConstants.reportsEndpoint)
  );
  
  request.headers['Authorization'] = 'Bearer $token';
  request.fields['taskId'] = reportData['taskId'];
  request.fields['notes'] = reportData['notes'];
  request.fields['coordinates'] = '${coords[0]},${coords[1]}';
  
  // Add photos
  for (String photoPath in reportData['photoPaths']) {
    request.files.add(
      await http.MultipartFile.fromPath('photos', photoPath)
    );
  }
  
  var response = await request.send();
  return response.statusCode == 201 || response.statusCode == 200;
}
```

---

## 💾 Local Storage (Hive)

### Data Models Stored Offline
- Lakes (boundaries)
- Tasks (assigned to user)
- Reports (pending sync)
- User profile

### Sync Logic
```dart
// When online:
1. Check Hive for pending reports
2. For each report:
   - POST /api/reports with photos
   - Mark as synced in Hive
3. Refresh lakes + tasks from backend
4. Save to Hive
```

---

## 🐛 Troubleshooting

### App can't connect to backend
**Problem**: `ConnectionRefused` or timeout
**Solution**:
1. Check backend running: `curl http://localhost:4000/health`
2. Update IP in `api_constants.dart` (not localhost!)
3. Disable firewall or add port exception
4. For emulator: use `10.0.2.2` instead of `localhost`

### Photos not uploading
**Problem**: Multipart request fails
**Solution**:
1. Check photo file exists
2. Verify file mimetype (should be `image/jpeg`)
3. Check Azure Blob configured on backend
4. Check photo size < 10MB

### Token expired
**Problem**: 401 Unauthorized
**Solution**:
1. Token expires every 24 hours
2. Call `POST /api/auth/refresh` with refreshToken
3. Save new accessToken

### Hive cache stale
**Problem**: Old data showing
**Solution**:
1. Force sync: Pull down from menu
2. Or delete app + reinstall: `flutter clean`

---

## 🧪 Testing Flows

### 1. Login Test
```
1. Open app
2. Enter: admin@hydropulse.vn / Admin@123456 (or worker account)
3. Tap Login
4. Should see Map screen
```

### 2. View Lakes Test
```
1. On Map screen
2. Should see lake boundaries
3. Tap on lake name to see details
```

### 3. View Tasks Test
```
1. Scroll down to see task markers
2. Tap on task marker
3. Should show task details (title, status)
```

### 4. Create Report Test
```
1. Tap "New Report" or task
2. Select photos (camera or gallery)
3. Fill description + condition
4. Tap "Submit"
5. If online: Upload immediately
6. If offline: Save locally, sync later
```

---

## 📦 Dependencies

Key packages in `pubspec.yaml`:
- `flutter_map` - Map rendering
- `latlong2` - Coordinates
- `http` - HTTP client
- `hive` - Local database
- `shared_preferences` - User prefs
- `image_picker` - Camera/gallery
- `geolocator` - GPS location
- `provider` - State management

```bash
flutter pub get      # Install dependencies
flutter pub upgrade  # Update packages
```

---

## 🏗️ Build for Production

### Android APK
```bash
flutter build apk --release
# Output: build/app/outputs/apk/release/app-release.apk
```

### iOS IPA
```bash
flutter build ipa --release
# Output: build/ios/ipa/
```

### Web (bonus)
```bash
flutter build web
# Output: build/web/
```

---

## 🔐 Security Notes

- ⚠️ Never hardcode API keys
- ✅ Use `http_client` with certificate pinning
- ✅ Clear tokens on logout
- ✅ Validate all user input

---

## 📚 References

- [Flutter Docs](https://flutter.dev/docs)
- [Flutter Map Plugin](https://pub.dev/packages/flutter_map)
- [Hive Database](https://pub.dev/packages/hive)

---

## ✅ Quick Checklist

- [ ] Flutter installed & `flutter doctor` OK
- [ ] Backend running on 4000
- [ ] IP in `api_constants.dart` correct
- [ ] Run `flutter pub get`
- [ ] Run `flutter run`
- [ ] Login successful
- [ ] Can see lakes on map
- [ ] Can submit report with photos

---

**Status**: Development Ready ✨  
**Created**: May 10, 2026
