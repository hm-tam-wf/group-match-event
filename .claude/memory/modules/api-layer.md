---
title: api-layer
tags: [module]
code: [docs/js/api.js, docs/js/config.js, docs/js/firebase-config.js]
related: [[index]], [[architecture]], [[firestore-schema]], [[allowlist]]
updated: 2026-06-04
---

# API Layer

## Overview
`api.js` là data layer duy nhất. Expose các hàm global: `apiState()`, `apiClaim()`, `apiSaveProfile()`, `apiRemoveProfile()`, `apiDedupTaken()`, `apiAllowlistAllowed()`/`apiAllowlistInfo()`, `apiSubscribe()`. Hỗ trợ 3 backends pluggable.

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
**Giới hạn:** nếu 2 người cùng nhập 1 MSNV mà CẢ HAI đều không join thì vẫn còn 2 dòng (chưa ai
"thua" để dọn) — đúng kiểu "lưu mọi người điền form"; admin có cảnh báo trùng để nhận diện.

## apiSubscribe()
Wrap Firestore `onSnapshot` cho team collection. Trả về unsubscribe function (nhưng app không gọi lúc cleanup — SDK tự handle khi disconnect).

## Allowlist (đã có — xem [[allowlist]])
- Cổng "chỉ MSNV trong danh sách mới được join": `apiAllowlistAllowed`/`apiAllowlistInfo` (cổng vào)
  + `apiClaim` đọc `allowlist/{key}` (chốt) → `notAllowed`/`nameMismatch`. `_normName` chuẩn hoá tên
  (bỏ dấu tiếng Việt, gộp trắng, IN HOA) để khớp họ tên. Bổ sung cho cổng chống trùng `apiDedupTaken`.

## Gotchas
- Script loading order: `config.js` và `firebase-config.js` phải load TRƯỚC `api.js` (global scope dependency)
- `BLOCK_DUP` flag trong `firebase-config.js` controls dedup strictness
