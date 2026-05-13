import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/gps_tracking_service.dart';
import '../services/task_service.dart';
import '../services/auth_service.dart';
import 'report_screen.dart';

class AssignedTasksScreen extends StatefulWidget {
  @override
  _AssignedTasksScreenState createState() => _AssignedTasksScreenState();
}

class _AssignedTasksScreenState extends State<AssignedTasksScreen> {
  List<TaskMarker> _tasks = [];
  bool _loading = true;
  String? _trackingTaskId;
  final int _trackingIntervalSeconds = 30;

  @override
  void initState() {
    super.initState();
    _loadTasks();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadTasks() async {
    setState(() => _loading = true);
    try {
      final markers = await TaskService.fetchTasks();
      setState(() {
        _tasks = markers;
      });
    } catch (e) {
      print('Load assigned tasks error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _accept(String id) async {
    final ok = await TaskService.acceptTask(id);
    if (ok) await _loadTasks();
  }

  Future<void> _decline(String id) async {
    final ok = await TaskService.declineTask(id);
    if (ok) await _loadTasks();
  }

  Future<void> _startTracking(TaskMarker task) async {
    if (_trackingTaskId == task.id) return;
    _trackingTaskId = task.id;
    final token = await AuthService.getToken();
    if (token == null || token.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Chua dang nhap. Vui long dang nhap lai.')),
        );
      }
      return;
    }
    await GpsTrackingService.startTracking(
      taskId: task.id,
      intervalSeconds: _trackingIntervalSeconds,
      authToken: token,
    );
    await _openGoogleMaps(task.position);
  }

  void _stopTracking() {
    GpsTrackingService.stopTracking();
    _trackingTaskId = null;
  }

  Future<void> _openGoogleMaps(LatLng destination) async {
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}',
    );

    final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Khong mo duoc Google Maps.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Nhiệm vụ được giao')),
      body: _loading
          ? Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadTasks,
              child: ListView.builder(
                itemCount: _tasks.length,
                itemBuilder: (context, idx) {
                  final t = _tasks[idx];
                  return Card(
                    margin: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  t.title,
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              SizedBox(width: 8),
                              Container(
                                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade200,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  t.status,
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                                ),
                              )
                            ],
                          ),
                          SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              if (t.status == 'pending')
                                ElevatedButton(onPressed: () => _accept(t.id), child: Text('Chấp nhận')),
                              if (t.status == 'pending')
                                OutlinedButton(onPressed: () => _decline(t.id), child: Text('Từ chối')),
                              if (t.status == 'in_progress' || _trackingTaskId == t.id)
                                ElevatedButton(
                                  onPressed: () {
                                    if (_trackingTaskId == t.id) {
                                      _stopTracking();
                                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Dừng theo dõi')));
                                    } else {
                                      _startTracking(t);
                                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Bắt đầu ghi vị trí')));
                                    }
                                  },
                                  child: Text(_trackingTaskId == t.id ? 'Dừng theo dõi' : 'Bắt đầu lộ trình'),
                                ),
                              ElevatedButton(
                                onPressed: () async {
                                  final res = await Navigator.push(context, MaterialPageRoute(builder: (_) => ReportScreen(task: t)));
                                  if (res == true) {
                                    await _loadTasks();
                                  }
                                },
                                child: Text('Báo cáo'),
                              )
                            ],
                          )
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
