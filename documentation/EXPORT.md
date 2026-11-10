# Xuất danh sách đăng ký ra CSV

Công cụ `export.js` đọc danh sách đăng ký của **một sự kiện** (`events/<id-sự-kiện>/signups`) trên Firestore (dự án **icon-picker**) bằng quyền admin (bỏ qua security rules) và ghi ra một file CSV để mở bằng Excel hoặc Google Sheets. Cột dữ liệu lấy theo cấu hình của sự kiện (các trường trong form, tên đội), nên dùng được cho mọi sự kiện.

> Cách nhanh hơn: trang admin, mục **Đăng ký** → **Xuất Excel**. Công cụ này dùng khi cần xuất từ máy có khóa dịch vụ, không cần đăng nhập admin.

## 1. Lấy khóa dịch vụ (service account key)

1. Mở **Firebase Console** của dự án `icon-picker`.
2. Vào **Project settings** (biểu tượng bánh răng) → tab **Service accounts**.
3. Bấm **Generate new private key** → xác nhận để tải file JSON về.
4. Lưu file đó với tên **`serviceAccountKey.json`** ở **thư mục gốc của dự án** (nơi chạy `npm run export`).

> ⚠️ KHÔNG chia sẻ và KHÔNG commit file khóa này lên git. Đây là khóa bí mật có toàn quyền truy cập dự án. File đã được thêm vào `.gitignore`.

## 2. Cài đặt thư viện

Chạy một lần trong thư mục dự án:

```bash
npm install
```

## 3. Chạy xuất dữ liệu

```bash
npm run export
```

hoặc tương đương:

```bash
node backend/scripts/export.js
```

Không ghi gì thêm thì công cụ xuất **sự kiện đang mở**. Sự kiện đã đóng (hoặc không phải sự kiện đang mở) thì ghi rõ ID:

```bash
npm run export -- --event mini-outing-2026
```

### Tùy chọn (không bắt buộc, không phụ thuộc thứ tự)

- Chọn sự kiện: `--event <id-sự-kiện>` (cũng chấp nhận `--event=<id>`). ID xem ở trang admin, mục **Sự kiện**.
- Dùng khóa ở đường dẫn khác:
  ```bash
  node backend/scripts/export.js --key C:\duong-dan\key.json
  ```
  (cũng chấp nhận dạng `--key=C:\duong-dan\key.json`)
- Đặt tên/đường dẫn file CSV theo ý muốn:
  ```bash
  node backend/scripts/export.js --out danh-sach.csv
  ```
- Hoặc dùng biến môi trường `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file khóa.

Thứ tự tìm khóa: `--key` → `GOOGLE_APPLICATION_CREDENTIALS` → `./serviceAccountKey.json`.

## 4. File CSV nằm ở đâu?

- Mặc định, file được tạo ngay trong thư mục dự án với tên dạng:
  `<id-sự-kiện>-YYYYMMDD-HHmmss.csv` (theo giờ Việt Nam), ví dụ `mini-outing-2026-20261110-141530.csv`.
- Cột: `STT`, `Thời gian`, các trường trong form của sự kiện (theo đúng thứ tự cấu hình), `Đội`, `Icon`, `PlayerID`. Người chưa chọn đội thì cột `Đội` để trống.
- Sau khi chạy xong, công cụ in ra **đường dẫn tuyệt đối** của file vừa ghi và bảng tóm tắt: tổng số đăng ký và số lượng theo từng đội (nhiều → ít).
- Nếu chưa có ai đăng ký, công cụ vẫn ghi một file CSV chỉ có dòng tiêu đề và báo "Chưa có ai đăng ký".

## 5. Mẹo mở bằng Excel / Google Sheets

- File đã có **BOM UTF-8** nên Excel hiển thị đúng dấu tiếng Việt khi mở trực tiếp (nhấp đúp).
- **Mã nhân viên / số điện thoại** có số 0 ở đầu (hoặc dãy số rất dài) có thể bị Excel tự định dạng lại thành số. Để giữ nguyên dạng văn bản:
  - **Google Sheets**: vào **File → Import → Upload**, chọn file, ở phần kiểu chuyển đổi chọn **không** tự chuyển số (giữ văn bản).
  - **Excel**: dùng **Data → From Text/CSV (Import)** thay vì mở trực tiếp, và đặt cột SĐT là kiểu **Text** khi xem trước.
- Lưu ý: số điện thoại dạng quốc tế bắt đầu bằng `+` (vd `+84901234567`) sẽ có thêm một dấu nháy đơn (`'`) ở đầu — đây là biện pháp an toàn chống chèn công thức vào bảng tính; có thể bỏ dấu nháy đó nếu cần.
