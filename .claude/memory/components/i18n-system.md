---
title: i18n-system
tags: [ui, component, i18n]
code: [fe/js/config/config.js, fe/themes/tech/strings.js, fe/js/app.js, fe/js/ui/ui-render.js, fe/js/ui/ui-utils.js, fe/index.html]
related: [[conventions]], [[ui-pipeline]], [[theme-system]], [[firestore-schema]], [[index]]
updated: 2026-06-06
---

# i18n System — đổi ngôn ngữ UI bằng 1 cờ

Gom MỌI chuỗi UI tầng **hardcode** về một registry song ngữ + 1 cờ `LANG`. Cùng triết
lý "đổi 1 cờ" của [[theme-system]]. Vanilla, không module/bundler/dependency — tôn
trọng [[ui-pipeline]] (thứ tự script). Thêm 2026-06-06 (refactor từ chuỗi rải rác).

## Một nguồn sự thật
- Registry ở [config.js](../../fe/js/config/config.js): `const STRINGS = { en:{…}, vi:{…} }`
  (nằm cuối file, mục ➏). config.js nạp ĐẦU TIÊN trong chuỗi thiêng ⇒ `TEXT` global dùng
  được ở mọi file sau (ui-utils, ui-render, app). KHÔNG thêm file → không đụng thứ tự script.
- Cờ: `let LANG = "en"` (đổi mặc định tại đây). Override test nhanh bằng URL `?lang=vi`
  / `?lang=en` (đọc vào `langParam`, bọc try/catch cho an toàn ngoài browser).
- `const TEXT = STRINGS[LANG] || STRINGS.en` — bảng đang chọn, **fallback EN** nếu LANG lạ.
  (Trước tên là `T`; đổi `T`→`TEXT` 2026-06-06 để rõ nghĩa — tránh tên 1 chữ cái.)
- Chuỗi tĩnh = string; chuỗi có biến nội suy = **HÀM** đối số rõ ràng
  (vd `TEXT.toast.full(name, capacity)`, `TEXT.confirm.title(name)`, `TEXT.grid.count(shown, total)`).
  Không parser/placeholder — gọi hàm trả template literal.
- Namespaces: `boot, profile, dup, allow, celebrate, banner, grid, confirm, toast, validate`
  (55 key mỗi ngôn ngữ; **en/vi phải cùng shape** — xem test bên dưới).

## Danh từ ĐƠN VỊ (Team/Squad/Group) — 1 token/ngôn ngữ
Tên đơn vị đội/nhóm gom vào `const UNIT = { en:{one,many}, vi:{one,many} }` (khai báo TRƯỚC
STRINGS; alias `UE = UNIT.en`, `UV = UNIT.vi`). Đổi Team↔Squad↔Group = sửa **1 dòng/ngôn ngữ**;
mọi chuỗi KHÁI NIỆM tự đổi theo (verified: đổi `UNIT.en`→team/teams ⇒ "Teams with Open Spots"/"Your Team").
- Lưu dạng THƯỜNG; helper `_cap(s)` viết hoa khi đầu câu/nhãn/ghép tên riêng
  (vd `headOpen/headFull`, `ftLabel`, `profile.greeting`, `celebrate.title`). EN có số ít/nhiều
  (one="squad", many="squads"); VI dùng chung "đội".
- **ĐỊNH DANH ĐỘI = TÊN ADMIN, KHÔNG ghép đơn vị** (2026-06-06, theo yêu cầu): mọi chỗ hiển thị
  1 đội CỤ THỂ chỉ dùng `${name}` (tên đội admin điền = nhãn ĐẦY ĐỦ) — đã bỏ tiền tố đơn vị ở
  `confirm.title`, `banner.title`, `celebrate.body`, `toast.full` (cả EN+VI). UNIT (Squad/đội) giờ
  CHỈ còn cho nhãn/khái niệm CHUNG (headings, tile labels, `ftLabel`, `profile.*`, `*.body`,
  `celebrate.title`) — KHÔNG ghép trực tiếp với tên đội nữa.
- Chuỗi TĨNH chứa đơn vị đã chuyển thành template literal `` `…${UE.one}…` `` (nội suy lúc dựng
  object vì UNIT khai báo trước). `grid.headFull` EN = `` `${_cap(UE.one)} completed Successfully` ``
  (text tuỳ biến theo event Squad — KHÔNG song song "…with Open Spots").
- "đồng đội"/"teammates" (celebrate.body) KHÔNG dùng token — là từ ghép, không phải đơn vị đứng lẻ.

## Text RIÊNG-theo-theme (tách file `themes/tech/strings.js`) — 2026-06-06
Chuỗi CHỈ dùng cho 1 theme (vd màn "terminal boot" của theme `tech`, chỉ render khi
`data-theme="tech"`) KHÔNG để chung namespace dùng-chung (`profile`…) — dễ lẫn. Tách ra
[strings.js](../../fe/themes/tech/strings.js) (gói theo theme — xem [[theme-system]]): IIFE `STRINGS.en.tech = {…}; STRINGS.vi.tech = {…}`
→ dùng qua `TEXT.tech.<key>`. **Cơ chế:** `TEXT` là *tham chiếu* tới `STRINGS[LANG]` (cùng object),
nên merge thêm namespace SAU khi config.js gán `TEXT` vẫn thấy được — không cần gán lại `TEXT`.
- **Thứ tự nạp:** ngay SAU `config.js` (cần `STRINGS` tồn tại), TRƯỚC ui-render. Đã thêm 1 dòng
  `<script>` vào chuỗi index.html ⇒ chuỗi thiêng [[ui-pipeline]] giờ là `config → themes/tech/strings → …`.
  File guard `if (typeof STRINGS === "undefined") return` (an toàn nếu nạp sai/ngoài browser).
- **CHỈ index.html nạp** — admin.html không có terminal boot nên không thêm (admin để VI inline).
- Parity en.tech vs vi.tech vẫn phải khớp (verified: 4 key 2 bên, `terminalLine2` = hàm `(title)=>…`).
  Cú pháp tách-file đã test bằng vm: **nối** config+strings.js thành 1 script (mô phỏng browser
  chia-sẻ-scope) rồi probe `TEXT.tech` — chạy 2 `runInContext` riêng sẽ FALSE PASS (strings.js
  thấy `STRINGS` undefined → âm thầm `return`, không merge).
- **Quyết định:** user chọn file vật lý riêng (rõ ràng hơn) dù note cũ khuyên "không thêm file";
  đánh đổi = +1 `<script>` trong chuỗi nạp. Theme strings tương lai → thêm vào `tech`/namespace mới
  cùng file này, KHÔNG đụng config.js.

## KHÔNG nằm trong registry (tầng config per-event)
i18n CHỈ lo text hardcode. Text đổi-theo-sự-kiện vẫn ở tầng config ([[firestore-schema]]):
- **Tên icon** (`ICONS[].name`: Cáo, Rồng…), **nhãn/placeholder field** (`FIELDS[].label/placeholder`),
  **title/subtitle TRANG** (`meta/config.title/subtitle`). Đổi qua **admin/Firestore**, không phải code.
- Hệ quả: câu EN có thể chèn giá trị config VI (vd `Join team Cáo?`, `This Mã số nhân viên is…`).
  Muốn 100% EN ⇒ đổi các giá trị config đó ở admin. `DEFAULT_ICONS/DEFAULT_FIELDS` (config.js)
  vẫn VI (chỉ là default cho demo/sheet hoặc khi Firestore lỗi).

## Áp dụng vào phần tử tĩnh (index.html)
Một số chữ nằm trong HTML tĩnh (hiện trước khi JS chạy) nên cần JS điền lại theo `TEXT`:
- **Màn boot**: `#appLoading` + `#noEvent` — `boot()` (app.js) set `textContent/innerHTML` từ
  `TEXT.boot.*` ngay sau khi lấy DOM refs. Text English trong HTML là **fallback pre-JS**.
- **2 heading lưới**: `<h2 id="freeHead">` / `<h2 id="takenHead">` — `renderState()` (ui-render.js)
  set `TEXT.grid.headOpen/headFull` mỗi lần render. (Trước đó là text tĩnh.)

## Thêm/sửa chuỗi
1. Thêm key vào CẢ `STRINGS.en` VÀ `STRINGS.vi` (cùng path). 2. Tham chiếu `TEXT.<ns>.<key>`
(hoặc `TEXT.<ns>.<key>(args)` nếu có biến) tại call site. KHÔNG hardcode literal hiển thị nữa.

## Gotcha
- **`banner.title` chỉ nhận `(name)`** (sửa 2026-06-08): trước là `(name, icon) => …${name} ${icon}`
  — với config theme tech (name="Squad 1", icon="1") ra "You're on **Squad 1 1**" (icon lặp lại số
  đã có trong tên). Icon đã hiện riêng ở `.bi` (ui-render.js) nên bỏ hậu tố `${icon}` khỏi text.
  Đồng bộ convention §"ĐỊNH DANH ĐỘI = TÊN ADMIN" (1 đội cụ thể chỉ dùng `${name}`).
- **Parity en/vi**: thiếu key 1 bên ⇒ `undefined` hiển thị ở ngôn ngữ đó. Có test sandbox
  (node + `vm`) so số key/flatten 2 bên — chạy lại khi thêm key: `keys en=55 vi=55 parity:true`.
- `admin.html` nạp config.js nên cũng load STRINGS (vô hại) nhưng **giữ text VI inline RIÊNG**
  (không dùng `TEXT`) — nếu muốn admin song ngữ phải làm riêng. Hiện admin để VI (nội bộ).
- Comment trong code vẫn tiếng Việt (không hiển thị) — chỉ chuỗi user-facing mới qua `TEXT`.
