---
title: theme-system
tags: [ui, component, theme]
code: [fe/js/config/theme.js, fe/assets/themes.css, fe/assets/styles.css, fe/index.html, fe/admin.html]
related: [[design-tokens]], [[ui-pipeline]], [[conventions]], [[index]]
updated: 2026-06-05
---

# Theme System — đổi giao diện bằng 1 cờ

Cơ chế đổi giao diện toàn site **bằng cấu hình trong code** (không UI bật/tắt cho
end-user). Đơn giản: CSS variables + `data-theme` + 1 cờ. Không framework, không
build, không dependency, không module — tôn trọng [[ui-pipeline]] (thứ tự script).

## Một nguồn sự thật
- Cờ duy nhất ở [theme.js](../../fe/js/config/theme.js): `const ACTIVE_THEME =
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
1. Copy khối TEMPLATE trong [themes.css](../../fe/assets/themes.css), đổi tên,
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
- **`h1` là chữ-gradient** (`background:gradient` + `background-clip:text` + `color:
  transparent`). Override `background` (shorthand) trong theme **RESET background-clip
  → border-box** ⇒ gradient lấp đầy khung, chữ vô hình (MẤT tiêu đề). Phải khai lại
  `-webkit-background-clip:text; background-clip:text;` sau khi đổi background.
Khối `[data-theme="tech"]` đã xử lý đủ các chỗ trên — theme tối mới copy y cụm đó.

## Token có-thể-đổi-theme (dùng lại của styles.css)
`--bg --surface --card --card-alt --text --muted --muted-2 --line --err --accent
--candy --sh-soft --sh-card --sh-pop --r-lg --r-xl` (font `--display/--body` để
trống = giữ). Token riêng theme nền-ảnh: `--page-bg-image` (`none` = nền CSS;
`url('img/<file>')` đặt ảnh ở `fe/assets/img/`) + `--page-bg-overlay` (lớp phủ
giữ tương phản). 1 rule `body::before` lo cả nền-CSS lẫn nền-ảnh; đổi cách = đổi
**1 token**.

## Theme `tech` — palette "TECH FUTURE KV" (token-first)
Concept tech tương lai. **11 màu CHÍNH THỨC** (nguồn chân lý duy nhất), khai 1 lần
ở đầu khối `[data-theme="tech"]` dưới dạng PALETTE THÔ `--c-*`, rồi lớp token NGỮ
NGHĨA (`--bg --accent --err`…) + helper (`--surf-top/-bot --glow-edge --glow-bright
--shade --hi`) trỏ về palette. **Toàn bộ rule dưới chỉ dùng `var()` + `color-mix()`
→ KHÔNG còn hex rời** (kiểm: hex chỉ xuất hiện ở 11 dòng `--c-*`).
- `--c-deep-navy #0F193D` · `--c-dark-blue #17316A` · `--c-primary #15458E` ·
  `--c-electric #2264BB` · `--c-cyan-blue #3899DF` · `--c-light-cyan #82B2EA` ·
  `--c-white #FFFFFF` · `--c-soft-glow #D4D5F2` · `--c-neon-pink #A0579B` ·
  `--c-magenta #FF5CA8` · `--c-accent-cyan #55E8FF`.
- **Tỉ lệ 70/15/10/5:** Primary 70% (surface/vùng lớn — cards/tiles/banner/modal,
  vignette tâm) · Electric 15% (tương tác/viền/hover/`.pick`/`--accent`) · Accent
  Cyan 10% (highlight/focus-ring/glow + **success** map ở đây vì palette KHÔNG có
  xanh-lá) · Magenta 5% (nhấn hiếm: `--err`/cảnh báo, đuôi vạch modal, badge admin).
- **2 quyết định lấp khoảng trống palette:** success(xanh-lá cũ) → Accent Cyan;
  trạng thái 'đang sửa' admin (amber cũ) → Neon Pink `#A0579B`. Giữ ĐÚNG 11 màu.
- Bóng tối tint bằng `--shade` (=deep-navy) thay đen thuần; sheen sáng dùng white/
  light-cyan; `color-mix` đã là dependency sẵn của theme (không thêm yêu cầu mới).
- Verify (2026-06-05): screenshot headless Edge index.html desktop+mobile — nền
  navy, h1 gradient cyan→electric→magenta, thẻ kính navy, CTA electric, focus cyan,
  vạch nhấn modal có đuôi magenta. Contrast trắng/navy đạt AA. default BẤT BIẾN.

## Nền ảnh + canvas mạch điện (tech, chỉ index.html)
- `--page-bg-image: url('img/bg-tech.jpg')` (ảnh bo mạch, đặt tại `fe/assets/img/`).
  `body::before` xếp lớp: lưới grid + glow cyan/magenta **trên** overlay+ảnh, vignette
  dưới cùng. Overlay navy 72–82% nên ảnh khá tối (chủ ý: nền cho glow nổi).
- `js/ui/circuit-animation.js` (script NGOÀI CHUỖI #2, sau app.js — xem [[ui-pipeline]]):
  IIFE tạo `<canvas id="circuit-canvas">` (z-index −1, trên body::before, dưới nội dung),
  vẽ xung điện chạy theo path + hạt theo chuột. Bật/tắt theo `data-theme` qua
  MutationObserver. **Màu đọc từ CSS var `--c-*`** (hexToRgb) → 1 nguồn chân lý, không
  nhân đôi palette. **Tôn trọng `prefers-reduced-motion`**: reduce ⇒ KHÔNG tạo canvas
  (đồng bộ `@media reduce` ở styles.css §210). admin.html KHÔNG nạp file này.

## Tầng §D.2 — chiều sâu + neon (cụm cuối khối tech, trước §BIẾN THỂ)
Lớp tăng độ sâu/neon, **chỉ thêm** (không reset thuộc tính sẵn có), không đổi layout:
- **Vignette nền**: `body::before` đổi gradient phẳng `180deg` → `radial-gradient(... at
  50% 42%, #0c1a3e, #070f25 72%)` (tâm sáng, rìa tối) + glow xanh đỉnh + 2 vệt đỏ góc.
- **Vạch neon đầu modal**: `.modal{position:relative;overflow:hidden}` +
  `.modal::before` thanh 3px gradient xanh→đỏ (overflow:hidden để ôm bo góc). Áp cho
  CẢ confirm/profile/joined-modal.
- **Mép kính card đủ**: `.full-team::before` đường 1px gradient ở đỉnh.
- **Divider**: `.hr` xám phẳng → gradient mảnh phát sáng.
- **Icon modal**: `.modal .mic,.pm-emoji` glow XANH (giữ `.jm-icon` glow theo màu đội).
- **Progress**: `.cap-bar span` chỉ thêm ánh kính **inset** (giữ màu đội).

### GOTCHA §D.2 (2 cái dễ sụp)
- **KHÔNG override `box-shadow` của `.full-team`** để làm "kính": `.full-team.mine`
  (vòng sáng đội của bạn) cùng specificity, nằm styles.css → bị themes.css ghi đè
  MẤT vòng. Dùng `::before` cho mép kính thay vì đụng box-shadow.
- **Outer-glow trên `.cap-bar span` vô dụng**: track `.cap-bar` có `overflow:hidden`
  → cắt mất bóng tràn ra ngoài. Chỉ `inset` shadow mới hiện.

## §A·TECH — trang pick "Glass Dashboard" (premium như admin)
Nâng trang pick lên ngang admin (quyết định qua workflow 3-hướng → hội đồng chấm,
winner "Glass Dashboard" + grafts). Tile candy-gradient nhiều màu → **THẺ KÍNH navy
thống nhất**; `.pick` về **MỘT** màu nhấn xanh-điện ĐẶC (`var(--accent)`, chữ trắng
~16:1); **màu đội `--c` rút còn 3 điểm nhấn nhỏ**: glow `.ic` + chấm `.nm::before` +
fill `.cap-bar span` (`color-mix ~28% --c`) → vẫn phân biệt đội qua icon+tên+chấm.
- **Cascade-order BẮT BUỘC:** khối §A·TECH nằm CUỐI vùng `[data-theme="tech"]` (sau
  §D.2). Cùng specificity class-level → nguồn-sau-thắng, nên phải đặt sau mới override
  được `.tile/.banner/.cap-bar/.mini/.pick.lock/.ft-list .no/.empty-note/.hint`. Các
  rule hardcode CŨ của những selector này đã **GỠ** (không để rule chết).
- **GIỮ nguyên:** `h1` chữ-gradient, `box-shadow .full-team` (vòng `.mine`), `.hr` &
  `.full-team::before` của §D.2 (khối §A·TECH cố ý KHÔNG khai lại) — chỉ đổi
  background/border của `.full-team`, viền của `.full-team.mine`.
- Verify: screenshot pick **default** (candy bất biến) vs **tech** (glass) — chấm đội
  xanh-navy (Sói `#7a8cff`) vẫn nổi, contrast AA/AAA. Default 0 đổi (mọi rule scope tech).
