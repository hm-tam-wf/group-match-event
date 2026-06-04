---
title: api-layer
tags: [module]
code: [docs/js/data/api.js, docs/js/config/config.js, docs/js/config/firebase-config.js]
related: [[index]], [[architecture]], [[firestore-schema]], [[allowlist]]
updated: 2026-06-04
---

# API Layer

## Overview
`api.js` là data layer duy nhất. Expose các hàm global: `apiState()`, `apiClaim()`, `apiSaveProfile()`, `apiRemoveProfile()`, `apiDedupTaken()`, `apiRegReserve()`/`apiRegTaken()`, `apiAllowlistAllowed()`/`apiAllowlistInfo()`, `apiSubscribe()`. Hỗ trợ 3 backends pluggable.

## Backend auto-detection
```javascript
const MODE = FIREBASE_ON ? "firebase" : (SCRIPT_URL ? "sheet" : "demo");
```
- **firebase** — Cloud Firestore (production). `FIREBASE_ON` = true khi `firebase-config.js` load đúng.
- **sheet** — Google Apps Script legacy (archived backend). `SCRIPT_URL` defined.
- **demo** — localStorage only. Fallback cuối. Dùng để dev/test không cần Firebase.

> Nếu Firebase credentials copy sai → silently fall back về demo mode. Hay bị nhầm!

## apiClaim() — Transaction logic
Claim 1 slot trong 1 team:
1. Kiểm tra `dedup_keys/{empId}` — đã đăng ký chưa?
2. Kiểm tra `members/{playerId}` — đã join team nào chưa?
3. Kiểm tra `teams/{icon}.count < CAPACITY`
4. Nếu tất cả pass → ghi atomically: teams, members, dedup_keys, signups

Khi `ALLOWLIST_MODE`: đọc thêm `allowlist/{key}` trong CÙNG `Promise.all` → `reason:"notAllowed"` (ngoài
danh sách) hoặc `reason:"nameMismatch"` (doc có `name` & tên nhập lệch sau `_normName`). So trên doc ĐÃ
đọc — KHÔNG thêm read, KHÔNG đổi thứ tự đọc-ghi. Xem [[allowlist]].

## Retry logic (load-bearing!)
8 retries × exponential backoff (150ms base, max 2.5s) + **random jitter**:
```javascript
Math.random() * back  // NOT fixed delay
```
Jitter là bắt buộc — khi 500 người join cùng đội cùng lúc, jitter phá synchrony, tránh thundering herd. Nếu bỏ jitter → tất cả retry đồng thời → deadlock liên tục.

## apiSaveProfile() — lưu hồ sơ MỌI người (CHƯA chọn đội cũng lưu, NHƯNG trùng thì KHÔNG)
Ghi `signups/{pid}` (merge) NGAY khi điền xong thông tin, KHÔNG cần join đội → admin thấy toàn bộ
người đã nhập thông tin. Gọi từ: profile modal save (`ui-render.js`) + `init()` (`app.js`, đồng bộ
người đã điền từ trước). Best-effort (try/catch, không await chặn UX; firebase-only, sheet/demo no-op).
`merge:true` → không đè `icon` đã gắn lúc join. Sau đó join thì `apiClaim` transaction merge thêm `icon`.
→ xem [[firestore-schema]] (signups update rule giữ nguyên playerId).

**THỨ TỰ GỌI (quan trọng — fix bug 2026-06-03):** phải gọi apiSaveProfile **SAU** cổng chống trùng,
KHÔNG được gọi trước. Trong `save()` (ui-render): kiểm tra `apiDedupTaken()` trước → nếu `taken` thì
return (không ghi). Trong `init()` (app.js): chỉ gọi khi `!dupBlocked`. Lý do: trước đây ghi data
trước cổng → người cố nhập lại đúng MSNV đã đăng ký vẫn lưu được hồ sơ trùng vào signups.
(Dedup chỉ khoá tại JOIN qua `dedup_keys`; apiDedupTaken chỉ bắt được mã đã có người JOIN.)

## apiRemoveProfile() — tự dọn signup TRÙNG của chính mình (đụng độ pre-join, 2026-06-03)
Xoá `signups/{pid}` của chính mình (best-effort, firebase-only). Gọi khi phát hiện MSNV của mình
hoá ra TRÙNG (người khác đã JOIN trước): `doClaim` nhánh `"dup"`, `save()` nhánh `taken`, và `init()`
khi `dupBlocked`. Lý do: hồ sơ lưu ở save-time (lúc MSNV còn trống) có thể trở thành rác trùng sau
khi người khác join → dọn để admin không thấy data trùng. CHỈ xoá đúng `signups/{me.id}`, không đụng
bản ghi người thắng (pid khác). → Rule `signups allow delete: if true` (xem [[firestore-schema]]).

## apiRegReserve() / apiRegTaken() — ĐẶT-CHỖ TIỀN-JOIN (reg_keys, 2026-06-04)
Khắc phục giới hạn cũ: dedup_keys chỉ ghi lúc JOIN nên 2 người nhập CÙNG MSNV mà chưa ai join đều tạo
signup → admin thấy 2 dòng trùng. signups KHOÁ ĐỌC → client không tự dò được. Giải pháp: **giữ chỗ công
khai `reg_keys/{key}` NGAY khi điền form** (key = `_dedupKey(MSNV)`, giống dedup_keys; doc chỉ `{at}`,
KHÔNG chứa pid → không lộ token).
- **`apiRegReserve(value)`** — transaction: reg_keys/{key} đã có & KHÔNG phải chỗ mình ⇒ `{ok:false,
  reason:"dup"}`; chưa có ⇒ `set {at}` + nhớ `reservedKey` (localStorage per-event, `sSet`). Đổi MSNV
  (typo) ⇒ tự `delete` chỗ cũ để không khoá nhầm mã người khác. Fail-open (lỗi mạng/không bật ⇒ `{ok:true}`).
- **PHẢI gọi apiRegReserve TRƯỚC MỌI apiSaveProfile** — có 2 chỗ ghi signups: `save()` (ui-render, sau
  các cổng dedup/allowlist/namecheck) VÀ `init()` (app.js, đồng bộ hồ sơ phiên trước). **Bug 2026-06-04:**
  ban đầu chỉ `save()` đặt-chỗ; `init()` ghi signup KHÔNG đặt-chỗ → hồ sơ điền phiên trước (localStorage)
  được ghi lại không có reg_keys → người trùng MSNV sau đó KHÔNG bị chặn (2 dòng signup, chỉ 1 reg_key,
  reg_key sinh ở thời điểm người THỨ HAI). Fix: `init()` cũng `apiRegReserve` trước `apiSaveProfile` (chỉ
  khi `!myIcon`); trùng ⇒ dupBlocked + apiRemoveProfile (tự dọn bản thua khi reload).
- **`apiRegTaken(value)`** — cổng VÀO TRANG (`init()` app.js, sau `apiDedupTaken`): reg_keys/{key} tồn tại
  & KHÔNG phải chỗ mình ⇒ chặn. Bịt lỗ "bị chặn ở save() rồi reload để vào lưới" (người bị chặn không có
  `reservedKey` → vẫn chặn). Chủ sở hữu (`reservedKey===key`) KHÔNG bị chặn.
- **"Chỗ của mình"** = localStorage `reservedKey` (per-event, `shared:false`), KHÔNG phải pid-trong-doc →
  doc reg_keys không lộ gì. Hệ quả CHỦ ĐÍCH: cùng người đổi THIẾT BỊ (pid mới, reservedKey trống) trước khi
  join ⇒ bị chặn ở thiết bị thứ 2 ("1 MSNV = 1 đăng ký"). Chốt CỨNG vẫn là dedup_keys lúc JOIN (apiClaim).
- **Fix H2 (2026-06-04, app.js:91):** khi `init()` mint danh tính MỚI (`!me.id` → mất/xoá `me`) thì
  `await sDel("reservedKey")` → nhả reservedKey cũ. Bịt lỗ: trước đây `me` bị xoá nhưng reservedKey còn sót
  → `apiRegReserve`/`apiRegTaken` short-circuit "chỗ của mình" cho qua nhầm. Returning user còn `me.id` ⇒
  không chạy ⇒ giữ reservation. Không đổi hành vi cổng.
- **Giới hạn di trú + vì sao KHÔNG backfill (2026-06-04):** reg_keys bắt đầu RỖNG → chỉ bảo vệ đăng ký MỚI.
  Signup CŨ (trước deploy `e92ffef` 14:14) chưa có đặt-chỗ. **Backfill reg_keys ĐÃ BỊ LOẠI** vì nó KHOÁ NHẦM
  chính chủ: ownership chỉ theo `reservedKey` (localStorage per-browser, server KHÔNG set được) → backfill xong,
  chủ thật (chưa join, máy không có reservedKey) mở lại trang sẽ bị `apiRegTaken` chặn khỏi lưới (init:99).
  Thay bằng **self-heal** (chủ mở lại ⇒ init:121 `apiRegReserve` tự giữ chỗ, không khoá nhầm) + script DỌN
  TRÙNG `backend/scripts/dedup-signups.js` (mặc định **dry-run**; `--apply` mới xoá; giữ dòng đã-join hoặc
  sớm-nhất mỗi MSNV, KHÔNG đụng reg_keys/dedup_keys). npm: `dedup:signups`. Nhớ: chốt cứng dedup_keys lúc
  JOIN đã đảm bảo 1 MSNV → tối đa 1 đội bất kể data cũ — dòng trùng tiền-join chỉ là cosmetic ở admin.
- Demo/sheet: no-op (`{ok:true}`/`false`) — không có signups trên server nên không có vấn đề dòng-trùng.
→ Rule `reg_keys` (get:true, create hasOnly['at'], **delete:if true** cho typo-recovery) xem [[firestore-schema]].
clearEventData (admin.html) đã thêm `reg_keys` vào danh sách clear.

## apiSubscribe()
Wrap Firestore `onSnapshot` cho team collection. Trả về unsubscribe function (nhưng app không gọi lúc cleanup — SDK tự handle khi disconnect).

## Allowlist (đã có — xem [[allowlist]])
- Cổng "chỉ MSNV trong danh sách mới được join": `apiAllowlistAllowed`/`apiAllowlistInfo` (cổng vào)
  + `apiClaim` đọc `allowlist/{key}` (chốt) → `notAllowed`/`nameMismatch`. `_normName` chuẩn hoá tên
  (bỏ dấu tiếng Việt, gộp trắng, IN HOA) để khớp họ tên. Bổ sung cho cổng chống trùng `apiDedupTaken`.

## Gotchas
- Script loading order: `config.js` và `firebase-config.js` phải load TRƯỚC `api.js` (global scope dependency)
- `BLOCK_DUP` flag trong `firebase-config.js` controls dedup strictness
