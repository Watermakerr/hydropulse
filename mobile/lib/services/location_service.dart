import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class LocationService {
  // Hàm xin quyền và lấy tọa độ hiện tại
  static Future<LatLng?> getCurrentLocation() async {
    bool serviceEnabled;
    LocationPermission permission;

    // 1. Kiểm tra xem GPS trên điện thoại có đang bật không?
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      print('Dịch vụ vị trí đang bị tắt.');
      return null;
    }

    // 2. Kiểm tra quyền truy cập của App
    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        print('Người dùng từ chối cấp quyền vị trí.');
        return null;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      print('Quyền vị trí bị từ chối vĩnh viễn.');
      return null;
    }

    // 3. Nếu mọi thứ OK, lấy tọa độ ngay lập tức
    Position position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high, // Độ chính xác cao nhất (cần cho GIS)
    );

    return LatLng(position.latitude, position.longitude);
  }
}