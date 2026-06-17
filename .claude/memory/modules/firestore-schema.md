---
title: firestore-schema
tags: [module, backend, data]
code: [backend/firestore.rules, fe/js/data/api.js, fe/js/config/config.js]
related: [[index]], [[architecture]], [[api-layer]]
updated: 2026-06-17
---

# Firestore Schema

## Collections (namespaced dưới `events/{EVENT_ID}/`)
```
teams/{icon}
  count: number         — số người hiện tại
  members: string[]     — mảng first names (public display)

members/{playerId}
  icon: string          — team đã join (guard 1-person-1-team)
  — WRITE: client (trong transaction)
  — READ: client có thể đọc 1 doc (cho transaction guard)
  — LIST: BLOCKED (không enumerate được)

dedup_keys/{empId_hashed}
  ts: timestamp         — thời điểm đăng ký (privacy: không store value)
  — GHI lúc JOIN (apiClaim transaction). Chốt CỨNG chống trùng. delete = admin only.

reg_keys/{empId_hashed}   — ĐẶT-CHỖ TIỀN-JOIN (2026-06-04)
  at: timestamp         — giữ MSNV NGAY khi điền form (trước cả khi join) để KHÔNG tạo signup thứ 2 cùng mã.
  — key = _dedupKey(MSNV) (giống dedup_keys); doc chỉ { at } (KHÔNG chứa pid → không lộ token).
  — GET: public (cổng vào + transaction đọc). LIST: admin. CREATE: hasOnly(['at']). UPDATE: false.
  — DELETE: if true (chủ tự nhả khi đổi/sửa MSNV — typo-recovery; stakes thấp, chốt cứng là dedup_keys).
  — "Chỗ của mình" theo dõi bằng localStorage reservedKey, KHÔNG ở trong doc. Xem apiRegReserve [[api-layer]].

signups/{playerId}
  name, empId, playerId, icon?, at — full PII của MỌI người đã NHẬP THÔNG TIN
  — WRITE: client GHI NGAY khi điền xong hồ sơ (KHÔNG cần chọn đội) qua apiSaveProfile();
           join thì transaction merge thêm `icon`. → admin thấy cả người chưa chọn đội.
  — NGOẠI LỆ (fix 2026-06-03): MSNV bị chặn trùng thì KHÔNG ghi (apiSaveProfile gọi SAU cổng
    dedup, không phải trước) → tránh lưu hồ sơ trùng. Xem [[api-layer]] phần THỨ TỰ GỌI.
  — `icon` CHỈ có sau khi join (trống/“—” nếu mới điền thông tin).
  — READ: admin UID only (Firestore rules)
  — UPDATE: cho phép nếu GIỮ NGUYÊN playerId (gắn đội / sửa lại hồ sơ của chính mình)

meta/config
  title, fields, icons, capacity, caps, openAt, closeAt, eventId, dataEpoch
  — READ: public
  — WRITE: admin only
  — `openAt`/`closeAt` (Firestore Timestamp | null, 2026-06-17): LỊCH mở/đóng đăng ký theo giờ. null/thiếu
    = không giới hạn phía đó. Client (`boot`→`OPEN_AT`/`CLOSE_AT` ms): trước openAt = đếm ngược (tự vào lưới
    khi tới giờ, không reload); sau closeAt = màn "đã kết thúc". Rule `inWindow()` chốt CỨNG theo `request.time`
    (chặn join ngoài khung; admin bypass để seed chạy ngoài giờ). Admin form: 2 ô datetime-local hiểu là **GIỜ VN (UTC+7)**.
  — `caps` (map, 2026-06-17): SĨ SỐ RIÊNG theo đội — `{ "<emoji>": số }`. CHỈ chứa đội đặt riêng; đội
    không có key ⇒ dùng `capacity` chung. Client: `capOf(icon)` (config.js) = `CAPS[icon] || CAPACITY`.
    Rule: `capFor(icon)` (firestore.rules) = `(c.caps != null && icon in c.caps) ? c.caps[icon] : c.capacity`.
    Admin lưu: TẠO = field trong set; SỬA = `update({caps})` RIÊNG (set merge deep-merge map → KHÔNG xoá key
    đã bỏ; phải update để thay trọn vẹn). UI: ô số "sĩ số riêng" mỗi dòng đội (để trống = chung).
  — `dataEpoch` (number, 2026-06-06): "thế hệ" dữ liệu. `clearEvent` ("Xóa dữ liệu") tăng `FV.increment(1)` SAU
    khi clearEventData. Client `boot()`→`DATA_EPOCH`, `init()` so với localStorage `SK.DATA_EPOCH`: server mới hơn
    ⇒ nhả `reservedKey`+`myIcon` cũ (server đã xóa khóa chống trùng nhưng KHÔNG xóa được localStorage máy người
    chơi → "chỗ của mình" ảo → trùng). Đi kèm apiRegReserve verify-and-recreate. Xem [[api-layer]].
```

## `meta/config.fields` — hợp đồng BẮT BUỘC có key "name"
`fields` = mảng `{ key, label, type, required, placeholder }`. Toàn app (`apiClaim`,
`apiSaveProfile`, `ui-render` avatar/summary/roster) dùng `me.fields.name` / `f.name` làm
TÊN HIỂN THỊ ⇒ **phải có đúng 1 field `key:"name"` và `required:true`**.
- Thiếu/không-bắt-buộc ⇒ người chơi điền form + vào lưới được nhưng `apiClaim` trả
  `reason:"missing"` (vì `f.name` rỗng) → "join lỗi". Bug thực tế 2026-06-04: sự kiện tạo
  với key `"hoten"` thay vì `"name"` (config.fields lấy từ admin, không bị ép key).
- Ép phía admin: `validateForm` bắt buộc field key "name" (required) + chặn key trùng;
  `resetForm` seed sẵn `DEFAULT_FIELDS` (name+employeeId) cho form tạo mới — xem [[admin-panel]].
- Chốt phía client: `boot()` thiếu key "name" → hiện lỗi cấu hình, KHÔNG vào lưới; cổng vào trang
  dùng `profileValid()` (đủ + đúng định dạng qua `fieldError`). `fieldError` còn **ép `name` luôn
  required** (dù config để required:false) + `validName` chặn tên rác (≥2 ký tự, có chữ cái) — xem
  [[api-layer]], [[allowlist]].
- (config còn có `subtitle`, `dedupField`, `blockDup`, `allowlistMode` — xem [[api-layer]], [[allowlist]].)

## Security rules — critical points
1. **Capacity check:** `teams/{icon}.count < cap()` — `cap()` đọc `meta/config.capacity`
2. **Admin UID hardcoded:** `function isAdmin() { return request.auth.uid in ['UID1', 'UID2'] }`
3. **1-person-1-team:** KHÔNG dùng `getAfter()` (rules KHÔNG có) — ép phía CLIENT bằng transactional read
   `members/{pid}` trong `apiClaim` (đọc trước, abort `ALREADY` nếu tồn tại). **`pid` theo TỪNG TRÌNH DUYỆT**
   (`me.id="u"+random`) ⇒ guard này **KHÔNG liên kết 2 browser**. Liên kết cross-browser (1 MSNV = 1 đội) **chỉ**
   nhờ `dedup_keys` (key theo MSNV, server-serialized qua transaction conflict + `update:if false`). Xem [[api-layer]].
4. **Admin delete (từ 2026-06-03):** `teams/members/dedup_keys` có `allow delete: if isAdmin()`
   → admin xóa được từ browser (cho tính năng Xóa dữ liệu / Xóa sự kiện). `members/dedup_keys`
   thêm `list: if isAdmin()` (admin cần liệt kê khi clear). **`signups` delete xem điểm 7.**
5. **collectionGroup meta read (từ 2026-06-03):** `match /{path=**}/meta/{doc} { allow read: if isAdmin() }`
   để dashboard liệt kê mọi sự kiện. (Trước đây note ghi "không có collectionGroup" — đã đổi.)
6. **signups update (từ 2026-06-03):** `allow update: if request.resource.data.playerId == resource.data.playerId`.
   Cần để: (a) gắn `icon` khi join (transaction `set` merge), (b) người dùng sửa lại hồ sơ của chính
   mình. Đánh đổi: bản ghi PII KHÔNG còn bất biến — rủi ro thấp vì pid là token ngẫu nhiên & signups khoá đọc.
7. **signups delete = `if true` (từ 2026-06-03):** cho chủ bản ghi TỰ DỌN signup trùng của mình khi
   đụng độ pre-join (xem `apiRemoveProfile` trong [[api-layer]]). An toàn vì signups KHOÁ ĐỌC + pid là
   token ngẫu nhiên → chỉ chủ (biết pid của mình) xoá được, không enumerate/đoán pid người khác.
   Admin vẫn xoá được (`if true` bao trùm). Client `apiRemoveProfile` chỉ gọi với `me.id`.
8. **reg_keys delete = `if true` (từ 2026-06-04):** đặt-chỗ tiền-join (xem điểm collection ở trên +
   `apiRegReserve` [[api-layer]]). delete mở để chủ TỰ NHẢ chỗ khi đổi/sửa MSNV (typo) — không để mã
   người khác bị khoá vĩnh viễn. Stakes thấp: reg_keys chỉ là chốt MỀM tiền-join, xoá chỉ "mở lại" mã
   (= như chưa giữ), KHÔNG đụng dedup_keys (chốt cứng, delete=admin) hay signups. `clearEventData` clear nó.

## Registry & event-list (config docs ngoài namespace)
- `config/active = { eventId }` — sự kiện đang mở ("" = không có). Đọc công khai, write admin.
- `config/eventList = { ids:[...] }` — **registry liệt kê mọi sự kiện** (admin dashboard dùng,
  KHÔNG dùng collectionGroup). Tạo sự kiện = `arrayUnion`; **xóa sự kiện = `arrayRemove`**
  (quên ⇒ "ghost row" hiện `?/?`). Cả hai nằm dưới `match /config/{doc}` (write: isAdmin).
- Xóa hẳn sự kiện = batch: arrayRemove khỏi eventList **+** delete `meta/config`. Participant
  subcollections xóa riêng bằng `clearEventData`.

## CAPACITY sync — PHẢI nhất quán
`CAPACITY` xuất hiện ở 2 nơi:
| File | Role |
|------|------|
| `fe/js/config/config.js` | Frontend default hiển thị (fallback demo) |
| `firestore.rules` `cap()` | Server-side enforcement (đọc động `meta/config.capacity`) |

**Luôn cập nhật cả 2 cùng lúc.** Nếu rules có capacity 10 nhưng config.js hiển thị 15 → UI cho join nhưng rules reject → confusing error.

### Sĩ số RIÊNG theo đội (per-team cap, 2026-06-17)
Ngoài `capacity` chung, mỗi đội có thể đặt cap riêng qua map `meta/config.caps` (xem block meta/config trên).
Enforce CỨNG ở **cả client (`capOf`) lẫn rules (`capFor`)** — chọn "chặn chắc ở rules". Đụng tới: config.js
(`CAPS`+`capOf`), app.js boot()+confirm/toast, api.js apiClaim (firebase+demo: `count>=capOf(icon)`),
ui-render.js (grid/taken/sort/lock/pct dùng `capOf(iconDef.icon)`), admin.html (ô cap mỗi đội + lưu caps +
dashboard `capForIcon`/totalCap), firestore.rules (`capFor(icon)` ở rule `teams` update).
**⚠ Đổi rule `teams` update (`cap()`→`capFor(icon)`) ⇒ PHẢI deploy lại rules** (`firebase deploy --only firestore:rules`).
seedTeams (allowlist import) vẫn OK: set `capacity`=maxGroup; `capFor` fallback về capacity nếu đội chưa có cap riêng.

### Lịch mở/đóng theo giờ (openAt/closeAt, 2026-06-17)
Mở/đóng đăng ký TỰ ĐỘNG theo giờ (admin set 1 lần, không cần cron — client tự xử lý + rules chốt cứng).
- Schema: `meta/config.openAt`/`.closeAt` (Timestamp|null) — xem block meta/config trên.
- Client (`app.js`): `OPEN_AT`/`CLOSE_AT` (config.js, ms). `boot()`→`startSchedule()`: `eventPhase()` → "pre"
  (đếm ngược `#preOpen`, `setInterval` tự gọi `goLiveNow()` khi tới giờ) / "closed" (`#eventClosed`) / "open"
  (`goLiveNow`= hiện appContent + init + hẹn `setTimeout` tự khoá khi tới closeAt). i18n `TEXT.schedule`.
- Rule (`firestore.rules`): `inWindow()` so `request.time` với openAt/closeAt; gate `teams` create+update bằng
  `(inWindow() || isAdmin())` — chặn join ngoài giờ, admin (seed/sửa) bypass. **⚠ Cần deploy lại rules.**
- Admin (`admin.html`): 2 input datetime-local `fOpenAt`/`fCloseAt` (nhãn "(giờ VN)") → `Timestamp.fromMillis`;
  validate closeAt>openAt; create set + edit set(merge, ghi null khi trống → rule coi như bỏ giới hạn).
- **Múi giờ ghim CỨNG UTC+7 (2026-06-17)** — KHÔNG theo timezone máy. Việt Nam fixed UTC+7 (không DST) ⇒ offset
  hằng số chính xác tuyệt đối. `admin.html`: `VN_OFFSET_MS=7h`; `vnInputToMs()` parse chuỗi datetime-local bằng
  `Date.UTC(...)−7h` (thay `new Date(str)`); `tsToLocalInput()` đổ về form bằng `+7h` rồi đọc `getUTC*`. Hiển thị
  công khai `app.js _fmtDateTime` dùng `toLocaleString({timeZone:"Asia/Ho_Chi_Minh"})`; i18n `opensAt` thêm
  "(giờ VN)"/"(GMT+7)". Countdown & rule vẫn so mốc tuyệt đối (`Date.now()`, `request.time`) → không đụng.

### Giảm capacity dưới số người đang có — AN TOÀN, không xoá ai
Sửa capacity (1 số chung mọi đội) xuống thấp hơn đội đông nhất: admin hiện **cảnh báo xác nhận**
(`admin.html` saveEdit, "không ai bị đẩy ra. Vẫn lưu?"). Người đã join **giữ nguyên**; đội vượt mức
hiển thị "đầy" (vd `12/5`) và **không nhận thêm** (rule `count <= cap()`). Tăng lại thì mở chỗ.

## EVENT_ID namespacing
Toàn bộ data nằm dưới `events/{EVENT_ID}/`. Thay EVENT_ID trong `config.js` để tạo event mới hoàn toàn isolated (không cần xoá data cũ).
