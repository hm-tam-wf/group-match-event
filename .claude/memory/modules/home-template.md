---
title: home-template
tags: [module, home, reuse]
code: [fe/home.html, fe/js/home/home-schema.js, fe/js/home/home-strings.js, fe/js/home/home-render.js, fe/js/home/home-sheets.js, fe/js/home/home.js, fe/assets/home.css, fe/js/admin/home-editor.js, fe/assets/admin-home.css, backend/seed/home-tnt.json, backend/scripts/home-import.js, documentation/md/HOME-TEMPLATE.md]
related: [[event-profile]], [[admin-panel]], [[theme-system]], [[firestore-schema]]
updated: 2026-11-11
---

# Trang home dùng chung (bước 3B) — `home.html?e=<eventId>`

Thay trang tĩnh `travel.html` (TNT, Antigravity) bằng template đọc `events/{id}/meta/home`. Tài liệu đầy đủ + schema:
[HOME-TEMPLATE.md](../../documentation/md/HOME-TEMPLATE.md).

- **Schema** `HomeSchema` (UMD, Node `require` được): hero, cta, footer, pageTitle, `sections[]` có thứ tự theo `type`
  (timeline | notes | dresscode | transport | text; type lạ GIỮ NGUYÊN dữ liệu). Trang dùng `normalize` (khoan dung), editor +
  script dùng `validate` (chặt). Rules sẵn có `meta/{doc}` (read true / write admin) — không sửa rules.
- **Trang**: markup giữ class của travel.html ⇒ dùng lại nguyên `travel/travel.css` (⇒ GIỮ travel.css nếu sau này gỡ travel.html);
  nạp theme.js → config.js → profile.js → firebase-config.js → home-*.js; `<html data-event-page>` (cache hồ sơ chung khoá với
  index). Chọn sự kiện = quy tắc index (map domain hỏng ⇒ chặn). home.css tắt `@view-transition` của travel.css.
- **Editor** `HomeEditor.mount(el, { db, eventId, previewBase })` / `unmount()` / `isDirty()`; Excel ⇄ doc qua `HomeSheets`
  (dòng lịch trình rỗng bị bỏ; giờ/ngày gõ ngoài vùng đã xuất có thể bị Excel đổi định dạng). Hai admin sửa cùng lúc: bản sau thắng.
- **Seed** `backend/seed/home-tnt.json` = đủ 245 chuỗi travel/data.js — nội dung CÓ VẺ LÀ MẪU (SĐT, "Số 123 Nguyễn Huệ") ⇒ BTC xác
  nhận trước khi `node backend/scripts/home-import.js --event <id> --file … --apply` (mặc định dry-run + diff; nhận .json/.xlsx).
  Sau khi nạp: đặt `profile.homeUrl = "home.html?e=<id>"` để nút Huỷ về trang home mới.
- **Lỗi có sẵn (vô hại)**: travel.css có `@view-transition` mà index chưa opt-in ⇒ InvalidStateError khi travel → index.
- **Gotcha test**: puppeteer `setViewport` có isMobile/hasTouch ⇒ reload trang; screenshot puppeteer 23 là Uint8Array; Firestore
  đọc lại map với key đã sắp xếp ⇒ so sánh JSON chuẩn hoá; ghi với quyền admin trên emulator: `useEmulator(h, p, { mockUserToken: { sub: uid } })`.
- Test trong repo: unit home-schema/home-sheets/home-render, scripts home-import, e2e b98-home-page + b98-home-editor, admin home-hook.
