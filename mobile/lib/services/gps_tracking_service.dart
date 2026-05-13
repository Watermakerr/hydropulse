import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:http/http.dart' as http;

import '../utils/api_constants.dart';
import 'location_service.dart';

class GpsTrackingService {
  static Future<void> initialize() async {
    final service = FlutterBackgroundService();

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: _onStart,
        autoStart: false,
        isForegroundMode: true,
        initialNotificationTitle: 'Dang theo doi lo trinh',
        initialNotificationContent: 'Gui vi tri dinh ky',
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: _onStart,
        onBackground: _onIosBackground,
      ),
    );
  }

  static Future<void> startTracking({
    required String taskId,
    required int intervalSeconds,
    required String authToken,
  }) async {
    final service = FlutterBackgroundService();
    await service.startService();
    service.invoke('startTracking', {
      'taskId': taskId,
      'intervalSeconds': intervalSeconds,
      'authToken': authToken,
    });
  }

  static Future<void> stopTracking() async {
    final service = FlutterBackgroundService();
    service.invoke('stopTracking');
  }
}

@pragma('vm:entry-point')
Future<bool> _onIosBackground(ServiceInstance service) async {
  return true;
}

@pragma('vm:entry-point')
void _onStart(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();

  Timer? timer;
  String? trackingTaskId;
  String? authToken;
  var intervalSeconds = 30;

  if (service is AndroidServiceInstance) {
    await service.setAsForegroundService();
    await service.setForegroundNotificationInfo(
      title: 'Dang theo doi lo trinh',
      content: 'Khoi dong trinh ghi GPS',
    );
  }

  Future<void> sendLocation() async {
    if (trackingTaskId == null) return;
    if (authToken == null || authToken!.isEmpty) return;

    final pos = await LocationService.getCurrentLocationSilently();
    if (pos == null) {
      debugPrint('GPS tick: position is null (missing permission or GPS off)');
      return;
    }

    debugPrint(
      'GPS tick: lat=${pos.latitude}, lng=${pos.longitude}, task=${trackingTaskId!}',
    );

    final url = Uri.parse('${ApiConstants.tasksEndpoint}/${trackingTaskId!}/location');
    final resp = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${authToken!}',
      },
      body: '{"lat":${pos.latitude},"lng":${pos.longitude},"recordedAt":"${DateTime.now().toIso8601String()}"}',
    );
    debugPrint('GPS log response: ${resp.statusCode} ${resp.body}');
  }

  void startTimer() {
    timer?.cancel();
    timer = Timer.periodic(Duration(seconds: intervalSeconds), (_) => sendLocation());
  }

  service.on('startTracking').listen((event) {
    if (event == null) return;
    trackingTaskId = event['taskId']?.toString();
    intervalSeconds = int.tryParse(event['intervalSeconds']?.toString() ?? '') ?? 30;
    authToken = event['authToken']?.toString();
    if (service is AndroidServiceInstance) {
      service.setAsForegroundService();
      service.setForegroundNotificationInfo(
        title: 'Dang theo doi lo trinh',
        content: 'Gui vi tri moi ${intervalSeconds}s',
      );
    }
    startTimer();
  });

  service.on('stopTracking').listen((event) {
    timer?.cancel();
    timer = null;
    trackingTaskId = null;
    if (service is AndroidServiceInstance) {
      service.stopSelf();
    }
  });
}
