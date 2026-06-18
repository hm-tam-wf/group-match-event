---
title: allowlist
tags: [module, feature]
code: [fe/admin.html, fe/js/data/api.js, fe/js/app.js, fe/js/ui/ui-render.js, fe/js/ui/ui-utils.js, backend/firestore.rules, sample-allowlist/]
related: [[index]], [[api-layer]], [[admin-panel]], [[firestore-schema]], [[ui-pipeline]]
updated: 2026-06-17
---

# Allowlist (danh sách MSNV được phép join)

Khi BẬT cho một sự kiện: chỉ định danh (giá trị `DEDUP_FIELD`, vd MSNV) nằm trong danh sách
mới được vào lưới + join đội. Enforce **phía client**, mô phỏng y hệt cổng chống trùng
([[api-layer]] dedup). Mặc định TẮT ⇒ tương thích ngược 100% (mọi người join như cũ).

## Schema & cấu hình
- `events/{id}/allowlist/{key}` — `key = _dedupKey(<giá trị dedupField>)`, doc `{ name?, at }`.
  `_dedupKey` = `trim().toUpperCase().replace(/\s+/g,"")` — **giống hệt** `dedup_keys` để import & claim khớp.
- `events/{id}/meta/config.allowlistMode` (bool). `ALLOWLIST_MODE` khai báo ở `firebase-config.js`,
  `boot()` đọc lại từ config. Đối chiếu theo `dedupField` (độc lập `blockDup`).

## Enforce phía client (mirror dedup — xem [[api-layer]])
- **`apiClaim`** (`api.js`): đọc `allowlist/{key}` trong CÙNG `Promise.all` của transaction
  → `reason:"notAllowed"` nếu !exists (sau already/dup, trước full). Đọc-trước-ghi GIỮ NGUYÊN.
  Early-return `notAllowed` nếu bật mode mà không có giá trị định danh.
- **Cổng vào trang** (chống "vào được lưới rồi join lỗi"): `apiAllowlistAllowed(value)` (`api.js`,
  đọc 1 doc, fail-open khi lỗi mạng) + state `allowBlocked` (`ui-utils.js`). Dùng ở `init()`
  (`app.js`), `save()` + `canJoin` (`ui-render.js`), modal `showAllowBlockedModal`/`closeAllowBlockedModal`.
  `doClaim` nhánh `notAllowed` bật `allowBlocked` + `apiRemoveProfile` (dọn hồ sơ).
- **demo**: gate bằng `sGet("allowlistMode")` + `sGet("allowlist")` (seed tay khi dev).
- `loadtest.js`: mirror nhánh allowlist (giữ TẮT để test phản ánh production).

## Hợp lệ & khớp HỌ TÊN (2026-06-04)
- **Tên hợp lệ** (`validName`, `ui-utils.js`): ≥2 ký tự & có ≥1 chữ cái (`/\p{L}/u`) → chặn tên rác
  ("123","!!!"). `fieldError` cũng **ép field `name` luôn required** (vá lỗ tên rỗng ở sự kiện cũ).
- **Toggle riêng `allowlistNameCheck`** (opt-in, **mặc định TẮT**): khớp tên chỉ chạy khi
  `ALLOWLIST_MODE && ALLOWLIST_NAMECHECK`. Tắt → chỉ kiểm có-trong-danh-sách, không xét tên.
  Sự kiện cũ thiếu cờ ⇒ boot không gán ⇒ `ALLOWLIST_NAMECHECK=false` ⇒ tương thích ngược.
  Bật ở 2 chỗ: checkbox `fAllowlistNameCheck` trong form Tạo/Sửa (con của `fAllowlistMode`,
  xám/khoá khi allowlist tắt) + nút nhanh `alNameCheck` ở tab Danh sách cho phép (khi tắt
  allowlist → tự bỏ tích + lưu false, tránh kẹt stale). Lưu vào `meta/config.allowlistNameCheck`.
- **Khớp tên với danh sách** (CHỈ khi `ALLOWLIST_NAMECHECK` BẬT & dòng CÓ cột tên): tên nhập phải
  khớp tên đã import sau chuẩn hoá `_normName` (`api.js`: bỏ dấu tiếng Việt + gộp trắng + IN HOA;
  dải dấu kết hợp U+0300..036F dựng bằng `String.fromCharCode` để tránh ký tự vô hình trong nguồn).
  Dòng KHÔNG có tên → bỏ qua. "Lê Văn A" ↔ "le van a" coi là khớp.
  - Lớp 1 (UX): `apiAllowlistInfo(value)`→`{allowed,name}`, dùng ở `save()` (`ui-render.js`) → lệch
    thì báo lỗi inline ô họ tên, GIỮ popup để sửa, KHÔNG ghi.
  - Lớp 2 (chốt): transaction `apiClaim` trả `reason:"nameMismatch"` (so trên `al` ĐÃ đọc trong
    `Promise.all`, KHÔNG thêm read, KHÔNG đổi thứ tự đọc-ghi). `doClaim` (`app.js`) gặp `nameMismatch`
    → `editing=true` mở lại popup để sửa (hồ sơ đã khoá sửa sau khi điền xong).
  - **Gotcha**: `/\s/` JS không match U+200B/U+00AD (ký tự vô hình từ paste) → lọt qua `_normName`
    → có thể báo lệch tên oan khi dán từ chat/PDF. Hiếm, recoverable, chưa vá.
- `apiAllowlistAllowed` nay là wrapper mỏng của `apiAllowlistInfo`.

## Admin — tab "Danh sách cho phép" (`tab-allowlist` trong `admin.html`)
Dropdown sự kiện → trạng thái (dedupField/đếm/toggle `allowlistMode`) → import **SheetJS (CSV/XLSX)**:
chọn cột khớp `dedupField` (+ cột tên tuỳ chọn, regex `họ tên|name|tên`), `buildItems` chuẩn hoá key
bằng `_dedupKey`, dedup nội bộ, batch ≤400. Thêm/Thay-thế, bảng tìm kiếm, tải CSV, xoá từng dòng.
**Thêm/sửa tay 1 mã (2026-06-18, không cần file):** ô `#alOneKey`+`#alOneName`+`#alAddOne` → `addMany([{key:_dedupKey(raw),name}])`
(merge). Nút `✎` mỗi dòng → `startEditOne` đổ vào ô + `#alAddOne`→"Lưu sửa" (state `alEditKey`); lưu: đổi định danh
⇒ `delOne(keyCũ)`+`addMany(keyMới)` (chuyển mã), giữ định danh ⇒ chỉ cập nhật tên. `loadEvent` gọi `cancelEditOne` (tránh sửa nhầm event).
Toggle `fAllowlistMode` trong form phụ thuộc `dedupField` (`syncAllowlistToggle`); toggle `fAllowlistNameCheck`
(con) phụ thuộc `fAllowlistMode` (`syncNameCheckToggle`). Cả hai toggle có bản nút nhanh ở tab (`alMode`/`alNameCheck`).

## Seed đội từ cột "team" khi import (2026-06-17) — "danh sách đã chia đội sẵn"
Import allowlist nay đọc THÊM cột tuỳ chọn `team` (regex `^(team|đội|đôi|doi|nh[oó]m)$`) → seed người
ĐÃ CÓ ĐỘI vào đúng đội: **chiếm slot thật + khoá mã** (theo yêu cầu user). Chỉ ở `admin.html` IIFE allowlist.
- **buildItems** giữ thêm `{team, raw}` (raw = giá trị định danh GỐC, chưa `_dedupKey`, để ghi signups đúng MSNV gốc).
- **Map đội**: `team` là SỐ N → `icons[N-1]` (đội thứ N trong `meta/config.icons`). File mẫu `data-icon-picker/
  final_input_data.xlsx`: 4 đội × 25 (team 1→🦊,2→🐉,3→🦅,4→🦁) + 208 người chưa đội. Giá trị không map được
  (vd "5" khi <5 icon) ⇒ gom vào `unmapped`, BỎ QUA + báo ở kết quả.
- **UI**: checkbox `#alSeedTeams` (ẩn tới khi file có cột team với ≥1 người chia đội). Khi BẬT: chỉ chạy qua nút
  "Xoá cũ & nạp mới (+ chia đội)" — nút "Nhập (thêm)" bị khoá (`syncSeedButtons`) vì seed đòi collection RỖNG.
- **doImport nhánh seed** (replace + seed + có người-team): confirm `requireText:eid` → `clearEventData(eid)`
  (xoá teams/members/dedup_keys/reg_keys/signups, GIỮ config+allowlist) → `data.clear` (allowlist) → `addMany`
  (allowlist) → `data.seedTeams` → bump `dataEpoch` (như "Xóa dữ liệu", để máy người chơi nhả localStorage cũ).
- **doImport nhánh thường — "Xoá & nạp mới" (Replace)** cũng bump `dataEpoch` (2026-06-17): thay TOÀN BỘ allowlist =
  roster mới ⇒ máy đã đăng nhập tự đăng-nhập-lại khi vào lại (boot xóa `me.fields`, cổng allowlist kiểm theo danh
  sách MỚI). Nhánh **"Nhập (thêm)" (Add) KHÔNG bump** (additive — người cũ vẫn hợp lệ). Xem reset epoch ở [[api-layer]].
- **data.seedTeams** ghi đúng LUẬT RULES hiện tại (KHÔNG cần đổi rules — xem dưới):
  - capacity CHỈ tăng cho vừa đội đông nhất (`set {capacity} merge` TRƯỚC khi ghi teams; an toàn, không đẩy ai ra).
  - `teams/{icon}`: `set count=1,names=[n0]` (đúng rule create count==1) → rồi `set count=N,names=[...]` (update:
    icon==icon & count<=cap() & names.size==count). Hai set tuần tự (create+update KHÔNG cùng 1 batch được).
  - mỗi người (lô ≤120 = 360 op): `members/seed_<key>={icon,at}` (create hasOnly[icon,at]), `dedup_keys/<key>={at}`
    (khoá MSNV), `signups/seed_<key>={name,[dedupField]:raw,playerId,icon,at}`. `pid="seed_"+key` → idempotent doc id.
- **Vì sao phải clear trước**: rule `members`/`dedup_keys` có `update:if false` → seed lại trên doc CŨ = update = DENIED.
  clearEventData làm collection rỗng ⇒ mọi ghi là CREATE (hợp lệ). Cũng vì vậy seed = thao tác "làm mới" (fresh).
- **Hệ quả hiển thị**: đội seed `count>=capacity` ⇒ KHÔNG ở `#grid`, hiện ở `#taken` dạng "Đã chốt" (khoá) — xem
  trạng thái lock ở [[ui-pipeline]]. Người seed mở app: allowlist cho qua nhưng dedup_keys chặn join lại ("khoá mã").
- **Lưu ý dung lượng**: capacity là 1 SỐ CHUNG mọi đội. 4 đội đầy + 6 icon còn lại mở (×25=150 chỗ) < 208 người
  chưa đội ⇒ thiếu chỗ; muốn đủ phải thêm icon / sửa capacity ở form "Sửa sự kiện".
- KHÔNG test được ghi Firestore từ CLI (admin auth-gated) — đã test parse/group bằng Node trên file thật + node --check cú pháp.

## Rules ([[firestore-schema]])
`match /allowlist/{key}` → `get: if true` (client tx đọc theo key đã biết) · `list/write: if isAdmin()`
(chống enumerate; admin import). Đã DEPLOY trên project `icon-picker` (kiểm bằng REST 2026-06-04).

## Gotchas
- **Enforce chỉ ở client** (rules chỉ mở `get`, KHÔNG bắt buộc "phải có trong list mới ghi được team").
  Giống dedup — chấp nhận được cho app nội bộ; muốn chặn cứng phải thêm luật rules.
- **Reload-only**: bật allowlist không "live" trên tab công khai đang mở — phải tải lại trang.
- **Bật mode + danh sách RỖNG = khoá tất cả**. Tab có cảnh báo đỏ `alWarnEmpty`.
- Xoá hẳn sự kiện có `deleteAll(events/{id}/allowlist)`; "Xóa dữ liệu" (`clearEventData`) KHÔNG đụng allowlist.
- JSON mẫu (A/B/C) KHÔNG được importer dùng (importer là tabular CSV/XLSX) — chỉ để tham khảo.

## Sửa sau review (2026-06-04) — 4 bug do feature gây ra
Review phản biện đa-lens phát hiện & vá (commit sau merge feat):
- **Bẫy popup cho người ĐÃ join** (`ui-render.js` renderProfile): feature đổi cổng lưới
  `profileComplete()`→`profileValid()` (chặt hơn: ép `name` required + `validName` + format). Người join
  ở phiên CŨ có hồ sơ không qua validate mới (vd tên 1 ký tự / sự kiện cũ để name không bắt buộc) bị đẩy
  ngược vào popup KHÔNG-huỷ-được dù đã ở trong đội. Fix: `done = (myIcon || profileValid()) && !editing`
  — đã join thì luôn hiện tóm tắt. (`ready`/`canJoin` GIỮ `profileValid && !myIcon` để người chưa join vẫn bị chặn.)
- **Tự xoá signup của chính mình** (`ui-render.js` save()): cổng `apiDedupTaken`/`apiRegReserve` thiếu
  `!myIcon` → người đã join sửa lại hồ sơ → `dedup_keys/{key}` của CHÍNH MÌNH tồn tại → bị coi là trùng →
  `apiRemoveProfile(me.id)` xoá signup (mất `icon`+`at` gốc). Fix: thêm `!myIcon &&` vào cả 2 cổng (khớp init()/doClaim).
- **Import nhầm cột 0** (`admin.html` onFile): khi không tìm thấy cột định danh, `apply()` vẫn chạy ngay với
  cột 0 + báo "Đọc được N… hợp lệ" (xanh) đè cảnh báo đỏ → admin import nhầm cột STT làm khoá → mọi người
  `notAllowed`. Fix: `if (colIdx >= 0) apply()` — không thấy cột thì chờ admin chọn.
- **Regex cột tên bắt nhầm `username`** (`admin.html` nameIdx): `…|name|…` không neo → "username/lastname/
  displayName" đứng trước cột tên thật bị nhận là cột tên → poison NAMECHECK (mọi người `nameMismatch`).
  Fix: neo `^(full\s*)?name$`. Test 8 ca pass.
- (False-positive đã loại: `_dedupKey` lệch `v==null?"":v` (admin) vs `v||""` (api) cho 0/false — vô hại
  vì phía claim luôn nhận STRING; chỉ là chú thích "GIỐNG HỆT" hơi quá, KHÔNG sửa.)

## Fixtures (`sample-allowlist/`, đã commit) — 20 MSNV `NV2026001…020`
`-A.json` mảng string · `-B.json` mảng object `{employeeId,hoTen}` · `-C.json` map · `.csv` header
`employeeId,hoTen` · `.xlsx` cùng cột. Test parser bằng `xlsx@0.18.5` (xem auto-memory: node-test-browser-code).
