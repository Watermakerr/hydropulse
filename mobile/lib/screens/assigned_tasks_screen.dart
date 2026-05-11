import 'dart:async';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../services/task_service.dart';
import '../services/location_service.dart';
import 'report_screen.dart';

class AssignedTasksScreen extends StatefulWidget {
  @override
  _AssignedTasksScreenState createState() => _AssignedTasksScreenState();
}

class _AssignedTasksScreenState extends State<AssignedTasksScreen> {
  List<TaskMarker> _tasks = [];
  bool _loading = true;
  Timer? _trackTimer;
  String? _trackingTaskId;

  @override
  void initState() {
    super.initState();
    _loadTasks();
  }

  @override
  void dispose() {
    _trackTimer?.cancel();
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

  void _startTracking(TaskMarker task) {
    if (_trackingTaskId == task.id) return;
    _trackTimer?.cancel();
    _trackingTaskId = task.id;

    _trackTimer = Timer.periodic(Duration(seconds: 15), (t) async {
      final pos = await LocationService.getCurrentLocation();
      if (pos != null) {
        await TaskService.postLocationLog(task.id, pos.latitude, pos.longitude);

        // proximity check
        final d = Distance();
        final meters = d.as(LengthUnit.Meter, LatLng(pos.latitude, pos.longitude), task.position);
        if (meters <= 100) {
          // prompt user to report (could auto open ReportScreen)
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Bạn đã gần mốc (≤100m). Bạn có thể chụp ảnh báo cáo.')));
        }
      }
    });
  }

  void _stopTracking() {
    _trackTimer?.cancel();
    _trackingTaskId = null;
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
                    child: ListTile(
                      title: Text(t.title),
                      subtitle: Text('Trạng thái: ${t.status}'),
                      trailing: Wrap(spacing: 8, children: [
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
                      ]),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
