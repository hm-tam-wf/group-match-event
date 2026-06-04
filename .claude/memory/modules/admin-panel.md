---
title: admin-panel
tags: [module, admin]
code: [docs/admin.html, docs/js/api.js, export.js]
related: [[index]], [[architecture]], [[firestore-schema]]
updated: 2026-06-04
---

# Admin Panel

## Overview
`docs/admin.html` là trang riêng biệt (không link từ index). Admin đăng nhập Firebase → xem danh sách signups → export.

## Auth flow
Firebase Authentication (email/password). UIDs được hardcode trong `firestore.rules`:
- Thêm/xoá admin = sửa rules file + publish lên Firebase Console (manual)
- **Gotcha:** Có 2 admin UIDs. Nếu tạo lại tài khoản Firebase = UID thay đổi = phải cập nhật rules

## Export
- `export.js` — Node.js script local, dùng `firebase-admin` SDK
- Output: CSV với full PII từ `signups` collection
- Cần `serviceAccountKey.json` (gitignored)
- Command: `npm run export`

## Design theme
Admin panel có theme riêng (back-office) nhưng dùng cùng font:
- Background: purple-gray (`--bg: #F4F2FC`, `--surface: #FFFFFF`)
- Primary: `--pri: #7857E6`, accent: `--accent: #A98CFF`
- Gradient: `--grad: linear-gradient(135deg, #7857E6, #A98CFF)`
- Font: Baloo 2 + Nunito (same as main app)

## Quản lý sự kiện (trong `docs/admin.html`)
Tab "Quản lý sự kiện" = dashboard + CRUD vòng đời. Tất cả nằm trong IIFE của admin.html.
- **Danh sách sự kiện** đọc từ registry `config/eventList = { ids:[...] }` (KHÔNG dùng
  collectionGroup). Mỗi id → đọc `meta/config` + `teams` để tính chỉ số:
  `registrations = Σ team.count`, `teamsFull`, `fillRate`, status (Đang chạy/Đã kết thúc).
- **Xóa dữ liệu** (`clearEvent`→`clearEventData`): xóa hết `signups/members/dedup_keys/teams`
  (PHẢI có teams để count về 0), GIỮ `meta/config`. `deleteAll` lặp batch ≤400, có chặn vô hạn
  (200 vòng) phòng sự kiện đang chạy nhận đăng ký liên tục.
- **Xóa sự kiện** (`deleteEvent`): chỉ khi KHÔNG đang chạy & `signups` rỗng (limit(1).empty).
  Batch: `arrayRemove` id khỏi `config/eventList` **+** delete `meta/config` (quên arrayRemove
  ⇒ ghost row). Có nhánh "gỡ mục hỏng" cho id thiếu meta/config.
- **Sửa sự kiện** (`editEvent`/`saveEdit`): dùng lại form tạo, khóa `fId` readonly, lưu bằng
  `.set(..., {merge:true})` + `updatedAt` (KHÔNG ghi `createdAt` ⇒ giữ gốc). CHẶN CỨNG xóa/đổi
  emoji của đội có người (emoji = khóa định danh `teams/{icon}`); cảnh báo giảm capacity dưới
  đội đông nhất; báo đổi dedup chỉ áp dụng lượt mới.
- **Xác nhận xóa**: `confirmModal({ requireText: eid })` bắt gõ lại ID, nút Xác nhận disabled
  tới khi khớp, `danger:true`.
- ⚠️ Sửa sự kiện đang chạy KHÔNG live trên trang công khai — xem [[ui-pipeline]] (config
  reload-only). Success message nhắc admin/người dùng phải tải lại trang.

## Danh sách cho phép (allowlist) — đã có
- [[allowlist]] — tab riêng "Danh sách cho phép": import SheetJS (CSV/XLSX), bảng tìm kiếm,
  tải CSV, toggle `allowlistMode` theo sự kiện. Tái dùng `xlsx-0.20.3` (CDN) cũng dùng cho export.

## Cấu hình field — `validateForm`/`resetForm` (từ 2026-06-04)
- `validateForm` BẮT BUỘC có field `key:"name"` (required) + chặn key trùng — app dùng
  `me.fields.name` làm tên hiển thị (hợp đồng trong [[firestore-schema]]). Thiếu ⇒ chặn lưu.
- `resetForm(seed=true)` seed sẵn `DEFAULT_FIELDS` (name+employeeId) cho form tạo mới;
  `populateForm` gọi `resetForm(false)` (Sửa/Nhân bản tự thêm field của sự kiện, tránh nhân đôi).

## Gotchas
- Admin HTML không có dependency ngược lại `index.html` — 2 entry points độc lập
- `signups` collection chỉ readable với admin UID (Firestore rules) — không thể đọc từ browser thường
- Sau 2026-06-03: admin có quyền `delete` 4 collection (rules) — xóa PII là KHÔNG hồi phục. Xem [[firestore-schema]].
