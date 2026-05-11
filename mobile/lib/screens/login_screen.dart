import 'package:flutter/material.dart';
import '../services/auth_service.dart';
// Import màn hình bản đồ (tạm thời bạn tạo 1 file map_screen.dart rỗng để không bị lỗi nhé)
import 'map_screen.dart'; 

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  
  bool _isLoading = false; // Biến trạng thái để hiện vòng xoay loading

  void _handleLogin() async {
    setState(() {
      _isLoading = true;
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    // Gọi hàm login từ AuthService
    bool isSuccess = await AuthService.login(email, password);

    setState(() {
      _isLoading = false;
    });

    if (isSuccess) {
      // Nếu thành công, chuyển hướng sang Màn hình Bản đồ
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đăng nhập thành công!')),
      );
      
      // Tạm comment dòng điều hướng này lại nếu bạn chưa tạo MapScreen
      // Navigator.pushReplacement(
      //   context,
      //   MaterialPageRoute(builder: (context) => MapScreen()),
      // );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => MapScreen()),
  );
    } else {
      // Báo lỗi nếu sai thông tin
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sai tài khoản hoặc mật khẩu. Vui lòng thử lại!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Hệ thống Giám sát Thủy điện'),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _emailController,
              decoration: InputDecoration(
                labelText: 'Email',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.email),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            SizedBox(height: 20),
            TextField(
              controller: _passwordController,
              decoration: InputDecoration(
                labelText: 'Mật khẩu',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.lock),
              ),
              obscureText: true, // Ẩn ký tự mật khẩu
            ),
            SizedBox(height: 30),
            _isLoading
                ? CircularProgressIndicator() // Hiện loading khi đang gọi API
                : ElevatedButton(
                    onPressed: _handleLogin,
                    style: ElevatedButton.styleFrom(
                      minimumSize: Size(double.infinity, 50), // Nút bấm rộng hết màn hình
                    ),
                    child: Text('ĐĂNG NHẬP', style: TextStyle(fontSize: 16)),
                  ),
          ],
        ),
      ),
    );
  }
}