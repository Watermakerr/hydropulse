import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class LocationService {
  // Hàm xin quyền và lấy tọa độ hiện tại
  static Future<LatLng?> getCurrentLocation({bool requireAlways = false}) async {
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

    if (requireAlways && permission == LocationPermission.whileInUse) {
      final upgraded = await Geolocator.requestPermission();
      if (upgraded != LocationPermission.always) {
        print('Cần cấp quyền "Luon cho phep" de ghi vi tri khi chay nen.');
      }
    }

    // 3. Nếu mọi thứ OK, lấy tọa độ ngay lập tức
    Position position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high, // Độ chính xác cao nhất (cần cho GIS)
    );

    return LatLng(position.latitude, position.longitude);
  }

  // Dùng cho background: không xin quyền, không mở UI
  static Future<LatLng?> getCurrentLocationSilently() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return null;
    }

    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      return null;
    }

    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );

    return LatLng(position.latitude, position.longitude);
  }
}