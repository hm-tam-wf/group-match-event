---
title: ui-pipeline
tags: [module, ui]
code: [fe/js/app.js, fe/js/ui/ui-render.js, fe/js/ui/ui-utils.js, fe/index.html]
related: [[index]], [[architecture]], [[design-tokens]], [[theme-system]], [[allowlist]]
updated: 2026-09-29
---

# UI Pipeline

## Script loading order (SACRED — đừng thay đổi)
```
config.js → themes/tech/strings.js → themes/tech/variants/tnt/strings.js → js/config/profile.js → firebase-config.js → storage.js → api.js → ui-utils.js → ui-render.js → app.js
```
(`theme.js` nạp riêng trong `<head>`; từ 2026-11-10 nó còn cung cấp `eventIdFromUrl`/`setActiveVariant`/cache hồ sơ cho
profile.js + app.js — xem [[event-profile]].)
Mỗi file phụ thuộc vào globals của file trước. Sai thứ tự = `ReferenceError` ngay lập tức.
`themes/tech/strings.js` (text riêng-theo-theme, merge vào `STRINGS` — xem [[i18n-system]]) chỉ phụ
thuộc config.js; CHỈ index.html nạp (admin.html không có). Nếu thiếu/sai chỗ ⇒ `TEXT.tech` undefined.
`variants/tnt/strings.js` phải SAU tech/strings.js và TRƯỚC `profile.js`: từ 2026-11-10 nó CHỈ
`registerVariantCopy("tnt", …)` (không sửa STRINGS/LANG/TEXT); `profile.js` dựng TEXT + chuyển LANG theo hồ sơ sự kiện,
phải TRƯỚC mọi file UI. CSS: `tnt.css` link SAU chip.css.

**Lưới + giới tính (2026-09-29):** `renderState` tính `gLocked` (phòng gắn giới ≠ `myGender`) ⇒ tile `disabled`
+ `gender-lock` + nhãn `grid.tileGender`; `openForMe` = 0 mà còn phòng ⇒ `#freeHint` = `grid.genderFull`.
Xem [[allowlist]] §giới tính.

**Ngoài chuỗi (2 file):**
1. `js/config/theme.js` nạp ở `<head>` (TRƯỚC chuỗi trên, trên cả 2 trang) để áp
   `data-theme` trước khi vẽ → 0 FOUC. Chỉ `setAttribute` trên `<html>`.
2. `themes/tech/circuit.js` nạp ở CUỐI body **sau `app.js`** (chỉ ở index.html,
   KHÔNG ở admin). IIFE độc lập, 0 global, không phụ thuộc chuỗi → an toàn. Tạo
   `<canvas id="circuit-canvas">` (prepend body) vẽ xung điện cho theme `tech`.
Cả hai không phụ thuộc / không bị phụ thuộc → không phá chuỗi thiêng. Xem [[theme-system]].

**Thứ tự CSS `<link>` ở `<head>` (cascade, riêng với chuỗi JS):**
`styles.css` (base/`:root` default) → `themes.css` (BASE/registry, KHÔNG rule active) →
`themes/tech/tech.css` (khối `[data-theme="tech"]`) → `themes/tech/chip.css` (tùy biến chip
cyan — index.html-only, phải SAU tech.css để đè `.tile .ic`/`.banner .bi`; INERT nếu
data-theme≠tech). admin.html KHÔNG nạp CSS theme — chỉ `assets/admin.css` (UI riêng, từ 2026-11-10).
Mỗi theme gói trong `fe/themes/<tên>/` — xem [[theme-system]].

## app.js — Main init flow
1. Chờ DOM ready
2. Gọi `apiSubscribe()` → setup realtime listener
3. Render initial team grid
4. Attach form submit handler
5. Poll loop (fallback nếu không có realtime)

**Cổng LỊCH theo giờ (2026-06-17):** sau khi `boot()` nạp config, KHÔNG gọi `init()` thẳng nữa mà qua
`startSchedule()` (app.js): `eventPhase()` theo `OPEN_AT`/`CLOSE_AT` → trước giờ mở = `#preOpen` đếm ngược
(tự `goLiveNow()` khi tới giờ, không reload); sau giờ đóng = `#eventClosed`; trong khung = `goLiveNow()`
(= hiện appContent + `init()` + hẹn giờ tự khoá khi tới closeAt). Chốt cứng ở rules `inWindow()`. Xem [[firestore-schema]].

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
- `_travelSmoothBack()` (nút Huỷ/Quay lại → trang travel/home, code Antigravity 72b5506): làm mờ `body` rồi rời trang. GOTCHA đã sửa
  2026-11-10: (1) bấm Back của trình duyệt ⇒ bfcache khôi phục trang NGUYÊN TRẠNG kể cả `opacity:0` ⇒ trắng xoá (verified live) —
  listener `pageshow` (`e.persisted`) trả lại opacity; (2) chỉ tin referrer CÙNG origin (`_homeReferrer`) — trước đó mọi referrer kết
  thúc bằng "/" (facebook.com/) bị coi là "trang chủ". Vẫn áp cho MỌI event (fallback `travel.html`) ⇒ giai đoạn 2: `homeUrl` per-event.
- `esc`/`initial`/`firstName` (ui-utils.js) ép kiểu qua `_str()` — `teams[*].names` từ server có thể không phải chuỗi; trước đây 1 phần
  tử sai kiểu làm `renderState` ném TypeError trên MỌI máy. `myIcon` không còn trong ICONS ⇒ banner dựng tạm từ icon (không ném lỗi).

### Hai khu lưới trong `renderState()` (ui-render.js)
1. **`#grid` "còn chỗ"** — đội `count < CAPACITY` (tile để JOIN, có cap-bar + avatar chips).
2. **`#taken` "completed Successfully"** — TRƯỚC: chỉ đội ĐỦ người. NAY (2026-06): liệt kê MỌI
   đội `count >= 1` (đang ghép + đã đủ) để roster hiện ngay khi có người join. Một đội đang ghép
   xuất hiện ở CẢ hai khu (chủ đích: khu 1 để join, khu 2 để xem danh sách). Sắp xếp: đủ-người
   lên đầu → số thành viên giảm dần → giữ thứ tự ICONS gốc (ổn định). Phân biệt qua class
   `.is-full` (đội ĐÃ KHOÁ/CHỐT: badge đặc màu đội + `✓` qua CSS `::before`; nhãn `.lab` =
   ổ khoá `LOCK_SVG` inline + `TEXT.grid.ftLocked` "Locked"/"Đã chốt") vs `.is-forming` (viền nét
   đứt, nền mờ, badge rỗng magenta/`--accent`, nhãn `.lab` = `TEXT.grid.ftForming` "In progress"/"Đang ghép").
   Badge đếm header `#takenCount` = SỐ ĐỘI CÓ NGƯỜI (gồm đang ghép), KHÔNG chỉ đội đủ.
   CSS phân biệt nằm ở styles.css (base) + tech.css (`[data-theme="tech"] .full-team.is-*`).
   `LOCK_SVG` (ui-render.js, cạnh `EMPTY_SVG`) dùng `fill/stroke=currentColor` → kế thừa màu `.lab`
   (xám base, cyan-glow tech). Đội đủ KHÔNG có ở `#grid` (biến mất khi `count >= CAPACITY`) ⇒ "khoá
   nút join" thể hiện ở khu `#taken` qua trạng thái Đã chốt, KHÔNG phải nút bị disable ở lưới join.

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
