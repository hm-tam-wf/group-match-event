---
title: api-layer
tags: [module]
code: [docs/js/api.js, docs/js/config.js, docs/js/firebase-config.js]
related: [[index]], [[architecture]], [[firestore-schema]]
updated: 2026-06-03
---

# API Layer

## Overview
`api.js` là data layer duy nhất. Expose 4 functions global: `apiState()`, `apiClaim()`, `apiDedupTaken()`, `apiSubscribe()`. Hỗ trợ 3 backends pluggable.

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

## Retry logic (load-bearing!)
8 retries × exponential backoff (150ms base, max 2.5s) + **random jitter**:
```javascript
Math.random() * back  // NOT fixed delay
```
Jitter là bắt buộc — khi 500 người join cùng đội cùng lúc, jitter phá synchrony, tránh thundering herd. Nếu bỏ jitter → tất cả retry đồng thời → deadlock liên tục.

## apiSubscribe()
Wrap Firestore `onSnapshot` cho team collection. Trả về unsubscribe function (nhưng app không gọi lúc cleanup — SDK tự handle khi disconnect).

## Gotchas
- Script loading order: `config.js` và `firebase-config.js` phải load TRƯỚC `api.js` (global scope dependency)
- `BLOCK_DUP` flag trong `firebase-config.js` controls dedup strictness
