---
title: admin-panel
tags: [module, admin]
code: [fe/admin.html, fe/js/data/api.js, backend/scripts/export.js]
related: [[index]], [[architecture]], [[firestore-schema]]
updated: 2026-06-04
---

# Admin Panel

## Overview
`fe/admin.html` là trang riêng biệt (không link từ index). Admin đăng nhập Firebase → xem danh sách signups → export.
**Chỉ chạy trên site Firebase riêng** https://pickyourgroup-admin.web.app (từ 2026-11-11): site sự kiện `ignore` file này và
redirect 302 `/admin.html`, `/admin` sang đó; GitHub Pages chỉ còn trang chuyển hướng (pages.yml) — xem [[conventions]] §Deploy.

## Auth flow
Firebase Authentication (email/password). **Từ bước 3A (2026-11-11):** admin = UID GỐC hardcode (`isRootAdmin()` trong rules,
khớp `ROOT_ADMIN_UIDS` trong admin.html — đổi thì sửa CẢ HAI) **hoặc** có doc `admins/{uid}` (tab "Quản trị viên": thêm theo UID,
gỡ; không ai tự thêm mình; UID gốc không gỡ được). Cần DEPLOY rules mới thì tab này + "Chuyển phòng" mới chạy.
- **Gotcha:** tạo lại tài khoản Firebase = UID đổi ⇒ admin theo dữ liệu: thêm lại doc; admin gốc: sửa rules + admin.html.

## Tính năng bước 3A + 3B (2026-11-11) — xem documentation/ADMIN.md, HOME-TEMPLATE.md
- Form sự kiện 2 pane, tab **Nhận diện** soạn `meta/config.profile` ([[event-profile]]): tạo mới ghi `NEW_EVENT_PROFILE`; sửa chỉ
  `update({profile})` khi đã đụng tab; "logo mặc định của skin" = KHÔNG ghi brand; ô gợi ý chữ lấy `VARIANT_COPY[variant][lang]`
  rồi `STRINGS` (admin nạp themes/tech/strings.js + variants/tnt/strings.js — thêm biến thể ⇒ thêm `<script>` ở admin.html).
- **Nạp "Nhân sự + Phòng"** từ 1 file mẫu xlsx (thay tnt-import.js); "Xoá cũ & nạp mới" ghi xong mới xoá. **Nhân bản** kèm
  allowlist + profile + (tuỳ chọn) meta/home, homeUrl `home.html?e=<gốc>` trỏ sang ID mới.
- **Thao tác từng người** (tab Đăng ký): chuyển phòng / gỡ / bỏ chặn / xoá — mỗi việc 1 transaction; `m~` chỉ xoá khi không
  còn ai cùng gốc (đọc danh sách TRƯỚC transaction ⇒ khe đua rất nhỏ); người cuối rời phòng ⇒ xoá hẳn doc đội.
- **Kiểm tra trước khi Mở** (lỗi ⇒ chặn + nút "Sửa sự kiện") + cảnh báo đổi/bỏ ô kiểm tra trùng.
- Tab **Trang thông tin** (3B, `js/admin/home-editor.js` + `assets/admin-home.css`, HOOK cuối body): soạn `meta/home`, Excel/JSON;
  xem trước dùng `window.eventSiteBase()`.
- **Site admin riêng** `pickyourgroup-admin` (firebase.json; predeploy `backend/scripts/build-admin-site.js` chép admin.html +
  file nó tham chiếu → `hosting-admin/`, gitignored). `EVENT_SITE`/`eventSiteBase()` (admin.html): trên domain admin, link xem
  trước trỏ https://pickyourgroup.web.app/. Site đã tạo + deploy 2026-11-11 (https://pickyourgroup-admin.web.app, deploy tay
  `firebase deploy --only hosting:pickyourgroup-admin`).
- UI helper: `confirmModal` nhận `list`/`select` + (2026-11-11) `person {name, meta}` (thẻ người), `badge`, `render(slot, ctl)`
  (nội dung tự dựng, `ctl.set(value, valid)`; `[data-autofocus]`; thân `.cm-body` cuộn riêng — `.cm-rich`), `safeFocus`
  (focus Hủy, Enter không tự xác nhận). Enter trên nút/summary để trình duyệt tự kích hoạt (trước đó Enter ở nút Hủy = XÁC NHẬN).
  `actionSheet` nhận `person` + `icon` (SVG hằng số) mỗi thao tác. Gotcha test: đổi tab bằng View Transition ⇒ lớp phủ nuốt
  click ~300ms; thanh tab đáy mobile chia cột theo số tab (`grid-auto-flow: column`).
- **Hộp thao tác từng người** (tab Đăng ký, `pd-*` trong admin.html + admin.css): thẻ người → lưới chọn phòng (radio thật trong
  fieldset; phòng đang ở khoá "Đang ở", "Đầy", "Khác giới" khi bật check giới) → thẻ phòng Từ → Đến (TRƯỚC → SAU / sức chứa)
  → cảnh báo (`pdAlert`) → "Sau khi …" bằng lời thường (`pdSection`, kind keep/lose/info/warn = icon + màu) → "Chi tiết kỹ thuật"
  thu gọn (`pdTech`, giữ tên collection). Transaction ghi Firestore không đổi. Hồ sơ trùng mã (`regShared`/`k1Shared`) ⇒ cảnh báo
  thay cho "đăng ký lại được". Gotcha test: `modalText` = innerText ⇒ KHÔNG chứa `<details>` đang đóng và h4 bị UPPERCASE —
  đọc `.pd-tech` bằng textContent, so tiêu đề mục qua textContent của h4.

## Export
- `export.js` — Node.js script local, dùng `firebase-admin` SDK
- Output: CSV với full PII từ `signups` collection
- Cần `serviceAccountKey.json` (gitignored)
- Command: `npm run export`

## Giao diện (viết lại 2026-11-10, nhánh `feat/admin-midnight`)
CSS: [admin.css](../../fe/assets/admin.css) (dashboard tối kiểu bento, font Inter; token contrast: CTA `--grad #5560FF→#3B44E0`,
danger đặc `#D92D50`, `--mut #9BA3C7`). JS inline vẫn gán `var(--ok/--err/--bad/--muted)` ⇒ giữ các tên này.
- **Shell**: sidebar (brand, ngày + email `#who`, nav `.tab[data-tab][data-title][data-sub]`, Đăng xuất) + top bar
  (`#pageTitle/#pageSub`, `#btnRefresh`). <1024px sidebar thành thanh trên, nav cuộn ngang.
- **4 trang** (`.tab-panel`): `tabDash` Tổng quan · `tabEvents` lưới `.ev-card` · `tabSignups` · `tab-allowlist`.
  Nút trong nội dung chuyển trang bằng `data-goto` (+ `data-event` chọn sẵn sự kiện ở Đăng ký).
- **Dashboard** `renderDashboard(events)` (gọi cuối `renderEvList`): hero sự kiện đang chạy, donut lấp đầy (SVG),
  KPI, cột "Người theo đội" (`ev.teamCounts` + `ev.capForIcon` lưu trong `loadEventList`), nhận xét (tính từ số liệu,
  không AI), so sánh sự kiện, 6 đăng ký mới nhất = **1 query thêm** `signups.orderBy("at","desc").limit(6)` (admin-only).
- **Form sự kiện = drawer** `#createCard` (`openDrawer/closeDrawer`, `flashForm()` giờ = mở drawer; Esc/nền/✕ = huỷ).
  Lưu thành công ⇒ đóng drawer + `toast()` (trước đây formOk bị resetForm xoá ngay nên không hiện).
- Nút action (Mở/Kết thúc/Sửa/…) gắn qua `bindEvActions(root)` dùng chung cho lưới + dashboard.
- **Motion/loading** (token `--ease-*`/`--d-*` cuối admin.css; tắt hết khi `prefers-reduced-motion`):
  skeleton `skelDash/skelEvCards/skelRows` + `aria-busy` lúc tải · `stagger(root)` gán `--i` → card/hàng hiện so le ·
  `countUp(root)` cho `[data-count]` (chữ ban đầu = giá trị cuối) · donut/cột/thanh mọc bằng transform · drawer/modal/toast
  có animation thoát (state đặt ngay, DOM ẩn sau setTimeout) · thanh `.nav-ind` trượt theo tab · nút Lưu `setBusy()` spinner.
  **GOTCHA View Transitions**: đổi tab nằm trong callback `startViewTransition` ⇒ tab nền/headless không vẽ khung thì
  callback trễ/huỷ → panel lệch 1 nhịp. Đã thêm fallback `setTimeout(run,150)` (apply 1 lần) + `.catch` mọi promise của vt.
  **GOTCHA chớp trang** (user báo 2026-11-10): (1) crossfade `::view-transition(root)` cả trang + old(page) tắt 140ms trước
  khi new(page) kịp hiện ⇒ khoảnh khắc trống; giờ root đổi tức thì, old/new page CHỒNG nhau. (2) panel ẩn→hiện chạy lại animation
  con từ opacity 0 ⇒ `stagger()` gỡ `.anim-in` sau 1800ms + mọi animation scope dưới `.anim-in`. (3) card vào từ opacity .35
  (≈ skeleton) chứ không từ 0. **countUp**: timestamp rAF có thể < t0 ⇒ chặn 0..1 (từng ra "-1") + setTimeout chốt số cuối.
  **GOTCHA chớp khi tải lại** (user báo lần 2, 2026-11-10): mọi thao tác (Làm mới, Mở/Kết thúc/Xóa/Lưu) gọi `loadEventList`
  vốn thay nội dung bằng skeleton rồi vẽ lại + stagger + đếm từ 0. Giờ stale-while-revalidate: skeleton chỉ khi `!evRendered`
  (lần đầu; reset khi logout); `renderEvList/renderDashboard(events, animate)` chỉ anim khi `animate`; "Đăng ký mới nhất" giữ
  list cũ (`data-ev` cùng sự kiện) và `loadRecent(live, quiet)`; lỗi khi đã có dữ liệu → toast, giữ bản cũ. `loadSignups`
  cùng sự kiện (`sigShownEid`) không skeleton/không stagger dòng; `aria-busy` gỡ trong `finally`.
  **GOTCHA giật sau chuyển trang** (lần 3): từng tắt `panelIn` bằng `.vt .tab-panel.active{animation:none}` rồi gỡ `.vt` khi
  `vt.finished` ⇒ animation-name none→panelIn ⇒ panel chạy lại animation NGAY SAU transition (nội dung tụt/trồi, tiêu đề đứng
  yên). Giờ `panelIn` chỉ dưới `html.no-vt` (JS đặt 1 lần khi `!USE_VT`); không bật/tắt animation bằng class quanh transition.
  **GOTCHA tiêu đề zoom** (lần 4): ảnh `::view-transition-old/new` mặc định rộng 100% group (= kích thước MỚI) ⇒ tiêu đề cũ
  177px bị giãn thành 337×107 (đo qua CDP). Fix: `width:auto;height:auto` cho old/new của `page` (giữ size gốc).
  Sau đó user chọn: tiêu đề topbar KHÔNG có `view-transition-name` (đổi chữ tức thì, thuộc root) — chỉ panel nội dung chuyển cảnh.
- **FLIP khi vẽ lại** (`snapValues`/`morphValues`): phần tử có `data-k` (khoá ổn định: `kpi:reg`, `donut:arc`,
  `tb:<eventId>:<icon>`, `cmp:<eventId>`, `ev:<id>:reg|bar`…). Số `[data-count]` đếm từ giá trị cũ (`countEl(el, from)`),
  thanh `data-flip="x|y"` co giãn bằng transform scale 600ms, donut chuyển `stroke-dasharray`. Thêm phần tử số/thanh mới
  ⇒ nhớ gắn `data-k`. Toast có icon ✓/✕ tự vẽ (`pathLength=1`, keyframes chỉ `from` ⇒ reduced-motion vẫn thấy icon).
  Card tổng quan chỉ sáng viền khi hover (không bấm được ⇒ không nhô lên); hero/insight giữ viền riêng.
- **Màn chờ + login**: `#bootView` (role=status) hiện tới khi biết trạng thái đăng nhập, và nếu đã đăng nhập thì GIỮ tới khi
  `loadEventList()` đầu tiên xong (`showBoot`/`hideBoot`, text "Đang tải dữ liệu…"). hideBoot <300ms kể từ lúc hiện ⇒ ẩn ngay
  (fadeOut thay animation trễ ⇒ opacity nhảy 1 = chớp); ≥300ms ⇒ fadeOut 200ms + chạy lại stagger/countUp tổng quan; CSS chỉ hiện sau 300ms
  (`animation:fade … .3s backwards`, KHÔNG opacity:0 cố định vì reduced-motion tắt animation). Nút `#btnLogin`: disabled +
  `setBusy` + chữ "Đang đăng nhập…" (chặn bấm lặp), lỗi → select ô mật khẩu. `.btn-txt` chỉ ẩn ở topbar/side-foot (≤640).
  Mock harness: `?auth=out`, `?authDelay=ms`, `?signinDelay=ms`, mật khẩu "wrong" ⇒ lỗi.
- **Form sự kiện = modal giữa màn hình** (user đổi từ drawer phải, 2026-11-10): vẫn class `.drawer`/id `createCard`/`drawerBg`
  (JS openDrawer/closeDrawer không đổi); `inset:0;margin:auto;height:fit-content`, max 760×880, anim modalIn/modalOut;
  ≤640px = sheet toàn màn hình (sheetIn/sheetOut). Thuật ngữ thống nhất form + trang allowlist: "Ô kiểm tra trùng",
  "Chặn đăng ký trùng", "Chỉ người trong danh sách được tham gia", "Kiểm tra họ tên", "Chia phòng theo giới tính".
- **Dropdown**: mọi `<select>` dùng customizable select trong `@supports (appearance:base-select)` (popup `::picker(select)` tối,
  ✓ `option::checkmark` accent, chevron SVG xoay khi `:open`, mở/đóng 180/120ms, `position-try-order:normal` ⇒ luôn mở xuống).
  Vẫn là `<select>` gốc ⇒ JS `.value`/`onchange` không đổi. Trình duyệt chưa hỗ trợ: popup hệ thống. KHÔNG tô xám
  `option[value=""]` — "Chung" (giới tính phòng) có value "" nhưng là lựa chọn thật. KHÔNG `white-space:nowrap` cho select:
  nhãn base-select (shadow DOM) không co/ellipsis ⇒ đẩy chevron ra ngoài ở 375px; để tên dài xuống dòng.
- **Responsive** (breakpoint 1200 / 1024 / 640): ≤1023 sidebar → thanh trên sticky; **≤640 điều hướng thành thanh tab ĐÁY**
  (`.nav` fixed, 4 cột, icon trên nhãn, `.tab-short` "Cho phép" thay `.tab-long`), nút Làm mới/Đăng xuất chỉ icon (`.btn-txt`
  ẩn kiểu sr-only, vẫn là accessible name), ô nhập 16px (iOS không zoom), vùng bấm ≥44px, KPI 2 cột, donut ngang, thẻ đăng ký:
  Đội làm tiêu đề + "#" góc phải; safe-area cho nav/drawer-foot/toast. GOTCHA: `.side` ≤640 phải bỏ `backdrop-filter`
  (tạo containing block ⇒ `.nav` fixed dính đáy .side). `.side`/`.nav` có `view-transition-name` riêng (bản sống, không anim)
  để không bị panel đang trượt đè lên. Đổi tab ⇒ `scrollTo(0)` trong callback VT (trước đây trang mới mở giữa trang).

## Quản lý sự kiện (trong `fe/admin.html`)
Tab "Quản lý sự kiện" = dashboard + CRUD vòng đời. Tất cả nằm trong IIFE của admin.html.
- **Danh sách sự kiện** đọc từ registry `config/eventList = { ids:[...] }` (KHÔNG dùng
  collectionGroup). Mỗi id → đọc `meta/config` + `teams` để tính chỉ số:
  `registrations = Σ team.count`, `teamsFull`, `fillRate`, status (Đang chạy/Đã kết thúc).
- **Xóa dữ liệu** (`clearEvent`→`clearEventData`): xóa hết `signups/members/dedup_keys/teams`
  (PHẢI có teams để count về 0), GIỮ `meta/config`. `deleteAll` lặp batch ≤400, có chặn vô hạn
  (200 vòng) phòng sự kiện đang chạy nhận đăng ký liên tục.
- **Bỏ chặn 1 mã** (tab Đăng ký, `#btnUnblock`; mã = giá trị field chống trùng: MSNV hoặc họ tên): key = `_dedupKey(raw)`
  (chuẩn hoá GIỐNG app). LUÔN xoá `reg_keys/<key>` (hold lúc điền form). Từ 2026-11-10 xoá THÊM `dedup_keys/<key>` nếu người đó
  CHƯA ở đội nào (không có signup cùng mã đã gắn `icon`; chống trùng theo tên thì tên cũng không nằm trong `teams[*].names`) =
  khoá MỒ CÔI (bị chiếm trước, join dở) — trước đây chỉ gỡ được bằng script/Xóa dữ liệu. Đã ở đội ⇒ GIỮ (chống join 2 đội).
  KHÔNG xoá doc `m~<fold>` (dùng chung cho mọi tên có dấu cùng gốc). Chặn allowlist là chuyện khác: thêm mã vào [[allowlist]].
- **Xuất Excel = đúng sự kiện đang HIỂN THỊ** (2026-11-10): tên file lấy `sigShownEid` (không phải giá trị dropdown); đổi dropdown
  ⇒ tự `loadSignups`; `sigLoadSeq` bỏ kết quả của lần tải cũ về sau. Trước đây đổi dropdown rồi Xuất ⇒ tên event B, dữ liệu event A.
- **Xóa sự kiện** (`deleteEvent`): chỉ khi KHÔNG đang chạy & `signups` rỗng (limit(1).empty).
  Batch: `arrayRemove` id khỏi `config/eventList` **+** delete `meta/config` (quên arrayRemove
  ⇒ ghost row). Có nhánh "gỡ mục hỏng" cho id thiếu meta/config.
- **Sửa sự kiện** (`editEvent`/`saveEdit`): dùng lại form tạo, khóa `fId` readonly, lưu bằng
  `.set(..., {merge:true})` + `updatedAt` (KHÔNG ghi `createdAt` ⇒ giữ gốc). CHẶN CỨNG xóa/đổi
  emoji của đội có người (emoji = khóa định danh `teams/{icon}`); cảnh báo giảm capacity dưới
  đội đông nhất; báo đổi dedup chỉ áp dụng lượt mới.
- **Xác nhận xóa**: `confirmModal({ requireText: eid })` bắt gõ lại ID, nút Xác nhận disabled
  tới khi khớp, `danger:true`.
- ⚠️ Sửa sự kiện đang chạy KHÔNG live trên trang công khai — xem [[ui-pipeline]] (config
  reload-only). Success message nhắc admin/người dùng phải tải lại trang.

## Seed & un-join (2026-11-10)
- **Seed** (`seedTeams` trong `fe/admin.html`, và `backend/scripts/tnt-import.js`): ghi `k1 = _dedupKey` `{at, icon}`
  + `M = "m~" + F` (tên có dấu, mỗi M 1 lần). Trùng k1 ⇒ báo CONFLICT, KHÔNG ghi đè (xem [[0002-cross-device-lookup]], [[firestore-schema]]).
- **Un-join 1 người phải xoá:** `members/{pid}`, `signups/{pid}`, `dedup_keys/k1`, `reg_keys`, và gỡ tên khỏi `teams/{icon}`
  (count-1 + bỏ khỏi `names`, trong transaction). Doc `M` CHỈ xoá khi không còn người có dấu nào khác cùng `_foldKey`
  (M giữ chỗ cho bản không dấu). Thiếu 1 bước ⇒ người đó vẫn bị chặn.
- ⚠️ Admin panel **chưa có nút un-join 1 người**. "Bỏ chặn" (`#btnUnblock`) gỡ `reg_keys` + `dedup_keys` mồ côi (người CHƯA ở
  đội), KHÔNG gỡ đăng ký đã join. Rules cho admin sửa `teams` tự do (2026-11-10) nên un-join từ admin không bị rules chặn.

## Danh sách cho phép (allowlist) — đã có
- [[allowlist]] — tab riêng "Danh sách cho phép": import SheetJS (CSV/XLSX), bảng tìm kiếm,
  tải CSV, toggle `allowlistMode` theo sự kiện. Tái dùng `xlsx-0.20.3` (CDN) cũng dùng cho export.

## Cấu hình field — `validateForm`/`resetForm` (từ 2026-06-04)
- `validateForm` BẮT BUỘC có field `key:"name"` (required) + chặn key trùng — app dùng
  `me.fields.name` làm tên hiển thị (hợp đồng trong [[firestore-schema]]). Thiếu ⇒ chặn lưu.
- `resetForm(seed=true)` seed sẵn `DEFAULT_FIELDS` (name+employeeId) cho form tạo mới;
  `populateForm` gọi `resetForm(false)` (Sửa/Nhân bản tự thêm field của sự kiện, tránh nhân đôi).

## Gotchas
- Admin HTML không có dependency ngược lại `index.html` — 2 entry points độc lập
- `signups` collection chỉ readable với admin UID (Firestore rules) — không thể đọc từ browser thường
- Sau 2026-06-03: admin có quyền `delete` 4 collection (rules) — xóa PII là KHÔNG hồi phục. Xem [[firestore-schema]].
