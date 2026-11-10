# Project Memory — Index (Map of Content)

> Hub điều hướng. SessionStart hook inject file này vào đầu mỗi session.
> Đọc trước khi mở source files. Giữ file này ngắn gọn, dễ scan.

## Start here
- [[conventions]] — commands, code style, git conventions
- [[architecture]] — tổng quan hệ thống và cách các phần kết nối

## Modules
- [[api-layer]] — 3 backends (firebase/sheet/demo), apiState/apiClaim/apiSubscribe
- [[ui-pipeline]] — script loading order (sacred!), render pipeline, animation
- [[admin-panel]] — Firebase Auth, export CSV, hardcoded UID gotcha; UI dashboard tối: sidebar, 4 trang, drawer form
- [[firestore-schema]] — collections, security rules, capacity sync gotcha
- [[allowlist]] — danh sách MSNV được phép join: import Excel/CSV, toggle/sự kiện, cổng chặn client (mirror dedup); cột Giới tính → phân phòng Nam/Nữ
- [[event-profile]] — hồ sơ sự kiện `meta/config.profile` (skin/ngôn ngữ/logo/câu chữ/homeUrl/introMs, thiếu key = cũ) + chọn sự kiện `?e=` > `config/hosts` > `config/active`; hosts.js; rollout config/hosts trước push

## UI & components
- [[design-tokens]] — Soft Cloud Candy palette, fonts Baloo 2 + Nunito, motion
- [[theme-system]] — đổi giao diện bằng 1 cờ ACTIVE_THEME (theme.js, 0 FOUC) + data-theme; biến thể sự kiện (chọn bằng profile.variant — [[event-profile]]; DEFAULT_VARIANT = mặc định cũ; ?variant= xem trước; `tnt` = brand TNT, Mini Outing); theme `tech` (chỉ app); admin dùng UI riêng `assets/admin.css` (không theo theme sự kiện)
- [[i18n-system]] — đổi ngôn ngữ UI bằng 1 cờ LANG (registry STRINGS en/vi + TEXT trong config.js); ?lang= override; tách text hardcode vs tầng config per-event; biến thể được chuyển LANG + ghi đè copy

## Decisions (ADRs)
- [[0000-template]] — template cho mỗi quyết định kiến trúc
- [[0001-gender-rooms-from-allowlist]] — phân phòng Nam/Nữ: giới lấy từ Danh sách cho phép (không tự chọn), khoá ở client, không đổi rules
- [[0002-cross-device-lookup]] — 1 người = 1 phòng trên mọi thiết bị: `dedup_keys` mang `icon`, so tên bất đối xứng (k1 + `m~fold` cho tên có dấu; hộp xác nhận gõ thiếu dấu), remote view, go-live order

---

### Cách dùng
1. Đọc top-to-bottom để orient.
2. Follow `[[wikilinks]]` đến note liên quan đến task hiện tại.
3. Khi tạo note mới, thêm link vào đây dưới heading phù hợp.
