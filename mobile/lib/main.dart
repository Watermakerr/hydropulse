import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'screens/login_screen.dart';

void main() async {
  // Đảm bảo Flutter binding đã khởi tạo trước khi gọi Hive
  WidgetsFlutterBinding.ensureInitialized();

  // Khởi tạo Hive cho Flutter
  await Hive.initFlutter();

  // Mở các Box để sẵn sàng đọc/ghi dữ liệu
  await Hive.openBox('lakes_box');
  await Hive.openBox('tasks_box');
  await Hive.openBox('offline_reports_box');
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GIS Thủy Điện App',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: LoginScreen(), // Khởi chạy màn hình đăng nhập đầu tiên
    );
  }
}