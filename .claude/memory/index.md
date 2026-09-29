# Project Memory — Index (Map of Content)

> Hub điều hướng. SessionStart hook inject file này vào đầu mỗi session.
> Đọc trước khi mở source files. Giữ file này ngắn gọn, dễ scan.

## Start here
- [[conventions]] — commands, code style, git conventions
- [[architecture]] — tổng quan hệ thống và cách các phần kết nối

## Modules
- [[api-layer]] — 3 backends (firebase/sheet/demo), apiState/apiClaim/apiSubscribe
- [[ui-pipeline]] — script loading order (sacred!), render pipeline, animation
- [[admin-panel]] — Firebase Auth, export CSV, hardcoded UID gotcha
- [[firestore-schema]] — collections, security rules, capacity sync gotcha
- [[allowlist]] — danh sách MSNV được phép join: import Excel/CSV, toggle/sự kiện, cổng chặn client (mirror dedup); cột Giới tính → phân phòng Nam/Nữ

## UI & components
- [[design-tokens]] — Soft Cloud Candy palette, fonts Baloo 2 + Nunito, motion
- [[theme-system]] — đổi giao diện bằng 1 cờ ACTIVE_THEME (theme.js, 0 FOUC) + data-theme; biến thể sự kiện (DEFAULT_VARIANT / ?variant=; `tnt` = brand TNT, Mini Outing); theme `tech` (cả app + admin)
- [[i18n-system]] — đổi ngôn ngữ UI bằng 1 cờ LANG (registry STRINGS en/vi + TEXT trong config.js); ?lang= override; tách text hardcode vs tầng config per-event; biến thể được chuyển LANG + ghi đè copy

## Decisions (ADRs)
- [[0000-template]] — template cho mỗi quyết định kiến trúc
- [[0001-gender-rooms-from-allowlist]] — phân phòng Nam/Nữ: giới lấy từ Danh sách cho phép (không tự chọn), khoá ở client, không đổi rules

---

### Cách dùng
1. Đọc top-to-bottom để orient.
2. Follow `[[wikilinks]]` đến note liên quan đến task hiện tại.
3. Khi tạo note mới, thêm link vào đây dưới heading phù hợp.
