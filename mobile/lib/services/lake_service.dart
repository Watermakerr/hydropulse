import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../utils/api_constants.dart';
import 'auth_service.dart';

class LakeService {
  // Hàm này trả về một danh sách các mảng tọa độ (mỗi mảng là 1 ranh giới hồ)
  static Future<List<List<LatLng>>> fetchLakeBoundaries() async {
    try {
      final token = await AuthService.getToken();
      if (token == null) return [];

      final response = await http.get(
        Uri.parse(ApiConstants.lakesEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token', 
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        final List<dynamic> lakesData = responseData['data'];

        List<List<LatLng>> allLakesCoordinates = [];

        // Xử lý bóc tách dữ liệu JSON
        for (var lake in lakesData) {
          List<dynamic> coordinates = lake['boundary']['coordinates'][0];
          
          List<LatLng> polygonPoints = coordinates.map((coord) {
            // Đảo ngược [Kinh độ, Vĩ độ] thành (Vĩ độ, Kinh độ)
            return LatLng(coord[1].toDouble(), coord[0].toDouble());
          }).toList();

          allLakesCoordinates.add(polygonPoints);
        }

        return allLakesCoordinates; // Trả về data sạch sẽ
      } else {
        print('Lỗi API Lakes: ${response.statusCode}');
        return [];
      }
    } catch (e) {
      print('Lỗi gọi service Lakes: $e');
      return [];
    }
  }
}