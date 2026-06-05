---
title: theme-system
tags: [ui, component, theme]
code: [docs/js/config/config.js, docs/assets/themes.css, docs/assets/styles.css, docs/index.html]
related: [[design-tokens]], [[ui-pipeline]], [[conventions]], [[index]]
updated: 2026-06-05
---

# Theme System — đổi giao diện bằng 1 cờ

Cơ chế đổi giao diện toàn site **bằng cấu hình trong code** (không UI bật/tắt cho
end-user). Đơn giản: CSS variables + `data-theme` + 1 cờ. Không framework, không
build, không dependency, không module — tôn trọng [[ui-pipeline]] (thứ tự script).

## Một nguồn sự thật
- Cờ duy nhất: `const ACTIVE_THEME = 'default' | 'tech'` trong
  [config.js](../../docs/js/config/config.js) (script nạp **đầu tiên** → áp sớm,
  tránh FOUC). Ngay sau khi khai báo:
  `document.documentElement.setAttribute('data-theme', ACTIVE_THEME)`.
- Đổi giao diện = đổi **đúng chuỗi đó**. KHÔNG hardcode tên theme ở chỗ khác.
- `index.html` và `admin.html` **dùng chung** config.js nên cả hai tự set
  `data-theme`. Nhưng chỉ `index.html` link `assets/themes.css`; **admin.html
  KHÔNG** → admin nhận attribute nhưng không có rule nào match ⇒ giữ nguyên 100%
  (admin có theme inline riêng, xem [[design-tokens]] / [[admin-panel]]).

## Tại sao không bọc fallback (khác prompt)
`styles.css` **đã tokenized sẵn** bằng `:root` CSS vars (`--bg`, `--card`, `--text`,
`--accent`…). Nên `:root` chính là default; theme chỉ **override** các token đó trong
`[data-theme="..."]`. ⇒ **KHÔNG đụng styles.css**, không tạo bộ `--color-*` mới
(tránh refactor toàn CSS) → default bất biến tuyệt đối, diff tối thiểu.

## Thêm theme mới (1 khối CSS, không sửa JS/HTML)
1. Copy khối TEMPLATE trong [themes.css](../../docs/assets/themes.css), đổi tên,
   điền màu (override token đã có trong `styles.css :root`).
2. Đổi `ACTIVE_THEME = 'ten-theme'` trong config.js. Hết.

## GOTCHA — bề mặt HARDCODE (không qua token)
Theme **tối** phải override thêm vì các chỗ này dùng màu sáng cứng trong styles.css:
- `body::before` — nền trang thật là **4 radial pastel hardcode** (KHÔNG phải
  `var(--bg)`); override `--bg` một mình **không** đổi nền nhìn thấy.
- `.modal` (gradient trắng), `.modal-bg` (overlay), `.toast` (trắng mờ),
  `.field input` (+ `:focus` nền `#fff`), `.tile`/`.banner` (gradient trộn `#fff`),
  `.empty-note`/`.hint`/`.all-full`, các nút `.cancel`/`.pick.lock`/`.mini.more`.
- `--c` (màu mỗi đội) do JS bơm runtime → theme không kiểm soát, chỉ trộn nền tối.
Khối `[data-theme="tech"]` đã xử lý đủ các chỗ trên — theme tối mới copy y cụm đó.

## Token có-thể-đổi-theme (dùng lại của styles.css)
`--bg --surface --card --card-alt --text --muted --muted-2 --line --err --accent
--candy --sh-soft --sh-card --sh-pop --r-lg --r-xl` (font `--display/--body` để
trống = giữ). Token riêng theme nền-ảnh: `--page-bg-image` (`none` = nền CSS;
`url('img/<file>')` đặt ảnh ở `docs/assets/img/`) + `--page-bg-overlay` (lớp phủ
giữ tương phản). 1 rule `body::before` lo cả nền-CSS lẫn nền-ảnh; đổi cách = đổi
**1 token**.

## Theme `tech` (đã có)
Concept công nghệ: navy `#0a1430`, xanh điện `#2f7bff`, đỏ nhấn `#ff3b51`, viền
mảnh glow, chữ sáng. Verify: contrast đạt, default không đổi (screenshot so sánh).
