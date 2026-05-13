class ApiConstants {
  // ===== CONFIG FOR MOBILE DEVICE =====
  // Port: 4000 (backend chạy ở đây)
  // IP: Thay YOUR_BACKEND_IP bằng IP máy chạy backend
  //
  // Tìm IP máy:
  // - Windows: mở cmd → ipconfig → IPv4 Address (ví dụ: 192.168.1.100)
  // - Linux/Mac: terminal → ifconfig → inet (ví dụ: 10.0.0.50)
  //
  // Dây cắm (thiết bị thật):
  static const String baseUrl = 'http://192.168.1.6:4000/api';
  
  // Android Emulator (nếu dùng emulator, uncomment dòng này):
  // static const String baseUrl = 'http://10.0.2.2:4000/api';

  // Các endpoint (đường dẫn chi tiết)
  static const String loginEndpoint = '$baseUrl/auth/login';
  static const String lakesEndpoint = '$baseUrl/lakes';
  static const String tasksEndpoint = '$baseUrl/tasks';
  static const String reportsEndpoint = '$baseUrl/reports';
}