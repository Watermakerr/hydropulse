import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/location_service.dart';
import 'package:hive/hive.dart';
import 'package:hive_flutter/hive_flutter.dart';

// Import service
import '../services/lake_service.dart';
import '../services/auth_service.dart';
import 'login_screen.dart'; 
import '../services/task_service.dart';
import 'report_screen.dart';
import 'assigned_tasks_screen.dart';
import 'sync_screen.dart';

class MapScreen extends StatefulWidget {
  @override
  _MapScreenState createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  // --- Biến lưu thông tin người dùng cho Drawer ---
  String _fullName = 'Đang tải...';
  String _roleOrEmail = 'Đang tải...';

  // --- Biến cho Bản đồ ---
  List<Polygon> _lakePolygons = [];
  bool _isLoading = true;

  final LatLng _centerMap = LatLng(20.8154, 105.3124);

  // [MỚI] Biến điều khiển bản đồ và lưu vị trí GPS hiện tại
  final MapController _mapController = MapController();
  LatLng? _currentLocation;

  // [MỚI] Biến lưu danh sách Marker của Task để hiển thị trên bản đồ
  List<Marker> _taskMarkers = [];

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
    _loadMapData();
  }

  // Lôi thông tin user từ SharedPreferences ra để hiển thị lên Menu
  Future<void> _loadUserInfo() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _fullName = prefs.getString('user_name') ?? 'Giám sát viên'; 
      _roleOrEmail = prefs.getString('user_role') ?? 'inspector'; 
    });
  }

  // Giao tiếp giữa Service và UI (Lấy Polygon)
  Future<void> _loadMapData() async {
    final boundariesData = await LakeService.fetchLakeBoundaries();

    final polygons = boundariesData.map((points) {
      return Polygon(
        points: points,
        color: Colors.blue.withOpacity(0.3),
        borderColor: Colors.blueAccent,
        borderStrokeWidth: 3.0,
        isFilled: true,
      );
    }).toList();
      // Lấy dữ liệu điểm nhiệm vụ
    final tasksData = await TaskService.fetchTasks();
    // THÊM DÒNG NÀY ĐỂ DEBUG:
    print('====> SỐ LƯỢNG NHIỆM VỤ ĐÃ LẤY ĐƯỢC: ${tasksData.length} <====');
    
    final markers = tasksData.map((task) {
      return Marker(
        point: task.position,
        width: 40.0,
        height: 40.0,
        child: GestureDetector(
          onTap: () {
            // Hiển thị thông tin khi bấm vào điểm ghim
            _showTaskDetails(task);
          },
          child: Icon(
            Icons.location_on,
            // Nếu đã khảo sát thì màu xanh, chưa thì màu đỏ
            color: task.status == 'completed' ? Colors.green : Colors.red,
            size: 40.0,
          ),
        ),
      );
    }).toList();

    setState(() {
      _lakePolygons = polygons;
      _taskMarkers = markers;
      _isLoading = false;
    });
  }
  void _showTaskDetails(TaskMarker task) {
    showModalBottomSheet(
      context: context,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                task.title,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 10),
              Text('Trạng thái: ${task.status == 'completed' ? 'Đã hoàn thành' : 'Chưa khảo sát'}',
                  style: TextStyle(
                      color: task.status == 'completed' ? Colors.green : Colors.red,
                      fontWeight: FontWeight.bold)),
              SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    Navigator.pop(context); // Đóng cái bảng Bottom sheet lại trước

                    // Chuyển sang màn hình ReportScreen và CHỜ KẾT QUẢ trả về
                    final bool? isSaved = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ReportScreen(task: task),
                      ),
                    );

                    // Nếu bên ReportScreen bấm lưu thành công (trả về true)
                    // thì gọi lại hàm _loadMapData() để vẽ lại các điểm ghim (chuyển đỏ thành xanh)
                    // NẾU LƯU THÀNH CÔNG -> ĐỔI MÀU TRỰC TIẾP TRÊN UI (KHÔNG GỌI LẠI API)
                    if (isSaved == true) {
                      setState(() {
                        // Lặp qua danh sách Marker, tìm đúng cái Marker vừa làm xong và sơn màu xanh cho nó
                        _taskMarkers = _taskMarkers.map((m) {
                          if (m.point == task.position) {
                            return Marker(
                              point: task.position,
                              width: 40.0,
                              height: 40.0,
                              child: GestureDetector(
                                onTap: () {
                                  // Tạo một TaskMarker mới với status 'completed' để hiển thị UI
                                  _showTaskDetails(TaskMarker(
                                    id: task.id, 
                                    title: task.title, 
                                    position: task.position, 
                                    status: 'completed',
                                    template: task.template
                                  ));
                                },
                                child: Icon(Icons.location_on, color: Colors.green, size: 40.0),
                              ),
                            );
                          }
                          return m; // Các marker khác giữ nguyên
                        }).toList();
                      });
                      
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Đã lưu báo cáo offline. Điểm ghim đã chuyển màu Xanh!')),
                      );
                    }
                  },
                  icon: Icon(Icons.camera_alt),
                  label: Text('BẮT ĐẦU KHẢO SÁT'),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 15),
                  ),
                ),
              )
            ],
          ),
        );
      },
    );
  }

  void _handleLogout() async {
    await AuthService.logout();
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => LoginScreen()),
    );
  }

  // [MỚI] Hàm xử lý khi bấm nút định vị góc dưới màn hình
  Future<void> _handleMyLocation() async {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Đang lấy vị trí GPS...')),
    );

    LatLng? position = await LocationService.getCurrentLocation();

    if (position != null) {
      setState(() {
        _currentLocation = position; // Lưu tọa độ để hiện chấm xanh
      });
      // Bắt bản đồ bay thẳng về tọa độ vừa lấy, zoom vào mức 16
      _mapController.move(position, 16.0);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể lấy vị trí. Vui lòng bật GPS!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Bản đồ Vùng khảo sát'),
        centerTitle: true,
      ),
      
      // NGĂN KÉO BÊN TRÁI (NAVIGATION DRAWER)
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: BoxDecoration(color: Colors.blue[700]),
              accountName: Text(
                _fullName.toUpperCase(),
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              accountEmail: Text('Vai trò: $_roleOrEmail'),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Icon(Icons.person, size: 40, color: Colors.blue[700]),
              ),
            ),
            ListTile(
              leading: Icon(Icons.map, color: Colors.blue),
              title: Text('Bản đồ Khảo sát', style: TextStyle(fontWeight: FontWeight.bold)),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: Icon(Icons.task, color: Colors.green),
              title: Text('Nhiệm vụ được giao', style: TextStyle(fontWeight: FontWeight.bold)),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => AssignedTasksScreen()));
              },
            ),
            ListTile(
              leading: Icon(Icons.cloud_sync, color: Colors.orange),
              title: Text('Dữ liệu chờ đồng bộ'),
              trailing: ValueListenableBuilder(
                valueListenable: Hive.box('offline_reports_box').listenable(),
                builder: (context, Box box, _) {
                  final count = box.length;
                  return Container(
                    padding: EdgeInsets.all(6),
                    decoration: BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                    child: Text('$count', style: TextStyle(color: Colors.white, fontSize: 12)),
                  );
                },
              ),
              onTap: () {
                Navigator.pop(context); // Đóng menu
                // Chuyển sang màn hình Sync
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => SyncScreen()),
                ).then((_) {
                  // Gọi setState rỗng để Drawer cập nhật lại con số thông báo màu đỏ khi quay về
                  setState(() {}); 
                });
              },
            ),
            ListTile(
              leading: Icon(Icons.download_for_offline, color: Colors.green),
              title: Text('Tải bản đồ Offline'),
              onTap: () => Navigator.pop(context),
            ),
            Divider(thickness: 1),
            ListTile(
              leading: Icon(Icons.logout, color: Colors.red),
              title: Text('Đăng xuất', style: TextStyle(color: Colors.red)),
              onTap: _handleLogout,
            ),
          ],
        ),
      ),
      
      // BẢN ĐỒ CHÍNH
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : FlutterMap(
              // [MỚI] Gắn bộ điều khiển bản đồ vào đây
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _centerMap,
                initialZoom: 14.0,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.gis_water_app',
                ),
                PolygonLayer(
                  polygons: _lakePolygons,
                ),
                // [MỚI] Lớp hiển thị các điểm nhiệm vụ trên bản đồ
                MarkerLayer(
                  markers: _taskMarkers,
                ),
                // [MỚI] Lớp vẽ Marker hiện vị trí của giám sát viên
                if (_currentLocation != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: _currentLocation!,
                        width: 50.0,
                        height: 50.0,
                        child: Icon(
                          Icons.my_location,
                          color: Colors.blueAccent, // Chấm xanh rực rỡ
                          size: 30.0,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            
      // [MỚI] Gắn sự kiện lấy vị trí vào nút bấm
      floatingActionButton: FloatingActionButton(
        onPressed: _handleMyLocation, 
        child: Icon(Icons.my_location),
        backgroundColor: Colors.white,
        foregroundColor: Colors.blue,
      ),
    );
  }
}