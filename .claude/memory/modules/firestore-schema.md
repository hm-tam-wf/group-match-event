---
title: firestore-schema
tags: [module, backend, data]
code: [firestore.rules, docs/js/api.js, docs/js/config.js]
related: [[index]], [[architecture]], [[api-layer]]
updated: 2026-06-03
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
  title, fields, icons, capacity, eventId
  — READ: public
  — WRITE: admin only
```

## Security rules — critical points
1. **Capacity check:** `teams/{icon}.count < cap()` — `cap()` đọc `meta/config.capacity`
2. **Admin UID hardcoded:** `function isAdmin() { return request.auth.uid in ['UID1', 'UID2'] }`
3. **1-person-1-team:** Dùng `getAfter()` trong transaction để verify atomically
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
| `docs/js/config.js` | Frontend default hiển thị |
| `firestore.rules` `cap()` | Server-side enforcement |

**Luôn cập nhật cả 2 cùng lúc.** Nếu rules có capacity 10 nhưng config.js hiển thị 15 → UI cho join nhưng rules reject → confusing error.

### Giảm capacity dưới số người đang có — AN TOÀN, không xoá ai
Sửa capacity (1 số chung mọi đội) xuống thấp hơn đội đông nhất: admin hiện **cảnh báo xác nhận**
(`admin.html` saveEdit, "không ai bị đẩy ra. Vẫn lưu?"). Người đã join **giữ nguyên**; đội vượt mức
hiển thị "đầy" (vd `12/5`) và **không nhận thêm** (rule `count <= cap()`). Tăng lại thì mở chỗ.

## EVENT_ID namespacing
Toàn bộ data nằm dưới `events/{EVENT_ID}/`. Thay EVENT_ID trong `config.js` để tạo event mới hoàn toàn isolated (không cần xoá data cũ).
