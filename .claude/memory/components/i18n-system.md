---
title: i18n-system
tags: [ui, component, i18n]
code: [fe/js/config/config.js, fe/js/app.js, fe/js/ui/ui-render.js, fe/js/ui/ui-utils.js, fe/index.html]
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
mọi chuỗi tự đổi theo (verified: đổi `UNIT.en`→team/teams ⇒ "Teams with Open Spots"/"Join Team X?").
- Lưu dạng THƯỜNG; helper `_cap(s)` viết hoa khi đầu câu/nhãn/ghép tên riêng
  (vd `headings`, `ftLabel`, `toast.full`, `confirm.title` → "Join Squad X?"). EN có số ít/nhiều
  (one="squad", many="squads"); VI dùng chung "đội".
- Chuỗi TĨNH chứa đơn vị đã chuyển thành template literal `` `…${UE.one}…` `` (nội suy lúc dựng
  object vì UNIT khai báo trước). `grid.headFull` EN = `` `${_cap(UE.one)} completed Successfully` ``
  (text tuỳ biến theo event Squad — KHÔNG song song "…with Open Spots").
- "đồng đội"/"teammates" (celebrate.body) KHÔNG dùng token — là từ ghép, không phải đơn vị đứng lẻ.

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
- **Parity en/vi**: thiếu key 1 bên ⇒ `undefined` hiển thị ở ngôn ngữ đó. Có test sandbox
  (node + `vm`) so số key/flatten 2 bên — chạy lại khi thêm key: `keys en=55 vi=55 parity:true`.
- `admin.html` nạp config.js nên cũng load STRINGS (vô hại) nhưng **giữ text VI inline RIÊNG**
  (không dùng `TEXT`) — nếu muốn admin song ngữ phải làm riêng. Hiện admin để VI (nội bộ).
- Comment trong code vẫn tiếng Việt (không hiển thị) — chỉ chuỗi user-facing mới qua `TEXT`.
