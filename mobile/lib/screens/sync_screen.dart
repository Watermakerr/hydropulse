import 'package:flutter/material.dart';
import 'package:hive/hive.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../services/report_service.dart';

class SyncScreen extends StatefulWidget {
  @override
  _SyncScreenState createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  final Box _reportsBox = Hive.box('offline_reports_box');
  bool _isSyncing = false;

  Future<void> _syncAllData() async {
    if (_reportsBox.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Không có dữ liệu nào cần đồng bộ.')));
      return;
    }

    setState(() => _isSyncing = true);

    // Lấy tất cả các key (ID) của báo cáo đang lưu offline
    List<dynamic> keys = _reportsBox.keys.toList();
    int successCount = 0;

    for (var key in keys) {
      var reportData = _reportsBox.get(key);
      
      // Gọi service đẩy lên Server
      bool success = await ReportService.syncReport(reportData);
      
      if (success) {
        // Nếu Server nhận thành công 201, xóa báo cáo đó khỏi bộ nhớ máy
        await _reportsBox.delete(key);
        successCount++;
      }
    }

    setState(() => _isSyncing = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Đã đồng bộ thành công $successCount/${keys.length} báo cáo!')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Dữ liệu chờ đồng bộ'),
        backgroundColor: Colors.orange,
      ),
      // Sử dụng ValueListenableBuilder để giao diện tự cập nhật khi Hive thay đổi (xóa bớt)
      body: ValueListenableBuilder(
        valueListenable: _reportsBox.listenable(),
        builder: (context, Box box, _) {
          if (box.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.cloud_done, size: 80, color: Colors.green),
                  SizedBox(height: 20),
                  Text('Tất cả dữ liệu đã được đồng bộ!', style: TextStyle(fontSize: 18)),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: box.length,
            itemBuilder: (context, index) {
              final report = box.getAt(index);
              final List<dynamic> photos = report['photoPaths'] ?? [];

              return Card(
                margin: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                child: ListTile(
                  leading: Icon(Icons.description, color: Colors.blue),
                  title: Text('Nhiệm vụ ID: ${report['taskId'].toString().substring(0, 8)}...'),
                  subtitle: Text('Kèm ${photos.length} hình ảnh\nBấm đồng bộ để tải lên.'),
                  isThreeLine: true,
                  trailing: Icon(Icons.cloud_upload, color: Colors.orange),
                ),
              );
            },
          );
        },
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16.0),
        child: ElevatedButton.icon(
          onPressed: _isSyncing ? null : _syncAllData,
          icon: _isSyncing ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white)) : Icon(Icons.sync),
          label: Text(_isSyncing ? 'ĐANG ĐỒNG BỘ...' : 'ĐỒNG BỘ TẤT CẢ LÊN SERVER'),
          style: ElevatedButton.styleFrom(
            padding: EdgeInsets.symmetric(vertical: 15),
            backgroundColor: Colors.orange,
          ),
        ),
      ),
    );
  }
}