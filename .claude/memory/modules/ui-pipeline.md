---
title: ui-pipeline
tags: [module, ui]
code: [fe/js/app.js, fe/js/ui/ui-render.js, fe/js/ui/ui-utils.js, fe/index.html]
related: [[index]], [[architecture]], [[design-tokens]]
updated: 2026-06-03
---

# UI Pipeline

## Script loading order (SACRED — đừng thay đổi)
```
config.js → firebase-config.js → storage.js → api.js → ui-utils.js → ui-render.js → app.js
```
Mỗi file phụ thuộc vào globals của file trước. Sai thứ tự = `ReferenceError` ngay lập tức.

**Ngoài chuỗi (2 file):**
1. `js/config/theme.js` nạp ở `<head>` (TRƯỚC chuỗi trên, trên cả 2 trang) để áp
   `data-theme` trước khi vẽ → 0 FOUC. Chỉ `setAttribute` trên `<html>`.
2. `js/ui/circuit-animation.js` nạp ở CUỐI body **sau `app.js`** (chỉ ở index.html,
   KHÔNG ở admin). IIFE độc lập, 0 global, không phụ thuộc chuỗi → an toàn. Tạo
   `<canvas id="circuit-canvas">` (prepend body) vẽ xung điện cho theme `tech`.
Cả hai không phụ thuộc / không bị phụ thuộc → không phá chuỗi thiêng. Xem [[theme-system]].

## app.js — Main init flow
1. Chờ DOM ready
2. Gọi `apiSubscribe()` → setup realtime listener
3. Render initial team grid
4. Attach form submit handler
5. Poll loop (fallback nếu không có realtime)

## ⚠️ Gotcha: config đọc 1 LẦN lúc boot (reload-only)
Trang công khai chỉ realtime ở **`teams`** (`apiSubscribe` → `onSnapshot`, api.js). Còn
`config/active` và `events/{id}/meta/config` (title, capacity, icons, fields, dedup) được
`boot()` đọc **một lần** rồi gán vào globals — KHÔNG subscribe, KHÔNG poll ở chế độ firebase
(poll chỉ chạy ở nhánh sheet/demo). Hệ quả:
- Admin **sửa sự kiện đang chạy** (capacity/icons/title) ⇒ client đang mở KHÔNG thấy tới khi
  **tải lại trang**. `apiClaim` còn validate theo CAPACITY cũ trong RAM.
- **Xóa dữ liệu** (xóa teams) ⇒ lưới công khai TỰ reset 0 (teams onSnapshot bắn); teams rỗng
  vẫn render đủ ICONS ở 0/CAPACITY (không trắng trang).
- Xóa 1 icon khỏi config nhưng teams còn data ⇒ thành viên đội đó biến mất khỏi lưới (grid
  lặp theo ICONS boot-frozen) — vì vậy admin CHẶN CỨNG đổi/xóa emoji đội có người ([[admin-panel]]).

## ui-render.js — Rendering
- `renderTeamGrid()` — render toàn bộ team tiles với count/capacity
- `renderModal()` — confirm modal trước khi join
- `renderJoinCelebration()` — confetti + popup chúc mừng sau khi join thành công
- `renderProfileSummary()` — hiển thị thông tin người đã join (từ localStorage)

## Confetti implementation
Không dùng canvas hay library. Dùng `<i>` elements + CSS keyframes (`cfFall`, `jmPop`). Respects `prefers-reduced-motion`.

## ui-utils.js — Helpers
- MODE detection (xem api-layer [[api-layer]])
- Local state management
- Toast notifications
- Validation helpers

## Responsive
- Breakpoint duy nhất: `@media (max-width: 560px)`
- Mobile-first cho event dùng điện thoại

## Empty state
SVG inline (không dùng emoji hay image) để tránh font fallback issues trên các thiết bị khác nhau.
