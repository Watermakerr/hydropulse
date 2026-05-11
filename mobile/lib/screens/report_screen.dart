import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:hive/hive.dart';

import '../services/task_service.dart';
import '../services/location_service.dart';

class ReportScreen extends StatefulWidget {
  final TaskMarker task; // Nhận thông tin Task từ MapScreen truyền sang

  ReportScreen({required this.task});

  @override
  _ReportScreenState createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final TextEditingController _notesController = TextEditingController();
  List<File> _capturedImages = [];
  bool _isSaving = false;

  final ImagePicker _picker = ImagePicker();

  // Hàm mở Camera chụp ảnh
  Future<void> _takePicture() async {
    if (_capturedImages.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Chỉ được chụp tối đa 5 ảnh!')),
      );
      return;
    }

    final XFile? photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70, // Giảm chất lượng ảnh một chút để tiết kiệm dung lượng Offline
    );

    if (photo != null) {
      setState(() {
        _capturedImages.add(File(photo.path));
      });
    }
  }

  // Hàm xóa ảnh chụp hỏng
  void _removeImage(int index) {
    setState(() {
      _capturedImages.removeAt(index);
    });
  }

  // LƯU BÁO CÁO OFFLINE VÀO HIVE
  Future<void> _saveReportLocally() async {
    if (_notesController.text.isEmpty && _capturedImages.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Vui lòng nhập ghi chú hoặc chụp ít nhất 1 ảnh!')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      // 1. Lấy tọa độ GPS ngay lúc bấm lưu (Làm bằng chứng hiện trường)
      final position = await LocationService.getCurrentLocation();
      List<double> reportCoords = position != null 
          ? [position.longitude, position.latitude] 
          : widget.task.position != null 
              ? [widget.task.position.longitude, widget.task.position.latitude]
              : [0.0, 0.0]; // Fallback nếu hoàn toàn không lấy được GPS

      
      // 2. Đóng gói dữ liệu Báo cáo
      final reportData = {
        'taskId': widget.task.id,
        'notes': _notesController.text,
        'photoPaths': _capturedImages.map((file) => file.path).toList(), // Chỉ lưu đường dẫn file trên điện thoại
        'coordinates': reportCoords,
        'timestamp': DateTime.now().toIso8601String(),
      };

      // 3. Cất vào Hàng đợi Offline
      final reportsBox = Hive.box('offline_reports_box');
      await reportsBox.add(reportData);

      // 4. CẬP NHẬT TRẠNG THÁI TASK SANG 'COMPLETED' TRONG HIVE
      final tasksBox = Hive.box('tasks_box');
      List<dynamic> allTasks = tasksBox.get('all_tasks', defaultValue: []);
      
      for (int i = 0; i < allTasks.length; i++) {
        if (allTasks[i]['_id'] == widget.task.id) {
          allTasks[i]['status'] = 'completed'; // Đổi trạng thái
          break;
        }
      }
      await tasksBox.put('all_tasks', allTasks);

      // 5. Đóng màn hình và trả về 'true' để báo cho MapScreen biết là đã lưu thành công
      Navigator.pop(context, true); 

    } catch (e) {
      print('Lỗi lưu báo cáo: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Có lỗi xảy ra khi lưu báo cáo!')),
      );
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Báo cáo Nhiệm vụ'),
        backgroundColor: Colors.blue[700],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thông tin Task
            Text(
              widget.task.title,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),

            // Ô nhập ghi chú
            TextField(
              controller: _notesController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Nhập ghi chú hiện trường (mực nước, tình trạng đập...)...',
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),

            // Khu vực chứa ảnh đã chụp
            Text('Hình ảnh hiện trường (${_capturedImages.length}/5):', style: TextStyle(fontWeight: FontWeight.bold)),
            SizedBox(height: 10),
            Expanded(
              child: _capturedImages.isEmpty
                  ? Center(child: Text('Chưa có hình ảnh nào được chụp.'))
                  : GridView.builder(
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                      ),
                      itemCount: _capturedImages.length,
                      itemBuilder: (context, index) {
                        return Stack(
                          children: [
                            Image.file(_capturedImages[index], fit: BoxFit.cover, width: double.infinity, height: double.infinity),
                            Positioned(
                              right: 0,
                              top: 0,
                              child: GestureDetector(
                                onTap: () => _removeImage(index),
                                child: Container(
                                  color: Colors.red,
                                  child: Icon(Icons.close, color: Colors.white, size: 20),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
            ),

            // Cụm nút bấm
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _takePicture,
                    icon: Icon(Icons.camera_alt),
                    label: Text('CHỤP ẢNH'),
                    style: ElevatedButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: 15),
                      backgroundColor: Colors.grey[200],
                      foregroundColor: Colors.black,
                    ),
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: _isSaving
                      ? Center(child: CircularProgressIndicator())
                      : ElevatedButton.icon(
                          onPressed: _saveReportLocally,
                          icon: Icon(Icons.save),
                          label: Text('LƯU BÁO CÁO'),
                          style: ElevatedButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: 15),
                            backgroundColor: Colors.blue[700],
                          ),
                        ),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }
}