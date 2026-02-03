# Slide Error Analyzer Web

## 📖 Mô tả

Ứng dụng web để phân tích và phát hiện lỗi trong các slide HTML. Có thể import từ folder hoặc file ZIP.

## ✨ Tính năng

- ✅ Import slides từ folder hoặc file ZIP
- 🔍 Phân tích và phát hiện lỗi HTML
- 📊 Hiển thị biểu đồ thống kê chi tiết
- 📋 Bảng chi tiết lỗi với bộ lọc và tìm kiếm
- 📥 Xuất báo cáo JSON và CSV
- 🎨 Giao diện đẹp, responsive

## 🚀 Cách sử dụng

### 1. Mở ứng dụng

Mở file `index.html` trong trình duyệt web:
```
file:///n:/slidegen/SlidegenWeb2/Converter/Converter/overlap/error-analyzer-web/index.html
```

### 2. Import slides

**Cách 1: Chọn folder**
- Click "📂 Chọn Folder"
- Chọn folder chứa các file HTML slide
- Ứng dụng sẽ tự động lọc và load các file .html và .htm

**Cách 2: Chọn ZIP**
- Click "📦 Chọn ZIP"  
- Chọn file ZIP chứa các slide HTML
- Ứng dụng sẽ giải nén và phân tích

### 3. Phân tích

- Click nút "🔬 Phân Tích Ngay"
- Đợi quá trình phân tích hoàn tất
- Xem kết quả chi tiết

## 📊 Các loại lỗi được phát hiện

### Lỗi (Errors)
- **Unclosed Tag**: Thẻ HTML không được đóng
- **Duplicate ID**: ID bị trùng lặp trong document
- **Invalid Image Source**: Đường dẫn hình ảnh không hợp lệ

### Cảnh báo (Warnings)
- **Missing Alt**: Thẻ img thiếu thuộc tính alt
- **Excessive Inline Styles**: Quá nhiều inline styles
- **Empty Element**: Phần tử rỗng

### Thông tin (Info)
- **Script Warning**: Cảnh báo về script

## 📈 Biểu đồ

1. **Phân loại lỗi**: Bar chart hiển thị số lượng từng loại lỗi
2. **Lỗi theo slide**: Line chart theo dõi lỗi qua các slide
3. **Mức độ nghiêm trọng**: Doughnut chart phân loại theo severity
4. **Loại vấn đề**: Polar area chart phân loại theo nhóm vấn đề

## 💾 Xuất dữ liệu

- **📊 Tải báo cáo**: Xuất báo cáo JSON đầy đủ
- **📥 Xuất CSV**: Xuất bảng lỗi dạng CSV

## 🛠️ Công nghệ sử dụng

- HTML5
- CSS3 (Responsive Design)
- Vanilla JavaScript
- Chart.js (Biểu đồ)
- JSZip (Xử lý file ZIP)

## 📁 Cấu trúc file

```
error-analyzer-web/
├── index.html          # Trang chính
├── styles.css          # Stylesheet
├── analyzer.js         # Logic phân tích
└── README.md          # Hướng dẫn
```

## 🔧 Tùy chỉnh

Bạn có thể tùy chỉnh các rule phát hiện lỗi trong file `analyzer.js` tại object `ERROR_PATTERNS`.

## 📝 Lưu ý

- Ứng dụng chạy hoàn toàn trên client-side (không cần server)
- Hỗ trợ đa ngôn ngữ (Tiếng Việt)
- Tương thích với các trình duyệt hiện đại

## 🐛 Báo lỗi

Nếu phát hiện lỗi hoặc có đề xuất cải thiện, vui lòng liên hệ team phát triển.
