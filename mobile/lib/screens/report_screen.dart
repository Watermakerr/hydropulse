import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:hive/hive.dart';

import '../services/task_service.dart';
import '../services/location_service.dart';
import '../utils/task_templates.dart';

class ReportScreen extends StatefulWidget {
  final TaskMarker task; // Nhận thông tin Task từ MapScreen truyền sang

  ReportScreen({required this.task});

  @override
  _ReportScreenState createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final Map<String, TextEditingController> _textControllers = {};
  final Map<String, bool> _booleanValues = {};
  final Map<String, String> _selectValues = {};
  final Map<String, Set<String>> _multiSelectValues = {};
  final Map<String, List<File>> _imageFiles = {};
  final Map<String, Map<String, double>> _gpsValues = {};
  bool _isSaving = false;

  final ImagePicker _picker = ImagePicker();

  TaskTemplate get _activeTemplate {
    if (widget.task.template.isNotEmpty && taskTemplates.containsKey(widget.task.template)) {
      return taskTemplates[widget.task.template]!;
    }
    return taskTemplates.values.first;
  }

  @override
  void dispose() {
    for (final controller in _textControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _getController(String id) {
    if (_textControllers.containsKey(id)) {
      return _textControllers[id]!;
    }
    final controller = TextEditingController();
    _textControllers[id] = controller;
    return controller;
  }

  bool _shouldShowField(TaskTemplateField field) {
    if (field.showIf == null || field.showIf!.isEmpty) {
      return true;
    }
    for (final entry in field.showIf!.entries) {
      final currentValue = _booleanValues[entry.key] ?? _selectValues[entry.key] ?? _getController(entry.key).text;
      if (currentValue != entry.value) {
        return false;
      }
    }
    return true;
  }

  Future<void> _takePicture(String fieldId) async {
    final images = _imageFiles[fieldId] ?? [];
    if (images.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Chỉ được chụp tối đa 5 ảnh!')),
      );
      return;
    }

    final XFile? photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
    );

    if (photo != null) {
      setState(() {
        _imageFiles[fieldId] = [...images, File(photo.path)];
      });
    }
  }

  void _removeImage(String fieldId, int index) {
    final images = _imageFiles[fieldId] ?? [];
    if (index < 0 || index >= images.length) return;
    setState(() {
      final updated = [...images]..removeAt(index);
      _imageFiles[fieldId] = updated;
    });
  }

  Future<void> _captureGps(String fieldId) async {
    final position = await LocationService.getCurrentLocation();
    if (position == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể lấy GPS. Vui lòng thử lại.')),
      );
      return;
    }
    setState(() {
      _gpsValues[fieldId] = {
        'lng': position.longitude,
        'lat': position.latitude
      };
    });
  }

  bool _hasValue(TaskTemplateField field) {
    switch (field.type) {
      case 'boolean':
        return _booleanValues.containsKey(field.id);
      case 'number':
      case 'text':
      case 'textarea':
        return _getController(field.id).text.trim().isNotEmpty;
      case 'select':
        return (_selectValues[field.id] ?? '').isNotEmpty;
      case 'multiselect':
        return (_multiSelectValues[field.id] ?? {}).isNotEmpty;
      case 'image':
        return (_imageFiles[field.id] ?? []).isNotEmpty;
      case 'gps':
        return _gpsValues[field.id] != null;
      default:
        return false;
    }
  }

  String _labelWithRequired(TaskTemplateField field) {
    return field.required ? '${field.label} *' : field.label;
  }

  String _mapConditionStatus(String? value) {
    switch (value) {
      case 'Tốt':
        return 'good';
      case 'Nhẹ':
        return 'minor_damage';
      case 'Nguy hiểm':
        return 'major_damage';
      case 'Khẩn cấp':
        return 'destroyed';
      default:
        return 'good';
    }
  }

  String? _extractDescription(Map<String, dynamic> formData) {
    for (final key in ['note', 'description']) {
      final value = formData[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return value.toString();
      }
    }
    return null;
  }

  Future<void> _saveReportLocally() async {
    for (final field in _activeTemplate.fields) {
      if (field.required && _shouldShowField(field) && !_hasValue(field)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Vui lòng điền ${field.label}')),
        );
        return;
      }
    }

    setState(() => _isSaving = true);

    try {
      final position = await LocationService.getCurrentLocation();
      final reportCoords = position != null
          ? [position.longitude, position.latitude]
          : [widget.task.position.longitude, widget.task.position.latitude];

      for (final field in _activeTemplate.fields) {
        if (field.type == 'gps' && field.required && _gpsValues[field.id] == null && position != null) {
          _gpsValues[field.id] = {'lng': position.longitude, 'lat': position.latitude};
        }
      }

      final Map<String, dynamic> formData = {};
      final List<String> photoPaths = [];

      for (final field in _activeTemplate.fields) {
        if (!_shouldShowField(field)) {
          continue;
        }
        switch (field.type) {
          case 'boolean':
            formData[field.id] = _booleanValues[field.id] ?? false;
            break;
          case 'number':
            final text = _getController(field.id).text.trim();
            formData[field.id] = text.isEmpty ? null : double.tryParse(text);
            break;
          case 'text':
          case 'textarea':
            formData[field.id] = _getController(field.id).text.trim();
            break;
          case 'select':
            formData[field.id] = _selectValues[field.id];
            break;
          case 'multiselect':
            formData[field.id] = (_multiSelectValues[field.id] ?? {}).toList();
            break;
          case 'image':
            final images = _imageFiles[field.id] ?? [];
            formData[field.id] = images.map((file) => file.path).toList();
            photoPaths.addAll(images.map((file) => file.path));
            break;
          case 'gps':
            formData[field.id] = _gpsValues[field.id];
            break;
        }
      }

      final description = _extractDescription(formData);
      final conditionValue = formData['conditionStatus']?.toString();
      final conditionStatus = _mapConditionStatus(conditionValue);

      final reportData = {
        'taskId': widget.task.id,
        'notes': description ?? '',
        'conditionStatus': conditionStatus,
        'photoPaths': photoPaths,
        'formData': formData,
        'template': widget.task.template,
        'coordinates': reportCoords,
        'timestamp': DateTime.now().toIso8601String(),
      };

      final reportsBox = Hive.box('offline_reports_box');
      await reportsBox.add(reportData);

      final tasksBox = Hive.box('tasks_box');
      List<dynamic> allTasks = tasksBox.get('all_tasks', defaultValue: []);

      for (int i = 0; i < allTasks.length; i++) {
        if (allTasks[i]['_id'] == widget.task.id) {
          allTasks[i]['status'] = 'completed';
          break;
        }
      }
      await tasksBox.put('all_tasks', allTasks);

      Navigator.pop(context, true);
    } catch (e) {
      print('Lỗi lưu báo cáo: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Có lỗi xảy ra khi lưu báo cáo!')),
      );
      setState(() => _isSaving = false);
    }
  }

  Widget _buildField(TaskTemplateField field) {
    if (!_shouldShowField(field)) {
      return SizedBox.shrink();
    }

    switch (field.type) {
      case 'boolean':
        final currentValue = _booleanValues[field.id] ?? false;
        return SwitchListTile(
          title: Text(_labelWithRequired(field)),
          subtitle: Text(currentValue ? 'Có' : 'Không'),
          value: currentValue,
          onChanged: (value) {
            setState(() {
              _booleanValues[field.id] = value;
            });
          },
        );
      case 'number':
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: _getController(field.id),
            keyboardType: TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: _labelWithRequired(field),
              border: OutlineInputBorder(),
            ),
          ),
        );
      case 'text':
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: _getController(field.id),
            decoration: InputDecoration(
              labelText: _labelWithRequired(field),
              border: OutlineInputBorder(),
            ),
          ),
        );
      case 'textarea':
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: _getController(field.id),
            maxLines: 4,
            decoration: InputDecoration(
              labelText: _labelWithRequired(field),
              border: OutlineInputBorder(),
            ),
          ),
        );
      case 'select':
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: DropdownButtonFormField<String>(
            value: _selectValues[field.id],
            decoration: InputDecoration(
              labelText: _labelWithRequired(field),
              border: OutlineInputBorder(),
            ),
            items: field.options.map((option) {
              return DropdownMenuItem(value: option, child: Text(option));
            }).toList(),
            onChanged: (value) {
              setState(() {
                if (value != null) {
                  _selectValues[field.id] = value;
                }
              });
            },
          ),
        );
      case 'multiselect':
        final selected = _multiSelectValues[field.id] ?? <String>{};
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(_labelWithRequired(field), style: TextStyle(fontWeight: FontWeight.bold)),
              ),
              ...field.options.map((option) {
                return CheckboxListTile(
                  value: selected.contains(option),
                  title: Text(option),
                  dense: true,
                  onChanged: (checked) {
                    setState(() {
                      final next = {...selected};
                      if (checked == true) {
                        next.add(option);
                      } else {
                        next.remove(option);
                      }
                      _multiSelectValues[field.id] = next;
                    });
                  },
                );
              }).toList()
            ],
          ),
        );
      case 'image':
        final images = _imageFiles[field.id] ?? [];
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${_labelWithRequired(field)} (${images.length}/5)', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              SizedBox(
                height: 120,
                child: images.isEmpty
                    ? Center(child: Text('Chưa có hình ảnh nào.'))
                    : GridView.builder(
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                        ),
                        itemCount: images.length,
                        itemBuilder: (context, index) {
                          return Stack(
                            children: [
                              Image.file(images[index], fit: BoxFit.cover, width: double.infinity, height: double.infinity),
                              Positioned(
                                right: 0,
                                top: 0,
                                child: GestureDetector(
                                  onTap: () => _removeImage(field.id, index),
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
              SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: () => _takePicture(field.id),
                icon: Icon(Icons.camera_alt),
                label: Text('Chụp ảnh'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[200],
                  foregroundColor: Colors.black,
                ),
              )
            ],
          ),
        );
      case 'gps':
        final gps = _gpsValues[field.id];
        final gpsText = gps == null ? 'Chưa có GPS' : 'Lng: ${gps['lng']}, Lat: ${gps['lat']}';
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_labelWithRequired(field), style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 6),
              Text(gpsText, style: TextStyle(fontSize: 12, color: Colors.grey[700])),
              SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: () => _captureGps(field.id),
                icon: Icon(Icons.my_location),
                label: Text('Lấy GPS'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[200],
                  foregroundColor: Colors.black,
                ),
              )
            ],
          ),
        );
      default:
        return SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final template = _activeTemplate;

    return Scaffold(
      appBar: AppBar(
        title: Text('Báo cáo nhiệm vụ'),
        backgroundColor: Colors.blue[700],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.task.title,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 6),
                Text(
                  template.title,
                  style: TextStyle(fontSize: 14, color: Colors.grey[700]),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: template.fields.map(_buildField).toList(),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
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
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}