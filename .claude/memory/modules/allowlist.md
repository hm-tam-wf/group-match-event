---
title: allowlist
tags: [module, feature]
code: [docs/admin.html, docs/js/api.js, docs/js/app.js, docs/js/ui-render.js, docs/js/ui-utils.js, firestore.rules, sample-allowlist/]
related: [[index]], [[api-layer]], [[admin-panel]], [[firestore-schema]], [[ui-pipeline]]
updated: 2026-06-04
---

# Allowlist (danh sách MSNV được phép join)

Khi BẬT cho một sự kiện: chỉ định danh (giá trị `DEDUP_FIELD`, vd MSNV) nằm trong danh sách
mới được vào lưới + join đội. Enforce **phía client**, mô phỏng y hệt cổng chống trùng
([[api-layer]] dedup). Mặc định TẮT ⇒ tương thích ngược 100% (mọi người join như cũ).

## Schema & cấu hình
- `events/{id}/allowlist/{key}` — `key = _dedupKey(<giá trị dedupField>)`, doc `{ name?, at }`.
  `_dedupKey` = `trim().toUpperCase().replace(/\s+/g,"")` — **giống hệt** `dedup_keys` để import & claim khớp.
- `events/{id}/meta/config.allowlistMode` (bool). `ALLOWLIST_MODE` khai báo ở `firebase-config.js`,
  `boot()` đọc lại từ config. Đối chiếu theo `dedupField` (độc lập `blockDup`).

## Enforce phía client (mirror dedup — xem [[api-layer]])
- **`apiClaim`** (`api.js`): đọc `allowlist/{key}` trong CÙNG `Promise.all` của transaction
  → `reason:"notAllowed"` nếu !exists (sau already/dup, trước full). Đọc-trước-ghi GIỮ NGUYÊN.
  Early-return `notAllowed` nếu bật mode mà không có giá trị định danh.
- **Cổng vào trang** (chống "vào được lưới rồi join lỗi"): `apiAllowlistAllowed(value)` (`api.js`,
  đọc 1 doc, fail-open khi lỗi mạng) + state `allowBlocked` (`ui-utils.js`). Dùng ở `init()`
  (`app.js`), `save()` + `canJoin` (`ui-render.js`), modal `showAllowBlockedModal`/`closeAllowBlockedModal`.
  `doClaim` nhánh `notAllowed` bật `allowBlocked` + `apiRemoveProfile` (dọn hồ sơ).
- **demo**: gate bằng `sGet("allowlistMode")` + `sGet("allowlist")` (seed tay khi dev).
- `loadtest.js`: mirror nhánh allowlist (giữ TẮT để test phản ánh production).

## Hợp lệ & khớp HỌ TÊN (2026-06-04)
- **Tên hợp lệ** (`validName`, `ui-utils.js`): ≥2 ký tự & có ≥1 chữ cái (`/\p{L}/u`) → chặn tên rác
  ("123","!!!"). `fieldError` cũng **ép field `name` luôn required** (vá lỗ tên rỗng ở sự kiện cũ).
- **Toggle riêng `allowlistNameCheck`** (opt-in, **mặc định TẮT**): khớp tên chỉ chạy khi
  `ALLOWLIST_MODE && ALLOWLIST_NAMECHECK`. Tắt → chỉ kiểm có-trong-danh-sách, không xét tên.
  Sự kiện cũ thiếu cờ ⇒ boot không gán ⇒ `ALLOWLIST_NAMECHECK=false` ⇒ tương thích ngược.
  Bật ở 2 chỗ: checkbox `fAllowlistNameCheck` trong form Tạo/Sửa (con của `fAllowlistMode`,
  xám/khoá khi allowlist tắt) + nút nhanh `alNameCheck` ở tab Danh sách cho phép (khi tắt
  allowlist → tự bỏ tích + lưu false, tránh kẹt stale). Lưu vào `meta/config.allowlistNameCheck`.
- **Khớp tên với danh sách** (CHỈ khi `ALLOWLIST_NAMECHECK` BẬT & dòng CÓ cột tên): tên nhập phải
  khớp tên đã import sau chuẩn hoá `_normName` (`api.js`: bỏ dấu tiếng Việt + gộp trắng + IN HOA;
  dải dấu kết hợp U+0300..036F dựng bằng `String.fromCharCode` để tránh ký tự vô hình trong nguồn).
  Dòng KHÔNG có tên → bỏ qua. "Lê Văn A" ↔ "le van a" coi là khớp.
  - Lớp 1 (UX): `apiAllowlistInfo(value)`→`{allowed,name}`, dùng ở `save()` (`ui-render.js`) → lệch
    thì báo lỗi inline ô họ tên, GIỮ popup để sửa, KHÔNG ghi.
  - Lớp 2 (chốt): transaction `apiClaim` trả `reason:"nameMismatch"` (so trên `al` ĐÃ đọc trong
    `Promise.all`, KHÔNG thêm read, KHÔNG đổi thứ tự đọc-ghi). `doClaim` (`app.js`) gặp `nameMismatch`
    → `editing=true` mở lại popup để sửa (hồ sơ đã khoá sửa sau khi điền xong).
  - **Gotcha**: `/\s/` JS không match U+200B/U+00AD (ký tự vô hình từ paste) → lọt qua `_normName`
    → có thể báo lệch tên oan khi dán từ chat/PDF. Hiếm, recoverable, chưa vá.
- `apiAllowlistAllowed` nay là wrapper mỏng của `apiAllowlistInfo`.

## Admin — tab "Danh sách cho phép" (`tab-allowlist` trong `admin.html`)
Dropdown sự kiện → trạng thái (dedupField/đếm/toggle `allowlistMode`) → import **SheetJS (CSV/XLSX)**:
chọn cột khớp `dedupField` (+ cột tên tuỳ chọn, regex `họ tên|name|tên`), `buildItems` chuẩn hoá key
bằng `_dedupKey`, dedup nội bộ, batch ≤400. Thêm/Thay-thế, bảng tìm kiếm, tải CSV, xoá từng dòng.
Toggle `fAllowlistMode` trong form phụ thuộc `dedupField` (`syncAllowlistToggle`); toggle `fAllowlistNameCheck`
(con) phụ thuộc `fAllowlistMode` (`syncNameCheckToggle`). Cả hai toggle có bản nút nhanh ở tab (`alMode`/`alNameCheck`).

## Rules ([[firestore-schema]])
`match /allowlist/{key}` → `get: if true` (client tx đọc theo key đã biết) · `list/write: if isAdmin()`
(chống enumerate; admin import). Đã DEPLOY trên project `icon-picker` (kiểm bằng REST 2026-06-04).

## Gotchas
- **Enforce chỉ ở client** (rules chỉ mở `get`, KHÔNG bắt buộc "phải có trong list mới ghi được team").
  Giống dedup — chấp nhận được cho app nội bộ; muốn chặn cứng phải thêm luật rules.
- **Reload-only**: bật allowlist không "live" trên tab công khai đang mở — phải tải lại trang.
- **Bật mode + danh sách RỖNG = khoá tất cả**. Tab có cảnh báo đỏ `alWarnEmpty`.
- Xoá hẳn sự kiện có `deleteAll(events/{id}/allowlist)`; "Xóa dữ liệu" (`clearEventData`) KHÔNG đụng allowlist.
- JSON mẫu (A/B/C) KHÔNG được importer dùng (importer là tabular CSV/XLSX) — chỉ để tham khảo.

## Fixtures (`sample-allowlist/`, đã commit) — 20 MSNV `NV2026001…020`
`-A.json` mảng string · `-B.json` mảng object `{employeeId,hoTen}` · `-C.json` map · `.csv` header
`employeeId,hoTen` · `.xlsx` cùng cột. Test parser bằng `xlsx@0.18.5` (xem auto-memory: node-test-browser-code).
