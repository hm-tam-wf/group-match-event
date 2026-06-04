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

## Admin — tab "Danh sách cho phép" (`tab-allowlist` trong `admin.html`)
Dropdown sự kiện → trạng thái (dedupField/đếm/toggle `allowlistMode`) → import **SheetJS (CSV/XLSX)**:
chọn cột khớp `dedupField` (+ cột tên tuỳ chọn, regex `họ tên|name|tên`), `buildItems` chuẩn hoá key
bằng `_dedupKey`, dedup nội bộ, batch ≤400. Thêm/Thay-thế, bảng tìm kiếm, tải CSV, xoá từng dòng.
Toggle trong form Tạo/Sửa (`fAllowlistMode`) phụ thuộc có chọn `dedupField` (`syncAllowlistToggle`).

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
