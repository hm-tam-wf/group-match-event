---
title: ui-pipeline
tags: [module, ui]
code: [docs/js/app.js, docs/js/ui-render.js, docs/js/ui-utils.js, docs/index.html]
related: [[index]], [[architecture]], [[design-tokens]]
updated: 2026-06-03
---

# UI Pipeline

## Script loading order (SACRED — đừng thay đổi)
```
config.js → firebase-config.js → storage.js → api.js → ui-utils.js → ui-render.js → app.js
```
Mỗi file phụ thuộc vào globals của file trước. Sai thứ tự = `ReferenceError` ngay lập tức.

## app.js — Main init flow
1. Chờ DOM ready
2. Gọi `apiSubscribe()` → setup realtime listener
3. Render initial team grid
4. Attach form submit handler
5. Poll loop (fallback nếu không có realtime)

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
