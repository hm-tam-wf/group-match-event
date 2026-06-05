---
title: theme-system
tags: [ui, component, theme]
code: [docs/js/config/theme.js, docs/assets/themes.css, docs/assets/styles.css, docs/index.html, docs/admin.html]
related: [[design-tokens]], [[ui-pipeline]], [[conventions]], [[index]]
updated: 2026-06-05
---

# Theme System — đổi giao diện bằng 1 cờ

Cơ chế đổi giao diện toàn site **bằng cấu hình trong code** (không UI bật/tắt cho
end-user). Đơn giản: CSS variables + `data-theme` + 1 cờ. Không framework, không
build, không dependency, không module — tôn trọng [[ui-pipeline]] (thứ tự script).

## Một nguồn sự thật
- Cờ duy nhất ở [theme.js](../../docs/js/config/theme.js): `const ACTIVE_THEME =
  'default'|'tech'` (+ `ACTIVE_VARIANT` tuỳ chọn). File này nạp ở **`<head>`** trên
  CẢ 2 trang (TRƯỚC khi vẽ) → set `data-theme`/`data-variant` không nháy (**0 FOUC**).
  Độc lập, ngoài chuỗi nạp thiêng (chỉ `setAttribute` trên `<html>`) — xem [[ui-pipeline]].
- (Trước đây cờ ở config.js — đã chuyển sang theme.js để 0 FOUC; config.js để lại
  comment trỏ tới.)
- Đổi giao diện = đổi **đúng chuỗi đó**. KHÔNG hardcode tên theme ở chỗ khác.
- Cả `index.html` và `admin.html` đều link `assets/themes.css` + nạp `theme.js`.

## Biến thể theo sự kiện (§E.3 — tuỳ chọn)
`ACTIVE_VARIANT='eventX'` đặt thêm `data-variant`; khối
`[data-theme="tech"][data-variant="eventX"]` kế thừa toàn bộ token theme nền, chỉ
override `--page-bg-image` + 1–2 màu nhấn. Mặc định `''` ⇒ INERT (ảnh trong url()
không tải). Mỗi dịp = 1 khối nhỏ, không nhân bản cả theme.

## Admin cũng có theme (scope riêng)
admin.html có `:root` + bộ token RIÊNG (`--ink/--pri/--grad/--card-2/--accent-soft
/--danger`…). Vì vài token TRÙNG tên với app chính (`--bg/--card/--line/--accent
/--r-lg`) mà 2 trang chung `themes.css`, override admin được **scope vào
`[data-theme="tech"] body.admin`** (specificity cao hơn `:root` inline → thắng dù
nạp trước; KHÔNG đụng app chính vì app chính không có `body.admin`). admin.html
thêm `class="admin"` ở `<body>`. **GOTCHA:** khối tech app-chính (đặt token trên
`<html>`) RÒ token trùng tên sang admin → khối admin phải **set lại** (`--r-lg`).
Theme admin mới (tối) → copy cụm `body.admin` này (token + bề mặt hardcode admin:
`.cm-box` trắng, `.btn-ghost`, input `:focus`#fff, body radials, `.form-mode.edit`…).

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
