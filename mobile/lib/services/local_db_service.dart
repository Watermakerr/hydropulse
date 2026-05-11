import 'package:hive/hive.dart';

class LocalDbService {
  // Tham chiếu đến các Box đã mở ở main.dart
  static final _lakesBox = Hive.box('lakes_box');
  static final _tasksBox = Hive.box('tasks_box');
  static final _reportsBox = Hive.box('offline_reports_box');

  // --- LƯU TRỮ VÀ LẤY DỮ LIỆU HỒ (LAKES) ---
  
  // Lưu danh sách hồ vào máy (khi có mạng)
  static Future<void> saveLakes(List<dynamic> lakesJson) async {
    await _lakesBox.put('all_lakes', lakesJson);
  }

  // Lấy danh sách hồ từ máy ra (khi mất mạng)
  static List<dynamic> getLakes() {
    // Trả về mảng rỗng nếu chưa có data
    return _lakesBox.get('all_lakes', defaultValue: []); 
  }

  // --- (Tương tự sẽ làm cho Tasks và Reports sau) ---
  // Lưu danh sách nhiệm vụ
  static Future<void> saveTasks(List<dynamic> tasksJson) async {
    await _tasksBox.put('all_tasks', tasksJson);
  }

  // Lấy danh sách nhiệm vụ
  static List<dynamic> getTasks() {
    return _tasksBox.get('all_tasks', defaultValue: []); 
  }
}