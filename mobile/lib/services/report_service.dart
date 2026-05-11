import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart'; // THÊM DÒNG NÀY ĐỂ ÉP KIỂU FILE
import '../utils/api_constants.dart';
import 'auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ReportService {
  static Future<bool> syncReport(Map<dynamic, dynamic> reportData) async {
    try {
      final token = await AuthService.getToken();
      final prefs = await SharedPreferences.getInstance();
      final inspectorId = prefs.getString('user_id');

      if (token == null || inspectorId == null) return false;

      var request = http.MultipartRequest('POST', Uri.parse(ApiConstants.reportsEndpoint));
      request.headers['Authorization'] = 'Bearer $token';

      // 1. Gắn Text
      request.fields['taskId'] = reportData['taskId'];
      request.fields['inspectorId'] = inspectorId;
      request.fields['notes'] = reportData['notes'] ?? '';
      
      List<dynamic> coords = reportData['coordinates'];
      request.fields['coordinates'] = '${coords[0]},${coords[1]}';

      // 2. GẮN FILE ẢNH (ĐÃ FIX LỖI MIMETYPE)
      List<dynamic> photoPaths = reportData['photoPaths'] ?? [];
      for (String path in photoPaths) {
        File imageFile = File(path);
        if (imageFile.existsSync()) {
          // Ép cứng định dạng (mimetype) của file gửi đi là image/jpeg
          request.files.add(
            await http.MultipartFile.fromPath(
              'photos', 
              path,
              contentType: MediaType('image', 'jpeg'), // <<< CHÌA KHÓA FIX LỖI Ở ĐÂY
            )
          );
        }
      }

      var response = await request.send();

      // In thêm log để dễ debug nếu có lỗi khác
      if (response.statusCode == 201 || response.statusCode == 200) {
        return true;
      } else {
        // Đọc nội dung lỗi server trả về để biết cụ thể
        final respStr = await response.stream.bytesToString();
        print('Lỗi Server khi đẩy báo cáo: ${response.statusCode} - $respStr');
        return false;
      }
    } catch (e) {
      print('Lỗi Exception khi đẩy báo cáo: $e');
      return false;
    }
  }
}