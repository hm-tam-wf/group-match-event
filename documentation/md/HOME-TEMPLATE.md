# Trang home dùng chung — `events/{eventId}/meta/home`

Trang home (lịch trình, lưu ý, trang phục, di chuyển…) của MỌI sự kiện dùng chung một template
`fe/home.html`, nội dung nằm trong Firestore ở doc `events/{eventId}/meta/home`. Thêm sự kiện mới = soạn doc
này (trình soạn trong admin, file JSON/Excel, hoặc script) — không sửa code, không deploy.

- Link: `home.html?e=<eventId>`. Nút chính (CTA) mặc định dẫn sang `index.html?e=<eventId>`.
- Rules: dùng lại `match /events/{id}/meta/{doc}` (đọc công khai, chỉ admin ghi) — không cần sửa rules.
- Schema thực thi ở **một** file: [`fe/js/home/home-schema.js`](../../fe/js/home/home-schema.js) (`HomeSchema`), dùng
  chung cho trang home (`normalize` — khoan dung), trình soạn admin và script (`validate` — chặt trước khi ghi).
- Mẫu đầy đủ: [`backend/seed/home-tnt.json`](../../backend/seed/home-tnt.json) (chuyển nguyên từ `fe/travel/data.js`).

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
- Chọn sự kiện (cùng quy tắc `index.html`): `?e=<id>` (sai định dạng ⇒ màn "không tìm thấy") → `config/hosts.byHost[hostname]`
  (domain CÓ mục mà id sai ⇒ "không tìm thấy", KHÔNG rơi về sự kiện đang mở) → `config/active.eventId`.
- Hồ sơ áp bằng `applyEventProfile()` của `js/config/profile.js` — chung với trang sự kiện (home.html nạp theme.js →
  config.js → profile.js): `profile.variant` (thiếu ⇒ `DEFAULT_VARIANT`; `""`/id lạ ⇒ theme gốc; `?variant=` thắng),
  `profile.lang` (thiếu ⇒ `defaultLang` của biến thể, rồi `DEFAULT_LANG`; `?lang=` thắng) chọn ngôn ngữ phần chữ tĩnh
  của trang (loader, nút mặc định, thông báo lỗi…), `profile.brand` ⇒ khối logo (`name:""` + `logoUrl:""` ⇒ ẩn).
  Đọc xong thì `cacheEventProfile()` như trang sự kiện. `meta/config.title` làm H1 khi `hero.title` rỗng.
- Thiếu `meta/home` (có `meta/config`) ⇒ màn "chưa có trang thông tin" + nút sang trang sự kiện. Lỗi mạng ⇒ màn thử lại.
- Giao diện dùng lại nguyên `travel/travel.css` (markup cùng class với `travel.html`) + `assets/home.css` (phần bổ sung) ⇒
  khi gỡ `travel.html` thì **giữ lại** `travel/travel.css` (hoặc chuyển chỗ và sửa `<link>` trong `home.html`).

## 4. Trình soạn trong admin — `fe/js/admin/home-editor.js`
- API: `HomeEditor.mount(el, { db, eventId, previewBase? })` (Promise; mount lại = tự gỡ bản cũ) · `unmount()` ·
  `isDirty()` · `getDoc()` · `setDoc(doc)`. Cần nạp trước `js/home/home-schema.js` + `js/home/home-sheets.js`;
  Excel dùng `window.XLSX` (admin.html đã nạp SheetJS). CSS riêng `assets/admin-home.css` (class `he-*`, token của admin.css).
- Soạn đầu trang, nút, chân trang và từng mục (thêm / xoá / lên-xuống; ngày & thẻ trang phục gập được). Mục type lạ: sửa JSON.
- **Lưu** = `validate` (lỗi ⇒ tô đỏ ô + danh sách lỗi bấm để nhảy tới, KHÔNG ghi) rồi `set()` TRỌN doc (không merge).
- **Xem trang** mở `home.html?e=<id>` (bản ĐÃ lưu). **Xuất/Nạp JSON**, **Xuất/Nạp Excel** (nạp chỉ thay nội dung
  đang soạn — phải bấm Lưu mới ghi). Có cảnh báo khi rời trang / đổi sự kiện lúc còn thay đổi chưa lưu.

## 5. Định dạng file Excel (`HomeSheets`, `fe/js/home/home-sheets.js`)
Tên sheet + tên cột là định dạng file (đổi = file cũ không nạp được). Sheet `Hướng dẫn` trong file xuất giải thích từng cột.

| sheet | cột | ghi chú |
|---|---|---|
| `Trang` | `key`, `value` | `pageTitle`, `hero.*`, `cta.*`, `footer.*` |
| `Mục` | `id`, `type`, `title`, `navLabel`, `icon`, `infoTitle`, `contactsTitle`, `contactsBadge`, `contactsNote`, `body`, `bodyHtml`, `json` | 1 dòng / mục, đúng thứ tự trang; `json` = mục type lạ |
| `Lịch trình` | `section`, `day`, `dayLabel`, `dayDate`, `dayTitle`, `daySummary`, `time`, `icon`, `title`, `desc`, `tag`, `tone` | `day` = số thứ tự ngày; thông tin ngày ở dòng đầu của ngày |
| `Lưu ý` | `section`, `icon`, `badge`, `title`, `desc` | |
| `Trang phục` | `section`, `item`, `day`, `time`, `highlight`, `desc`, `tip`, `featured` | `item` = số thứ tự thẻ; `featured`: `x` = có |
| `Màu trang phục` | `section`, `item`, `name`, `hex`, `border` | gắn vào thẻ `item` cùng mục |
| `Di chuyển` / `Xe` / `Liên hệ` | `section` + field của `info` / `vehicles` / `contacts` | |

`section` = `id` của mục (phải có ở sheet `Mục`, đúng type). Dòng trống bị bỏ qua; dòng lịch trình không có nội dung
hoạt động chỉ khai báo ngày. File xuất đặt định dạng Text cho mọi ô để Excel không tự đổi `05:30`/`15/04` thành giờ/ngày.

## 6. Script nạp/ghi — `backend/scripts/home-import.js`
```bash
node backend/scripts/home-import.js --event <eventId> --file <file.json|file.xlsx>            # DRY-RUN: kiểm tra + in khác biệt
node backend/scripts/home-import.js --event <eventId> --file <file.json|file.xlsx> --apply    # ghi thật (set trọn doc)
#   --key <serviceAccountKey.json>  (mặc định ./serviceAccountKey.json)  ·  FIRESTORE_EMULATOR_HOST=… ⇒ chạy trên emulator
```
Mặc định chỉ đọc: validate, kiểm sự kiện có `meta/config`, in tóm tắt + danh sách đường dẫn thay đổi so với bản đang có.
`--apply` mới ghi rồi đọc lại để đối chiếu. Mẫu TNT: `--file backend/seed/home-tnt.json`.

## 7. Gắn trình soạn vào `admin.html` (HOOK — ĐÃ CHÈN khi tích hợp 2026-11-11; giữ đây làm tài liệu)
Thanh tab đáy mobile của `admin.css` chia cột theo SỐ TAB THỰC TẾ (`grid-auto-flow: column`) ⇒ thêm tab không phải sửa CSS.
Xem trước trang home: HOOK 4 truyền `previewBase = window.eventSiteBase()` (admin.html) ⇒ trên site admin riêng
(`pickyourgroup-admin`, không có `home.html`) nút xem trước mở trên site sự kiện; nơi khác là link tương đối.

**HOOK 1** — trong `<head>`, ngay sau `<link rel="stylesheet" href="assets/admin.css">`:
```html
<link rel="stylesheet" href="assets/admin-home.css">
```

**HOOK 2** — trong `<nav class="nav">`, ngay sau nút tab "Danh sách cho phép" (`data-tab="tab-allowlist"`):
```html
      <button class="tab" data-tab="tabHome" data-title="Trang thông tin" data-sub="Soạn trang home của sự kiện: lịch trình, lưu ý, trang phục, di chuyển">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg><span class="tab-txt tab-long">Trang thông tin</span><span class="tab-short" aria-hidden="true">Home</span></button>
```

**HOOK 3** — trong `<main class="main">`, ngay sau `</section>` của `#tab-allowlist` (trước `</main>`):
```html
    <!-- ── TRANG: Trang thông tin (trang home của sự kiện — js/admin/home-editor.js) ── -->
    <section id="tabHome" class="tab-panel" aria-label="Trang thông tin">
      <div class="panel toolbar">
        <label class="field field-inline grow"><span>Sự kiện</span><select id="homeEvent"></select></label>
      </div>
      <div id="homeEditorMount"><p class="hint">Chọn sự kiện để soạn trang thông tin.</p></div>
    </section>
```

**HOOK 4** — cuối `<body>`, SAU `<script>` inline chính của admin (cần `db` của firebase-config.js và `#sigSelect` đã có):
```html
<!-- Trình soạn trang home: danh sách sự kiện lấy từ dropdown trang Đăng ký (#sigSelect) -->
<script src="js/home/home-schema.js"></script>
<script src="js/home/home-sheets.js"></script>
<script src="js/admin/home-editor.js"></script>
<script>
(function () {
  "use strict";
  var tab = document.querySelector('.tab[data-tab="tabHome"]');
  var sel = document.getElementById("homeEvent"), box = document.getElementById("homeEditorMount");
  if (!tab || !sel || !box || !window.HomeEditor || typeof db === "undefined" || !db) return;
  var cur = "";
  function syncEvents() {
    var src = document.getElementById("sigSelect");
    var keep = sel.value || cur;
    sel.innerHTML = src ? src.innerHTML : "";
    if (keep) sel.value = keep;
    if (!sel.value && src) sel.value = src.value;   // mặc định = sự kiện đang chọn ở trang Đăng ký (sự kiện đang mở)
  }
  function open(eid) {
    cur = eid;
    if (!eid) { HomeEditor.unmount(); box.innerHTML = '<p class="hint">Chọn sự kiện để soạn trang thông tin.</p>'; return; }
    // site admin riêng không có home.html ⇒ xem trước mở trên site sự kiện (eventSiteBase của admin; nơi khác = link tương đối)
    var previewBase = typeof window.eventSiteBase === "function" ? window.eventSiteBase() : "";
    HomeEditor.mount(box, { db: db, eventId: eid, previewBase: previewBase }).catch(function (e) {
      box.innerHTML = '<p class="err"></p>';
      box.firstChild.textContent = "Không mở được trình soạn: " + e.message;
    });
  }
  tab.addEventListener("click", function () { syncEvents(); if (sel.value !== cur) open(sel.value); });
  sel.addEventListener("change", function () {
    if (sel.value === cur) return;
    if (HomeEditor.isDirty() && !window.confirm("Trang thông tin còn thay đổi chưa lưu. Bỏ thay đổi để chuyển sự kiện?")) { sel.value = cur; return; }
    open(sel.value);
  });
})();
</script>
```
