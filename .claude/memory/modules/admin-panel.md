---
title: admin-panel
tags: [module, admin]
code: [docs/admin.html, docs/js/api.js, export.js]
related: [[index]], [[architecture]], [[firestore-schema]]
updated: 2026-06-03
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

## Gotchas
- Admin HTML không có dependency ngược lại `index.html` — 2 entry points độc lập
- `signups` collection chỉ readable với admin UID (Firestore rules) — không thể đọc từ browser thường
