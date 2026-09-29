---
title: theme-system
tags: [ui, component, theme]
code: [fe/js/config/theme.js, fe/assets/styles.css, fe/assets/themes.css, fe/themes/tech/tech.css, fe/themes/tech/chip.css, fe/themes/tech/strings.js, fe/themes/tech/circuit.js, fe/themes/tech/img/chip.svg, fe/themes/tech/img/chip-pink.svg, fe/themes/tech/variants/tnt/tnt.css, fe/themes/tech/variants/tnt/strings.js, fe/themes/tech/variants/tnt/img/tnt-logo.png, fe/index.html, fe/admin.html]
related: [[design-tokens]], [[ui-pipeline]], [[conventions]], [[i18n-system]], [[0001-gender-rooms-from-allowlist]], [[index]]
updated: 2026-09-29
---

# Theme System — đổi giao diện bằng 1 cờ

Cơ chế đổi giao diện toàn site **bằng cấu hình trong code** (không UI bật/tắt cho
end-user). Đơn giản: CSS variables + `data-theme` + 1 cờ. Không framework, không
build, không dependency, không module — tôn trọng [[ui-pipeline]] (thứ tự script).

## Cấu trúc file — MỖI THEME = 1 THƯ MỤC `fe/themes/<tên>/` (2026-06-06)
Trước đây cả theme `tech` dồn vào `assets/themes.css` (~700 dòng) → phình to khi thêm
theme. ĐÃ TÁCH theo theme: mỗi theme gói TRỌN trong `fe/themes/<tên>/`:
- `<tên>.css` — toàn bộ khối `[data-theme="<tên>"]` (palette/token + bề mặt + §D.2 +
  §A·TECH + §BIẾN THỂ + §ADMIN `body.admin`). Hiện: [tech.css](../../fe/themes/tech/tech.css).
- `chip.css` — addon tùy biến (icon đội = chip cyan), CHỈ index.html.
- `strings.js` — text riêng-theo-theme (merge `STRINGS`) — xem [[i18n-system]].
- `circuit.js` — hoạt ảnh canvas riêng (IIFE), nạp CUỐI body, chỉ index.html.
- `img/` — ảnh riêng (`bg-tech.jpg`, `chip.svg`); `url()` trong CSS trỏ TƯƠNG ĐỐI `img/…`
  (đặt cạnh file CSS) ⇒ di chuyển KHÔNG phải đổi chuỗi url.
`assets/styles.css` = token DEFAULT (`:root`) — KHÔNG đụng. `assets/themes.css` thu nhỏ
thành BASE/REGISTRY (template + recipe thêm theme), CỐ Ý không có rule active, vẫn `<link>`
SAU styles.css để giữ "khe" lớp theme. Thứ tự nạp index.html: `styles.css → themes.css →
themes/tech/tech.css → themes/tech/chip.css`; admin.html nạp `themes/tech/tech.css` (chứa
§ADMIN). Thêm theme = thêm thư mục, KHÔNG đụng JS lõi. Xem [[ui-pipeline]].

## Một nguồn sự thật
- Cờ duy nhất ở [theme.js](../../fe/js/config/theme.js): `const ACTIVE_THEME =
  'default'|'tech'` (+ `ACTIVE_VARIANT` tuỳ chọn). File này nạp ở **`<head>`** trên
  CẢ 2 trang (TRƯỚC khi vẽ) → set `data-theme`/`data-variant` không nháy (**0 FOUC**).
  Độc lập, ngoài chuỗi nạp thiêng (chỉ `setAttribute` trên `<html>`) — xem [[ui-pipeline]].
- (Trước đây cờ ở config.js — đã chuyển sang theme.js để 0 FOUC; config.js để lại
  comment trỏ tới.)
- Đổi giao diện = đổi **đúng chuỗi đó**. KHÔNG hardcode tên theme ở chỗ khác.
- `index.html` link `assets/themes.css` (base/registry) + `themes/tech/tech.css`;
  `admin.html` link THẲNG `themes/tech/tech.css` (chứa §ADMIN — KHÔNG link `assets/themes.css`).
  CẢ 2 trang đều nạp `theme.js`.
- **Đổi theme lúc chạy = CHỈ admin** (2026-06-06): `theme.js` đọc `localStorage('theme') || 'tech'`
  (cờ có thể bị ghi đè per-browser). Nút lật `#themeToggle` giờ ở **admin.html** (top bar, dùng
  `.btn-ghost`; wiring trong inline script) — trang công khai ĐÃ GỠ nút + style `.theme-toggle`
  (end-user không tự đổi giao diện). Nút lật `data-theme` + ghi `localStorage`; theme.js áp lại khi tải.

## Biến thể theo sự kiện (§E.3 — tuỳ chọn)
Cờ go-live = `DEFAULT_VARIANT` ([theme.js](../../fe/js/config/theme.js)); `ACTIVE_VARIANT` = kết quả (cờ, hoặc
URL `?variant=<tên>` để XEM TRƯỚC trên production không cần deploy — kiểm `/^[a-z0-9-]{0,32}$/`; `?variant=`
rỗng = ép tắt). Đặt `data-variant` trên `<html>`. Biến thể nhỏ = 1 khối `[data-theme="tech"][data-variant="x"]`
trong tech.css (override `--page-bg-image` + 1–2 màu). Biến thể LỚN (copy + logo + CSS) = thư mục riêng
`fe/themes/tech/variants/<tên>/` (xem tnt dưới). Mặc định `''` ⇒ INERT (ảnh trong url() không tải).
admin.html cũng chạy theme.js (có `data-variant`) nhưng KHÔNG link CSS/strings biến thể ⇒ admin không đổi.

### Biến thể `tnt` (sự kiện Mini Outing · brand TNT, 2026-09-29)
Nguồn: PDF BTC "MINI MINI MINI.pdf" (copy nguyên văn) + phân phòng Nam/Nữ ([[0001-gender-rooms-from-allowlist]]).
Thư mục `fe/themes/tech/variants/tnt/`: `tnt.css` (link SAU chip.css) + `strings.js` (script SAU
themes/tech/strings.js — xem [[i18n-system]]) + `img/tnt-logo.png`. Mọi selector scope
`[data-theme="tech"][data-variant="tnt"]` (0,3,x) > tech (0,2,x) ⇒ thắng bất kể thứ tự. **Giữ nguyên
visual tech** (PDF không đổi màu) — chỉ đổi logo/loader/copy + 3 fix.
- **Logo đổi THUẦN CSS** (không sửa JS): 4 chỗ hiện logo (header index.html, popup định danh ui-render,
  màn đếm ngược + kết thúc app.js) dùng CHUNG `.tech-logo-only > .logo-wrap > img.logo-icon + span.logo-text`
  ⇒ ẩn icon + chữ FARADAY, vẽ logo bằng `.logo-wrap::before{background:var(--tnt-logo) center/contain}`
  + `aspect-ratio:var(--tnt-ratio)`. Popup định danh logo nhỏ hơn (84px). Loader: ẩn `.tech-chip`,
  `.loader-spinner::before` = logo + `animation: chipPulse` (keyframe tech, glow theo alpha). 0 FOUC.
- **tnt-logo.png**: file BTC là JPG chữ trắng trên NỀN ĐEN (2560×1632) — đặt thẳng lên navy sẽ lộ khối đen.
  Đã tách nền bằng Pillow: alpha = độ sáng (max kênh) ánh xạ [28..230]→[0..255], RGB trắng, cắt sát + đệm 1%,
  800×558 (~40KB). Đổi file ⇒ sửa `--tnt-ratio` (800 / 558). Logo thực tế là "TRINITY agency".
- **Terminal**: dòng VI dài ~42–47 ký tự bị tech (nowrap + width 0→100%) CẮT CỤT trên điện thoại ⇒ biến thể
  cho `white-space:normal` + hanging indent (`padding-left:2ch;text-indent:-2ch`) + CHỈ đổi `animation-name`
  → `termReveal` (clip-path inset trái→phải; đích `inset(-0.5em … 0)` để không xén dấu) ⇒ giữ nguyên
  duration/delay ⇒ vẫn khớp timer 4000ms. ≤560px: font 12.5px.
- **GOTCHA H1 mất dấu**: h1 chữ-gradient (`background-clip:text`) + `line-height:1.02` ⇒ phần dấu CHỒNG TẦNG
  vượt khung (dấu sắc của "Ố" trong "MUỐN") KHÔNG được tô ⇒ biến mất. Fix trong biến thể: `h1{padding-top:.25em}`
  (áp cả `.sched-event-title` vì cũng là h1). Faraday ("LẬP ĐỘI NÀO!") không có dấu chồng nên chưa lộ — theme
  khác gặp tiêu đề có Ố/Ấ/Ề… thì nhớ fix này.
- Verify (headless Edge, harness demo + iframe 360/390): loader, terminal, form, lưới khoá phòng khác giới,
  confirm, joined, countdown có `<ul>`; biến thể TẮT so pixel với master ⇒ 4 cảnh Δ≤6/255, terminal/loader chỉ
  lệch pha hoạt ảnh ⇒ Faraday BẤT BIẾN.
- **Go-live**: chỉ SAU khi Faraday kết thúc: `DEFAULT_VARIANT='tnt'` → push (GitHub Pages tự deploy) +
  `firebase deploy --only hosting` → kích hoạt sự kiện mới. Cache HTML/JS: Firebase 1h, Pages 10' ⇒ đổi cờ
  ≥60' trước `openAt`. Rollback: `DEFAULT_VARIANT=''` + deploy. Preview production `?variant=tnt` CHỈ
  để xem — submit form sẽ ghi vào sự kiện đang active.
- **Trạng thái local (2026-09-29)**: `DEFAULT_VARIANT` đang set `'tnt'` thẳng trong theme.js (branch
  `feat/mini-outing-variant`, CHƯA commit/push) để user xem trước không cần `?variant=`. **Nhớ trả về `''`
  trước khi push/deploy** nếu Faraday còn sống — nếu không patch này sẽ bật biến thể cho mọi người xem trang.

## Admin cũng có theme (scope riêng)
admin.html có `:root` + bộ token RIÊNG (`--ink/--pri/--grad/--card-2/--accent-soft
/--danger`…). Vì vài token TRÙNG tên với app chính (`--bg/--card/--line/--accent
/--r-lg`) mà 2 trang chung khối tech (`themes/tech/tech.css`), override admin được **scope vào
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

## Thêm theme mới (1 thư mục, không sửa JS lõi)
1. Tạo thư mục `fe/themes/<tên>/`, copy khối TEMPLATE trong
   [themes.css](../../fe/assets/themes.css) vào `<tên>.css`, điền màu (override token đã
   có trong `styles.css :root`).
2. `<link rel="stylesheet" href="themes/<tên>/<tên>.css">` SAU dòng `themes.css` ở
   index.html (và admin.html nếu theme đụng admin — `body.admin`).
3. Cho phép `ACTIVE_THEME = '<tên>'` trong [theme.js](../../fe/js/config/theme.js). Hết.

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
`url('img/<file>')` đặt ảnh ở `fe/themes/<tên>/img/`) + `--page-bg-overlay` (lớp phủ
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
- `--page-bg-image: url('img/bg-tech.jpg')` (ảnh bo mạch, đặt tại `fe/themes/tech/img/`).
  `body::before` xếp lớp: lưới grid + glow cyan/magenta **trên** overlay+ảnh, vignette
  dưới cùng. Overlay navy 72–82% nên ảnh khá tối (chủ ý: nền cho glow nổi).
- `fe/themes/tech/circuit.js` (script NGOÀI CHUỖI #2, sau app.js — xem [[ui-pipeline]]):
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
- **Hoạt ảnh modal mở/đóng = MƯỢT (2026-06-06)**: vào `techScaleIn .32s` (scale .85→1,
  opacity 0→1 ĐƠN ĐIỆU) + `electricGlow` (viền cyan nhấp nháy chậm, vô hạn); đóng
  `techScaleOut .2s`. ĐÃ BỎ cặp `techFlicker`/`techGlitchOut` (CRT-glitch: opacity tụt
  0.15→0.3 giữa chừng + skew/hue-rotate) vì người dùng thấy popup **"giật/nhân đôi"** lúc
  hiện — ĐỪNG khôi phục. Áp cho MỌI `.modal` (confirm/profile/joined).
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
~16:1); **màu đội `--c` rút còn 1 điểm nhấn nhỏ**: fill `.cap-bar span`
(`color-mix ~28% --c`) → phân biệt đội qua TÊN + màu thanh tiến độ. (Chấm tròn `.nm::before`
trước tên ĐÃ BỎ theo yêu cầu 2026-06-06.)

### Icon đội = CHIP cyan ĐỒNG NHẤT — file `themes/tech/chip.css` (2026-06-06)
Icon to của đội — lưới `.tile .ic` VÀ banner "đội của bạn" `.banner .bi` (cùng giữ
GLYPH/SỐ to, vd "5") — đổi sang **1 chip cyan giống hệt mọi đội** + glow cyan. Đội vẫn
phân biệt qua fill cap-bar ⇒ `--c` rút 3→1 nhấn (bỏ glow icon + bỏ chấm tên 2026-06-06).
- **TÁCH RIÊNG file [chip.css](../../fe/themes/tech/chip.css)** (KHÔNG nhét vào
  tech.css) — theo yêu cầu "custom theo-theme đừng ghi chung file gốc" (giống
  [[i18n-system]] strings.js). Mọi rule scope `[data-theme="tech"]` ⇒ INERT ở
  theme khác dù vẫn `<link>`; nạp SAU tech.css ở **index.html-only** (cùng
  specificity → nguồn-sau-thắng để đè `.ic/.bi`; admin không có lưới/banner).
- **Kỹ thuật = background-image, KHÔNG mask.** `font-size:0` ẩn glyph (⇒ BẮT BUỘC
  width/height thực: tile `clamp(42px,8vw,52px)` khớp §90, banner `38px` khớp §54
  styles.css); `background:url('img/chip.svg') center/contain`; `filter:drop-shadow`
  cyan = glow (đè glow `--c` ⇒ 1 nguồn). Màu chip nằm SẴN trong `chip.svg`
  (`fill="#55E8FF"`) → **phải khớp token `--c-accent-cyan`** (đổi token ⇒ sửa SVG).
- **GOTCHA lớn (đã vấp):** CSS `mask:url(svg)` render KHÔNG ổn định ở môi trường này —
  headless Edge + `file://` cho mask RỖNG, và RỖNG hẳn khi `::after` nằm trên
  **flex-item** (`.bi` là con của `.banner{display:flex}`; `.ic` block thì có lúc ăn).
  `<img>`/`background-image` của CÙNG file SVG thì render chắc → chọn background-image.
  (Cũng lưu ý: headless Edge cache `file://` CSS bỏ qua `?v=` & user-data-dir mới →
  verify external-CSS phải đổi TÊN file mới, xem [[headless-screenshot-edge]] nếu có.)
- Verify (preview tĩnh headless Edge, desktop+mobile): tech chip cyan giống nhau ở CẢ
  banner lẫn tile; default (số to) 0 đổi; mobile 0 méo. (Chấm tên về sau đã BỎ — xem §A·TECH.)
- Các chỗ icon đội KHÁC còn để NGUYÊN (chưa chip-hoá): `.jm-icon` (mừng join),
  `.mic`/`.pm-emoji` (modal) — tải danh tính đội-đã-chọn; chip-hoá nếu muốn đồng bộ tiếp.
- **Empty-state icon = CHIP MAGENTA (2026-06-06):** đám mây cười `EMPTY_SVG` (inline trong
  ui-render.js, class `.empty-ic`, khung rỗng "No squad reached N") → chip **magenta**
  `#FF5CA8` (asset `img/chip-pink.svg`) trong `chip.css`. CỐ Ý khác chip đội (cyan) để
  tạo ĐIỂM NHẤN — magenta là màu "nhấn hiếm 5%" palette tech, hút mắt cho empty-state.
  Kỹ thuật giống `.ic/.bi`: ẩn 6 path cloud gốc (`.empty-ic > *{display:none}`) + vẽ chip
  bằng `background-image` + glow `drop-shadow(var(--c-magenta))`. Màu baked trong
  chip-pink.svg ⇒ đổi `--c-magenta` phải sửa SVG. Scope tech ⇒ default giữ cloud candy.
- **Cascade-order BẮT BUỘC:** khối §A·TECH nằm CUỐI vùng `[data-theme="tech"]` (sau
  §D.2). Cùng specificity class-level → nguồn-sau-thắng, nên phải đặt sau mới override
  được `.tile/.banner/.cap-bar/.mini/.pick.lock/.ft-list .no/.empty-note/.hint`. Các
  rule hardcode CŨ của những selector này đã **GỠ** (không để rule chết).
- **GIỮ nguyên:** `h1` chữ-gradient, `box-shadow .full-team` (vòng `.mine`), `.hr` &
  `.full-team::before` của §D.2 (khối §A·TECH cố ý KHÔNG khai lại) — chỉ đổi
  background/border của `.full-team`, viền của `.full-team.mine`.
- Verify: screenshot pick **default** (candy bất biến) vs **tech** (glass), contrast
  AA/AAA. Default 0 đổi (mọi rule scope tech). (Chấm màu đội trước tên đã BỎ 2026-06-06.)
