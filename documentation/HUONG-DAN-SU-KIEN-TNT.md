# Hướng dẫn chạy sự kiện Mini Outing (TNT) — tìm roommate

Người chơi chỉ cần **nhập họ tên**. Hệ thống tự tra giới tính trong file của BTC và chỉ cho chọn
**phòng đúng giới** (phòng khác giới bị khoá). Mỗi phòng có nhãn **PHÒNG NAM** / **PHÒNG NỮ**.

| Trang | Link |
|---|---|
| Trang người chơi | https://hm-tam-wf.github.io/group-match-event/ |
| Trang quản trị (admin) | https://hm-tam-wf.github.io/group-match-event/admin.html |

> Trang admin **không** hiện giao diện TNT — đó là bình thường, chỉ trang người chơi mới có.

---

## Cách nhanh — điền file mẫu rồi chạy 1 lệnh

File mẫu (tên giả): `sample-allowlist/tnt-mau-nhap-lieu.xlsx` (có sheet "Hướng dẫn" bên trong).
**Dữ liệu thật** của BTC để ở thư mục `btc-data/` — thư mục này KHÔNG đưa lên git vì repo GitHub đang public
(có họ tên nhân sự). File đã điền sẵn: `btc-data/tnt-nhap-lieu.xlsx` — script dùng file này mặc định.

- **Sheet "Nhân sự"** (phải là sheet đầu): `NAME` | `Gender` | `Phòng`.
  Cột **Phòng** để trống = người đó tự chọn trên web; ghi **số thứ tự phòng** (1, 2, 3…) = BTC xếp sẵn.
  Người được xếp sẵn không cần vào web — tên họ hiện luôn trong "Danh sách roommate".
- **Sheet "Phòng"**: `STT` | `Tên phòng` | `Số giường` | `Giới tính` (Nam/Nữ, trống = phòng chung) | `Team` (tuỳ chọn — hiện thành "Phòng 1 · Team 1") | `Emoji` (tuỳ chọn).

Chạy trong thư mục dự án (cần file `serviceAccountKey.json` ở thư mục gốc):

```
node backend/scripts/tnt-import.js --file "đường-dẫn-file.xlsx"                 ← chỉ KIỂM TRA, không ghi gì
node backend/scripts/tnt-import.js --file "đường-dẫn-file.xlsx" --apply --open  ← tạo sự kiện + mở luôn
```

Lệnh kiểm tra in ra danh sách phòng, số người, số giường và mọi lỗi (trùng tên, sai giới, xếp quá số giường,
thiếu giường…). Hết lỗi mới chạy `--apply`. Sự kiện mặc định có ID `mini-outing-2026` (đổi bằng `--event <id>`);
nếu ID đã tồn tại thì script dừng, không ghi đè. Làm xong có thể chỉnh tiếp trong admin như bình thường.

Muốn làm tay trong admin thì theo các bước dưới.

## Bước 1 — Chuẩn bị file Excel

File `.xlsx`, dòng đầu là tiêu đề, cần 2 cột:

| NAME | Gender |
|---|---|
| NGUYỄN VĂN A | Nam |
| TRẦN THỊ B | Nữ |

- **NAME**: họ tên **có dấu đầy đủ**, đúng như người chơi sẽ gõ. Viết hoa hay thường đều được.
- **Gender**: ghi `Nam` hoặc `Nữ`. Ô trống ⇒ người đó được vào mọi phòng.
- Cột khác (vd `STT`) có cũng không sao.
- Nên lưu dạng **.xlsx**. Nếu dùng CSV thì phải chọn "CSV UTF-8", nếu không tiếng Việt sẽ bị lỗi font.

## Bước 2 — Tạo / sửa sự kiện

Vào admin → đăng nhập → trong **Danh sách sự kiện**, bấm **Sửa** (hoặc **Nhân bản** để tạo bản mới) rồi điền:

1. **Tên sự kiện**: `BẠN MUỐN CHUNG CHĂN!`
2. **Mô tả**: dán nguyên đoạn sau

   ```html
   "Chọn phòng đừng để phòng dư, chọn bạn đừng để phòng bạn to hơn phòng mình"<ul><li><b>Săn roommate phiên bản giới hạn:</b> Mỗi phòng sẽ chỉ bán ra vài chiếc giường giới hạn — gom đủ người, hệ thống tự động "khóa cửa" tiễn khách.</li><li>Mỗi công nhân sự kiện chỉ được <b>chốt cạ cứng 1 lần duy nhất</b>, đã chọn là không thể quay đầu.</li></ul>
   ```
3. **Ô nhập (fields)** — chỉ giữ **1 ô**, xoá hết ô khác (nút ✕):
   - key: `name` · Nhãn: `Tên công nhân sự kiện` · tích **Bắt buộc** · Placeholder: `Nguyễn Văn A`
4. **Chống trùng**: chọn `name`, để tích ô chặn trùng.
5. Tích **Danh sách cho phép** và **Check giới tính**. (Không cần tích "Đối chiếu họ tên".)
6. **Danh sách đội** — mỗi dòng là 1 phòng: emoji (không trùng nhau) · tên phòng · màu ·
   số giường (để trống = dùng "Sĩ số / đội") · cột cuối chọn **Nam** hoặc **Nữ**.
7. **Lịch** (tuỳ chọn): giờ mở/đóng theo giờ Việt Nam. Để trống = mở ngay, không tự đóng.
8. Bấm nút lưu ở cuối form (**Lưu thay đổi** / **Tạo bản sao** / **Tạo sự kiện**). Có chữ đỏ báo lỗi thì sửa theo nội dung báo.
   Nhân bản thì phải đổi **ID sự kiện** mới (chữ thường, số, gạch ngang — vd `mini-outing-2026`).

## Bước 3 — Nạp danh sách nhân sự

1. Chuyển sang tab **Danh sách cho phép** → chọn đúng **Sự kiện**.
2. Chọn file Excel. Hệ thống tự nhận cột `NAME` và `Gender`, rồi báo số người Nam / Nữ / trống.
3. Lần đầu: bấm **Xoá cũ & nạp mới**. Bổ sung thêm người sau này: bấm **Nhập (thêm vào danh sách)**.
   Nếu file có cột **Phòng** (xếp sẵn): tích **Chia đội** rồi bấm **Xoá cũ & nạp mới + chia đội**.
   Số trong cột Phòng = thứ tự phòng trong "Danh sách đội" của sự kiện (dòng 1 = phòng 1…).
4. Sửa nhanh 1 người (sai tên / sai giới): dùng ô thêm/sửa 1 dòng ngay trong tab này.

## Bước 4 — Mở sự kiện

Trong **Danh sách sự kiện**, bấm **Mở** ở sự kiện TNT. Chỉ 1 sự kiện được mở tại một thời điểm.

## Bước 5 — Kiểm tra thử

1. Mở trang người chơi trên điện thoại (nếu vẫn thấy giao diện cũ: tải lại trang, hoặc đợi ~10 phút).
2. Nhập tên một người **Nam** trong file → chỉ phòng Nam bấm được, phòng Nữ hiện "Chỉ dành cho Nữ".
3. Thử một người **Nữ** → ngược lại.
4. Thử xong, vào admin bấm **Xóa dữ liệu** ở sự kiện để dọn lượt chọn thử (danh sách nhân sự vẫn giữ).

---

## Lưu ý & lỗi thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| "Không có trong danh sách" dù có tên | Người chơi gõ **thiếu dấu** hoặc sai chính tả. Gõ đúng như trong file (hoa/thường, khoảng trắng không quan trọng). |
| 2 người trùng họ tên | Người thứ 2 sẽ bị chặn. Sửa tên trong file cho khác nhau (vd thêm chữ cái phòng ban) và báo người đó gõ đúng như vậy. |
| Sai giới / sửa file giữa chừng | Sửa trong tab Danh sách cho phép. Người chơi **tải lại trang** mới thấy thay đổi. |
| Admin sửa phòng / số giường khi đang chạy | Người chơi phải **tải lại trang**. Không đổi/xoá phòng đã có người. |
| Admin bấm Lưu báo "Missing or insufficient permissions" | Tài khoản đăng nhập không phải tài khoản admin — dùng đúng tài khoản admin. |
| Trang vẫn giao diện cũ sau khi cập nhật | Trình duyệt còn bản cũ: tải lại trang (Ctrl+F5) hoặc đợi ~10 phút. |

## Việc kỹ thuật còn lại (cho người phụ trách code)

- **Firebase Hosting** (link `…web.app`) chưa cập nhật — khi cần, chạy ở thư mục dự án:
  `firebase deploy --only hosting`
- **Tắt giao diện TNT** sau sự kiện: trong `fe/js/config/theme.js` đổi `DEFAULT_VARIANT = 'tnt'` thành
  `DEFAULT_VARIANT = ''`, commit + push (và deploy Firebase nếu dùng).
