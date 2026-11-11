# Hồ sơ sự kiện + link riêng (`profile`, `?e=`, `config/hosts`)

Mục tiêu: mở một sự kiện mới **chỉ bằng dữ liệu** — skin, ngôn ngữ, logo, câu chữ, trang home, thời gian màn intro
nằm trong `events/{eventId}/meta/config.profile`, không sửa code, không deploy. Chỉ phải đụng code khi cần **skin mới**
(một biến thể CSS + chữ) hoặc tính năng mới.

Code: [`fe/js/config/profile.js`](../../fe/js/config/profile.js) (áp hồ sơ), [`fe/js/config/theme.js`](../../fe/js/config/theme.js)
(skin lúc vẽ đầu, `?e=`), [`fe/js/config/config.js`](../../fe/js/config/config.js) (`AVAILABLE_VARIANTS`, `DEFAULT_BRAND`),
[`fe/js/app.js`](../../fe/js/app.js) (`boot()` chọn sự kiện), [`backend/scripts/hosts.js`](../../backend/scripts/hosts.js).

## 1. Chọn sự kiện — mỗi sự kiện một link

Trang `index.html` chọn sự kiện theo thứ tự:

1. `?e=<eventId>` trên URL — vd `https://pickyourgroup.web.app/?e=tnt-mini-outing`.
   ID: `a-z`, `0-9`, `-`, bắt đầu bằng chữ/số, ≤ 100 ký tự (cùng quy tắc ID trong admin). Sai định dạng hoặc sự kiện
   không tồn tại ⇒ màn "không có sự kiện" (KHÔNG rơi về sự kiện đang mở).
2. `config/hosts.byHost[<domain>]` — sự kiện mặc định của một domain (vd GitHub Pages = bản demo `event-demo`, không đụng
   sự kiện thật). Map trỏ tới ID hỏng ⇒ chặn, không rơi về sự kiện đang mở.
3. `config/active.eventId` — sự kiện đang mở (admin bấm "Mở sự kiện").

`config/hosts` và `config/active` được đọc **song song** (không thêm độ trễ). Rules sẵn có: `config/{doc}` đọc công khai,
chỉ admin ghi — không cần sửa rules.

### Quản lý `config/hosts`

```bash
node backend/scripts/hosts.js                                               # liệt kê
node backend/scripts/hosts.js --set hm-tam-wf.github.io=event-demo          # xem trước, KHÔNG ghi
node backend/scripts/hosts.js --set hm-tam-wf.github.io=event-demo --apply  # ghi thật
node backend/scripts/hosts.js --remove localhost --apply
```

Script in rõ đang ghi vào `PRODUCTION` hay `EMULATOR` (`FIRESTORE_EMULATOR_HOST`), kiểm sự kiện đích có tồn tại
(`--force` để bỏ qua), ghi trong transaction. Domain = `location.hostname` (chữ thường, không `http://`, không cổng).

> ⚠ **Thứ tự rollout bắt buộc** khi lần đầu đưa code này lên GitHub Pages: ghi
> `hm-tam-wf.github.io → event-demo` vào `config/hosts` **TRƯỚC** khi push. Code cũ dùng map trong code
> (`EVENT_ID_BY_HOST`, đã gỡ); thiếu doc này thì bản demo trên Pages sẽ mở sự kiện thật đang chạy.

## 2. Hồ sơ — `events/{eventId}/meta/config.profile`

Map, **mọi key đều tuỳ chọn. Key THIẾU = hành vi cũ** ⇒ sự kiện chưa có hồ sơ chạy y như trước khi có tính năng này.

| key | kiểu | ý nghĩa | thiếu key |
|---|---|---|---|
| `variant` | string | skin: id trong `AVAILABLE_VARIANTS` (hiện có `"tnt"`); `""` = theme gốc; id lạ ⇒ `""` | `DEFAULT_VARIANT` (`'tnt'`) |
| `lang` | `"vi"` \| `"en"` | ngôn ngữ giao diện | `defaultLang` của skin (tnt: `vi`), rồi `"en"` |
| `brand` | `{ name, logoUrl, logoAlt? }` | khối logo (tên ≤ 40 ký tự). `name` + `logoUrl` đều rỗng = ẩn logo. Khai `brand` thì skin (vd tnt) **thôi** thay logo bằng logo của skin | `DEFAULT_BRAND` (FARADAY; skin tnt tự vẽ logo TNT) |
| `homeUrl` | string | trang mà nút Huỷ / "Quay lại" đưa về. `""` = không có trang home: ẩn nút rời trang, Huỷ chỉ đóng popup | hành vi cũ: về trang `travel.html` (referrer → `history.back` → `travel.html`) |
| `introMs` | number 1000..15000 | thời gian giữ màn terminal trước khi mở form | theo skin (tech 4000, tnt 5000) |
| `copy` | `{ vi?: {…}, en?: {…} }` | ghi đè câu chữ theo đường dẫn chấm trong `STRINGS[lang]` (vd `"banner.ok"`, `"tech.terminalLine1"`) | chữ mặc định |

Quy tắc `copy`:
- Chỉ key **đã tồn tại** trong `STRINGS[lang]` có hiệu lực (key gõ sai bị bỏ qua, có cảnh báo trong console).
- Key gốc là **hàm** (nhận tham số, vd tên phòng) ⇒ chuỗi được bọc thành hàm; `{0}`, `{1}`… = tham số theo vị trí.
- Thứ tự phủ: chữ gốc → chữ của skin → `profile.copy`. Chuỗi được phép chứa HTML đơn giản như `subtitle`
  (chỉ admin ghi được `meta/config`).

Link (`brand.logoUrl`, `homeUrl`) chỉ nhận đường dẫn tương đối trong site hoặc `https://`; `javascript:`, `data:`,
`//domain-khác` bị bỏ (coi như rỗng).

Ví dụ — sự kiện theme gốc, tiếng Anh, logo riêng, không có trang home:

```json
{
  "variant": "",
  "lang": "en",
  "brand": { "name": "ACME", "logoUrl": "https://cdn.example.com/acme.png", "logoAlt": "ACME" },
  "homeUrl": "",
  "introMs": 3000,
  "copy": { "en": { "celebrate.ok": "See you at the party!", "tech.terminalLine2": "Welcome to {0}" } }
}
```

Ví dụ — sự kiện TNT có trang lịch trình: `{ "variant": "tnt", "homeUrl": "travel.html" }`.

Ghi hồ sơ: luôn ghi **cả map** `update({ profile })` (`set(..., {merge:true})` chỉ trộn sâu, không xoá key cũ).
Luồng "Sửa sự kiện" của admin dùng `set(merge:true)` ⇒ giữ nguyên `profile`. Tạo sự kiện mới: admin ghi tường minh
`NEW_EVENT_PROFILE` (config.js — hiện `{ variant: "tnt", lang: "vi", homeUrl: "" }`) rồi sửa ở tab Nhận diện.

### Xem trước không cần sửa dữ liệu

- `?variant=<id>` — ép skin (rỗng `?variant=` = ép theme gốc), thắng hồ sơ.
- `?lang=vi` / `?lang=en` — ép ngôn ngữ, thắng hồ sơ.

### Không nháy giao diện

`<html data-event-page>` (index.html) ⇒ `theme.js` dùng hồ sơ đã lưu ở lần mở trước (localStorage `linhthu:evprofile:<eventId | @domain>`)
cho lần vẽ đầu; `profile.js` áp ngay lúc nạp; `boot()` đọc hồ sơ thật rồi áp lại **trước** khi hiện nội dung (đang ẩn sau loader).
Lần đầu mở trên một máy: vẽ đầu theo mặc định (`tnt`), đổi sang skin thật khi loader còn che.

## 3. Thêm một skin (biến thể) mới

1. Tạo `fe/themes/<theme>/variants/<id>/`: `<id>.css` (mọi selector scope `[data-theme="<theme>"][data-variant="<id>"]`),
   `strings.js` gọi `registerVariantCopy("<id>", { vi: {...}, en: {...} })` (KHÔNG sửa `STRINGS` trực tiếp), ảnh trong `img/`.
2. Thêm 1 dòng vào `AVAILABLE_VARIANTS` (config.js): `{ id, label, theme, defaultLang }` — admin đọc danh sách này.
3. Thêm `<link>` CSS + `<script>` strings vào `index.html` (script đặt SAU `themes/<theme>/strings.js`, TRƯỚC `js/config/profile.js`).
4. Logo riêng của skin vẽ bằng CSS thì scope thêm `:not([data-brand="custom"])` để sự kiện khai `brand` vẫn đổi được logo.

## 4. Kiểm thử

- Unit (Node vm, file thật): `unit-step2.js` — biến thể, ngôn ngữ, copy (chuỗi/hàm), brand, homeUrl, introMs, `?e=`, cache vẽ đầu.
- E2E trình duyệt (Firestore emulator): layer P — `?e=`, `config/hosts` (map / map hỏng / không map), hồ sơ đầy đủ,
  nút rời trang theo `homeUrl`, cache vẽ đầu, `homeUrl` tường minh; sự kiện không có hồ sơ phải y như trước.
