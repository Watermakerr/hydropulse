import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/api_constants.dart';

class AuthService {
  // Hàm xử lý đăng nhập
  static Future<bool> login(String usernameOrEmail, String password) async {
    try {
      final response = await http.post(
        Uri.parse(ApiConstants.loginEndpoint),
        headers: {'Content-Type': 'application/json'},

        body: jsonEncode({
          'email': usernameOrEmail, 
          'password': password,
          'platform': 'mobile',
        }),
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        
        // Backend trả về format:
        // { "success": true, "data": { "accessToken": "...", "refreshToken": "...", "user": { "id": ..., "role": ... } } }
        final dataObject = responseData['data'] as Map<String, dynamic>;
        final String accessToken = dataObject['accessToken'];
        final String refreshToken = dataObject['refreshToken'];
        
        // Lấy thông tin user từ object 'data.user'
        final Map<String, dynamic> userObject = dataObject['user'];
        final String userId = userObject['id'].toString();
        final String role = userObject['role'];

        // Lưu vào SharedPreferences
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', accessToken);
        await prefs.setString('refresh_token', refreshToken);
        await prefs.setString('user_id', userId);
        await prefs.setString('user_role', role);

        return true; 
      } else {
        print('Lỗi đăng nhập: ${response.statusCode} - ${response.body}');
        return false; 
      }
    } catch (e) {
      print('Lỗi kết nối server: $e');
      return false;
    }
  }

  // Hàm lấy Access Token để dùng cho các API sau này (Lakes, Tasks, Reports)
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  // Hàm Đăng xuất
  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    // Xóa sạch các key khi đăng xuất
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_id');
    await prefs.remove('user_role');
  }
}