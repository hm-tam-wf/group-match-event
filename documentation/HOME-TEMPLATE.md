# Trang home dùng chung — `events/{eventId}/meta/home`

Trang home (lịch trình, lưu ý, trang phục, di chuyển…) của MỌI sự kiện dùng chung một template
`fe/home.html`, nội dung nằm trong Firestore ở doc `events/{eventId}/meta/home`. Thêm sự kiện mới = soạn doc
này (trình soạn trong admin, file JSON/Excel, hoặc script) — không sửa code, không deploy.

- Link: `home.html?e=<eventId>`. Nút chính (CTA) mặc định dẫn sang `index.html?e=<eventId>`.
- Rules: dùng lại `match /events/{id}/meta/{doc}` (đọc công khai, chỉ admin ghi) — không cần sửa rules.
- Schema thực thi ở **một** file: [`fe/js/home/home-schema.js`](../fe/js/home/home-schema.js) (`HomeSchema`), dùng
  chung cho trang home (`normalize` — khoan dung), trình soạn admin và script (`validate` — chặt trước khi ghi).
- Mẫu đầy đủ: [`backend/seed/home-tnt.json`](../backend/seed/home-tnt.json) (chuyển nguyên từ `fe/travel/data.js`).

## 1. Cấu trúc doc (schema v1)

Mọi field đều optional; thiếu ⇒ rỗng. Chuỗi được **escape** khi vẽ — chỉ field có tên kết thúc bằng `Html`
mới được vẽ như HTML (đã lọc thẻ). Số trong ngoặc = độ dài tối đa (ký tự) mà `validate` cho phép.

```jsonc
{
  "v": 1,                        // phiên bản schema; doc v>1 ⇒ trình soạn/script từ chối sửa
  "pageTitle": "",               // (120) tiêu đề tab trình duyệt; "" ⇒ hero.title — meta/config.title
  "hero": {
    "badge": "",                 // (60) nhãn nhỏ trên tiêu đề, vẽ nguyên văn (kể cả emoji); "" ⇒ ẩn
    "title": "",                 // (120) H1; "" ⇒ meta/config.title
    "subtitle": "",              // (300) khẩu hiệu dưới H1; "" ⇒ ẩn
    "date": "", "duration": "",  // (80)/(60) chip ngày: "date (duration)"; cả hai "" ⇒ ẩn chip
    "dateIcon": "",              // (16) "" ⇒ 📅
    "location": "", "locationIcon": "",   // chip địa điểm; icon "" ⇒ 📍
    "venue": "", "venueIcon": "",         // chip nơi ở/khách sạn; icon "" ⇒ 🏨
    "imageUrl": "", "imageAlt": ""        // ảnh tuỳ chọn dưới khẩu hiệu (URL https:// hoặc đường dẫn trong site)
  },
  "cta": {
    "label": "",                 // (40) nút sang trang sự kiện; "" ⇒ chữ mặc định theo ngôn ngữ
    "icon": "",                  // (16) "" ⇒ không icon
    "url": "",                   // (500) "" ⇒ index.html?e=<eventId>; khác ⇒ https:// hoặc đường dẫn trong site
    "scheduleLabel": "",         // (40) nút cuộn tới mục lục (chỉ hiện khi có mục); "" ⇒ chữ mặc định
    "scheduleIcon": ""           // (16) "" ⇒ 🗓️
  },
  "sections": [ /* tối đa 12 mục, CÓ THỨ TỰ — xem §2 */ ],
  "footer": { "text": "", "subtext": "" }   // (200) mỗi dòng; cả hai "" ⇒ ẩn chân trang
}
```

## 2. Mục (`sections[]`)

Field chung của mọi mục:

| field | ý nghĩa |
|---|---|
| `id` | `^[a-z0-9][a-z0-9-]{0,31}$`, duy nhất trong trang ⇒ neo `#sec-<id>` (vd `#sec-notes`) |
| `type` | `timeline` \| `notes` \| `dresscode` \| `transport` \| `text` — type khác = "type lạ" (§2.6) |
| `title` | (120) tiêu đề H2 của mục |
| `navLabel` | (40) nhãn tab mục lục; "" ⇒ `title` |
| `icon` | (16) emoji ở tab + đầu mục; "" ⇒ 📌 |

Mục không có nội dung (vd lịch trình chưa có ngày nào) bị ẩn cả tab lẫn khối.

### 2.1 `timeline` — lịch trình theo ngày
`days[]` (≤14): `label` (40, "NGÀY 01"), `date` (40), `title` (120), `summary` (600), `items[]` (≤40):
`time` (40), `icon` (16, "" ⇒ •), `title` (160), `desc` (1000), `tag` (40), `tone`.
`tone` = màu nhãn: `""` (tự đoán theo chữ của `tag` như travel.js: ẩm thực/tiệc → food, gala/đêm → gala,
team/game/khám phá → game, xe/chuyển/tập trung → move) | `food` | `gala` | `game` | `move`.

### 2.2 `notes` — lưu ý
`items[]` (≤40): `icon` (16), `badge` (40, "" ⇒ ẩn), `title` (160), `desc` (1000).

### 2.3 `dresscode` — trang phục
`items[]` (≤20): `day` (120), `time` (80), `highlight` (160), `desc` (1000), `tip` (600), `featured`
(boolean — viền nổi bật), `colors[]` (≤12): `name` (60), `hex` (`#RGB`/`#RRGGBB`), `border` (boolean — màu sáng
luôn có viền dù `false`).

### 2.4 `transport` — di chuyển & liên hệ
| field | ý nghĩa |
|---|---|
| `infoTitle` | (80) tiêu đề khối trái; "" ⇒ chữ mặc định |
| `info[]` (≤20) | dòng thông tin `icon` (16), `label` (80), `text` (600) — giờ tập trung, điểm đón, loại xe… |
| `vehicles[]` (≤30) | `name` (40, "Xe 01"), `label` (120), `plate` (40), `lead` (120, trưởng xe) |
| `contactsTitle` | (80) tiêu đề khối liên hệ; "" ⇒ chữ mặc định |
| `contactsBadge` | (40) huy hiệu cạnh tiêu đề ("24/7 SẴN SÀNG"); "" ⇒ ẩn |
| `contactsNote` | (300) dòng hướng dẫn dưới tiêu đề; "" ⇒ ẩn |
| `contacts[]` (≤20) | `role` (80), `name` (80), `phone` (40 — nút `tel:` chỉ giữ số và `+`), `duty` (160) |

Khối trái ẩn khi không có `info` lẫn `vehicles`; khối liên hệ ẩn khi không có `contacts`.

### 2.5 `text` — văn bản tự do
`body` (5000) văn bản thường (dòng trống = đoạn mới) · `bodyHtml` (20000) HTML, **ưu tiên** hơn `body` khi có.
HTML được lọc ở trình duyệt: chỉ giữ `b strong i em u s small mark br p ul ol li h3 h4 blockquote span hr a`;
`a` chỉ giữ `href` an toàn (`https://`, đường dẫn trong site, `mailto:`, `tel:`), tự thêm `target=_blank rel=noopener`.

### 2.6 Type lạ (mở rộng về sau)
Mục có `type` hợp lệ (`^[a-z][a-z0-9-]{0,31}$`) nhưng chưa được hỗ trợ: dữ liệu được giữ nguyên khi đọc/ghi
(trình soạn sửa dạng JSON), trang home bỏ qua. Thêm type mới = thêm 1 dòng vào `TYPES` trong `home-schema.js`
+ 1 hàm vẽ trong `fe/js/home/home-render.js` (+ nhãn trình soạn).

## 3. Giao diện, ngôn ngữ, chọn sự kiện (đọc từ `meta/config`, hợp đồng bước 2)
- Chọn sự kiện: `?e=<id>` (sai định dạng ⇒ màn "không tìm thấy") → `config/hosts.byHost[hostname]` → `config/active.eventId`.
- `profile.variant` (thiếu ⇒ `DEFAULT_VARIANT`; `""`/id lạ ⇒ theme gốc) đặt `data-variant` (+ `data-theme` của biến thể);
  `?variant=` trên URL thắng. `profile.lang` (`vi`|`en`; thiếu ⇒ `defaultLang` của biến thể, rồi `en`) chọn
  ngôn ngữ phần chữ tĩnh của trang (loader, nút mặc định, thông báo lỗi…); `?lang=` thắng. `profile.brand` ⇒ khối logo
  (`name:""` + `logoUrl:""` ⇒ ẩn). `meta/config.title` làm H1 khi `hero.title` rỗng.
- Thiếu `meta/home` (có `meta/config`) ⇒ màn "chưa có trang thông tin" + nút sang trang sự kiện. Lỗi mạng ⇒ màn thử lại.
