import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../utils/api_constants.dart';
import 'auth_service.dart';
import 'local_db_service.dart';

// Class chứa thông tin điểm khảo sát để truyền sang giao diện
class TaskMarker {
  final String id;
  final String title;
  final LatLng position;
  final String status;
  final String template;

  TaskMarker({
    required this.id,
    required this.title,
    required this.position,
    required this.status,
    required this.template
  });
}

class TaskService {
  static Future<List<TaskMarker>> fetchTasks() async {
    List<dynamic> tasksData = [];

    try {
      final token = await AuthService.getToken();

      if (token != null) {
        // GỌI API LẤY TẤT CẢ TASK (Không kèm bộ lọc)
        final response = await http.get(
          Uri.parse(ApiConstants.tasksEndpoint), 
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ).timeout(const Duration(seconds: 10));

        if (response.statusCode == 200) {
          final Map<String, dynamic> responseData = jsonDecode(response.body);
          
          // Tùy thuộc vào cấu trúc JSON backend của bạn, có thể là responseData['data'] hoặc responseData trực tiếp
          tasksData = responseData['data'] ?? responseData; 
          
          // Lưu vào Hive để dùng offline
          await LocalDbService.saveTasks(tasksData);
          print('Đã lấy ${tasksData.length} tasks từ Server');
        } else {
          throw Exception('Lỗi Server: ${response.statusCode}');
        }
      }
    } catch (e) {
      print('Lỗi lấy Task, chuyển sang Offline Mode: $e');
      tasksData = LocalDbService.getTasks();
    }

    // Bóc tách JSON thành danh sách đối tượng TaskMarker
    List<TaskMarker> markers = [];
    for (var task in tasksData) {
      try {
        // Ưu tiên vị trí của mốc giám sát do backend trả về.
        // Fallback về các field cũ để vẫn đọc được dữ liệu offline đã cache trước đó.
        List<dynamic>? coordinates;

        final rawMarkerLocation = task['marker_location_geojson'];
        if (rawMarkerLocation is Map<String, dynamic>) {
          final rawCoords = rawMarkerLocation['coordinates'];
          if (rawCoords is List<dynamic>) {
            coordinates = rawCoords;
          }
        }

        if (coordinates == null && task['location'] is Map<String, dynamic>) {
          final rawCoords = task['location']['coordinates'];
          if (rawCoords is List<dynamic>) {
            coordinates = rawCoords;
          }
        }

        if (coordinates == null && task['coordinates'] is List<dynamic>) {
          coordinates = task['coordinates'] as List<dynamic>;
        }

        if (coordinates == null || coordinates.length < 2) {
          continue;
        }
        
        double _toDouble(dynamic v) {
          if (v is num) return v.toDouble();
          if (v is String) return double.tryParse(v) ?? 0.0;
          return 0.0;
        }

        markers.add(TaskMarker(
          id: task['_id'],
          title: task['title'] ?? 'Nhiệm vụ chưa có tên',
          position: LatLng(_toDouble(coordinates[1]), _toDouble(coordinates[0])), // Đảo lng/lat
          status: task['status'] ?? 'pending',
          template: task['template'] ?? '',
        ));
      } catch (e) {
        print('Lỗi parse 1 task: $e');
      }
    }

    return markers;
  }

  // Worker accepts a task
  static Future<bool> acceptTask(String taskId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) return false;

      final resp = await http.post(
        Uri.parse('${ApiConstants.tasksEndpoint}/$taskId/accept'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 10));

      return resp.statusCode == 200 || resp.statusCode == 201 || resp.statusCode == 204;
    } catch (e) {
      print('acceptTask error: $e');
      return false;
    }
  }

  // Worker declines a task (unassign)
  static Future<bool> declineTask(String taskId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) return false;

      final resp = await http.post(
        Uri.parse('${ApiConstants.tasksEndpoint}/$taskId/decline'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 10));

      return resp.statusCode == 200 || resp.statusCode == 201 || resp.statusCode == 204;
    } catch (e) {
      print('declineTask error: $e');
      return false;
    }
  }

  // Post a location log point for a task
  static Future<bool> postLocationLog(String taskId, double lat, double lng, {String? recordedAt}) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) return false;

      final Map<String, dynamic> body = {
        'lat': lat,
        'lng': lng,
      };
      if (recordedAt != null) body['recordedAt'] = recordedAt;

      final resp = await http.post(
        Uri.parse('${ApiConstants.tasksEndpoint}/$taskId/location'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 10));

      return resp.statusCode == 201 || resp.statusCode == 200;
    } catch (e) {
      print('postLocationLog error: $e');
      return false;
    }
  }
}