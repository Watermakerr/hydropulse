class TaskTemplateField {
  final String id;
  final String label;
  final String type;
  final bool required;
  final List<String> options;
  final Map<String, dynamic>? showIf;
  final bool multiple;

  const TaskTemplateField({
    required this.id,
    required this.label,
    required this.type,
    this.required = false,
    this.options = const [],
    this.showIf,
    this.multiple = false
  });
}

class TaskTemplate {
  final String template;
  final String title;
  final List<TaskTemplateField> fields;

  const TaskTemplate({
    required this.template,
    required this.title,
    required this.fields
  });
}

const Map<String, TaskTemplate> taskTemplates = {
  'DamInspection': TaskTemplate(
    template: 'DamInspection',
    title: 'Kiểm tra đập',
    fields: [
      TaskTemplateField(
        id: 'conditionStatus',
        label: 'Mức độ hiện trạng',
        type: 'select',
        options: ['Tốt', 'Nhẹ', 'Nguy hiểm', 'Khẩn cấp']
      ),
      TaskTemplateField(
        id: 'crackDetected',
        label: 'Có vết nứt không?',
        type: 'boolean',
        required: true
      ),
      TaskTemplateField(
        id: 'crackWidth',
        label: 'Độ rộng vết nứt (mm)',
        type: 'number',
        showIf: {'crackDetected': true}
      ),
      TaskTemplateField(
        id: 'crackLength',
        label: 'Độ dài vết nứt (cm)',
        type: 'number',
        showIf: {'crackDetected': true}
      ),
      TaskTemplateField(
        id: 'waterLeak',
        label: 'Có thấm nước không?',
        type: 'boolean'
      ),
      TaskTemplateField(
        id: 'dangerLevel',
        label: 'Mức độ nguy hiểm',
        type: 'select',
        options: ['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp']
      ),
      TaskTemplateField(
        id: 'photos',
        label: 'Ảnh hiện trường',
        type: 'image',
        multiple: true,
        required: true
      ),
      TaskTemplateField(
        id: 'description',
        label: 'Mô tả chi tiết',
        type: 'textarea'
      )
    ]
  ),
  'SpillwayInspection': TaskTemplate(
    template: 'SpillwayInspection',
    title: 'Kiểm tra cửa xả',
    fields: [
      TaskTemplateField(
        id: 'conditionStatus',
        label: 'Mức độ hiện trạng',
        type: 'select',
        options: ['Tốt', 'Nhẹ', 'Nguy hiểm', 'Khẩn cấp']
      ),
      TaskTemplateField(
        id: 'gateStatus',
        label: 'Tình trạng cửa xả',
        type: 'select',
        options: ['Bình thường', 'hỏng nhẹ', 'hỏng nghiêm trọng', 'Không hoạt động']
      ),
      TaskTemplateField(
        id: 'motorNoise',
        label: 'Có tiếng động không?',
        type: 'boolean'
      ),
      TaskTemplateField(
        id: 'rustDetected',
        label: 'Có rỉ sét?',
        type: 'boolean'
      ),
      TaskTemplateField(
        id: 'openCloseTest',
        label: 'Test mở/đóng thành công?',
        type: 'boolean'
      ),
      TaskTemplateField(
        id: 'photos',
        label: 'Ảnh cửa xả',
        type: 'image',
        multiple: true
      ),
      TaskTemplateField(
        id: 'description',
        label: 'Mô tả chi tiết',
        type: 'textarea'
      )
    ]
  ),
  'WaterLevelInspection': TaskTemplate(
    template: 'WaterLevelInspection',
    title: 'Kiểm Tra Mực Nước',
    fields: [
      TaskTemplateField(
        id: 'conditionStatus',
        label: 'Mức độ hiện trạng',
        type: 'select',
        options: ['Tốt', 'Nhẹ', 'Nguy hiểm', 'Khẩn cấp']
      ),
      TaskTemplateField(
        id: 'waterLevel',
        label: 'Mực nước hiện tại (m)',
        type: 'number',
        required: true
      ),
      TaskTemplateField(
        id: 'flowRate',
        label: 'Lưu lượng nước vào (m3/s)',
        type: 'number'
      ),
      TaskTemplateField(
        id: 'rainStatus',
        label: 'Tình trạng mưa',
        type: 'select',
        options: ['Không mưa', 'Mưa nhẹ', 'Mưa vừa', 'Mưa lớn']
      ),
      TaskTemplateField(
        id: 'floodRisk',
        label: 'Nguy cơ lũ lụt',
        type: 'select',
        options: ['Thấp', 'Trung bình', 'Cao']
      ),
      TaskTemplateField(
        id: 'photos',
        label: 'Ảnh mặt hồ',
        type: 'image'
      ),
      TaskTemplateField(
        id: 'description',
        label: 'Mô tả chi tiết',
        type: 'textarea'
      )
    ]
  ),
  'LandslideInspection': TaskTemplate(
    template: 'LandslideInspection',
    title: 'Kiểm Tra Sạt Lở',
    fields: [
      TaskTemplateField(
        id: 'conditionStatus',
        label: 'Mức độ hiện trạng',
        type: 'select',
        options: ['Tốt', 'Nhẹ', 'Nguy hiểm', 'Khẩn cấp']
      ),
      TaskTemplateField(
        id: 'landslideDetected',
        label: 'Có sạt lở?',
        type: 'boolean'
      ),
      TaskTemplateField(
        id: 'affectedArea',
        label: 'Diện tích ảnh hưởng (m2)',
        type: 'number'
      ),
      TaskTemplateField(
        id: 'roadBlocked',
        label: 'Có chắn đường?',
        type: 'boolean'
      ),
      TaskTemplateField(
        id: 'dangerLevel',
        label: 'Mức độ nguy hiểm',
        type: 'select',
        options: ['Nhẹ', 'Trung bình', 'Nghiêm trọng']
      ),
      TaskTemplateField(
        id: 'photos',
        label: 'Ảnh hiện trường',
        type: 'image',
        multiple: true
      ),
      TaskTemplateField(
        id: 'description',
        label: 'Mô tả chi tiết',
        type: 'textarea'
      )
    ]
  ),
  'EncroachmentInspection': TaskTemplate(
    template: 'EncroachmentInspection',
    title: 'Kiểm Tra Xâm Lấn Hồ Chứa',
    fields: [
      TaskTemplateField(
        id: 'conditionStatus',
        label: 'Mức độ hiện trạng',
        type: 'select',
        options: ['Tốt', 'Nhẹ', 'Nguy hiểm', 'Khẩn cấp']
      ),
      TaskTemplateField(
        id: 'encroachmentDetected',
        label: 'Có phát hiện xâm lấn không?',
        type: 'boolean',
        required: true
      ),
      TaskTemplateField(
        id: 'encroachmentType',
        label: 'Loại xâm lấn',
        type: 'multiselect',
        options: [
          'Xây dựng trái phép',
          'Canh tác',
          'Nuôi cá/lồng bè',
          'Đổ rác',
          'Khai thác đất đai',
          'Chăn nuôi',
          'Lấn chiếm đường quản lý',
          'Khác'
        ]
      ),
      TaskTemplateField(
        id: 'estimatedArea',
        label: 'Diện tích xâm lấn ước tính (m2)',
        type: 'number'
      ),
      TaskTemplateField(
        id: 'peopleCount',
        label: 'Số người liên quan',
        type: 'number'
      ),
      TaskTemplateField(
        id: 'temporaryOrPermanent',
        label: 'Mức độ công trình',
        type: 'select',
        options: ['Tạm thời', 'Kiên cố', 'Không xác định']
      ),
      TaskTemplateField(
        id: 'riskLevel',
        label: 'Mức độ ảnh hưởng',
        type: 'select',
        options: ['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp']
      ),
      TaskTemplateField(
        id: 'gpsLocation',
        label: 'Vị trí GPS',
        type: 'gps',
        required: true
      ),
      TaskTemplateField(
        id: 'photos',
        label: 'Ảnh hiện trường',
        type: 'image',
        multiple: true,
        required: true
      ),
      TaskTemplateField(
        id: 'description',
        label: 'Mô tả chi tiết',
        type: 'textarea'
      ),
      TaskTemplateField(
        id: 'recommendation',
        label: 'Đề xuất xử lý',
        type: 'textarea'
      )
    ]
  )
};
