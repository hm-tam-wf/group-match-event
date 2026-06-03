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
  name, empId, icon, ts — full PII
  — READ: admin UID only (Firestore rules)
  — WRITE: client (trong transaction)

meta/config
  title, fields, icons, capacity, eventId
  — READ: public
  — WRITE: admin only
```

## Security rules — critical points
1. **Capacity check:** `teams/{icon}.count < cap()` — `cap()` đọc `meta/config.capacity`
2. **Admin UID hardcoded:** `function isAdmin() { return request.auth.uid in ['UID1', 'UID2'] }`
3. **1-person-1-team:** Dùng `getAfter()` trong transaction để verify atomically

## CAPACITY sync — PHẢI nhất quán
`CAPACITY` xuất hiện ở 2 nơi:
| File | Role |
|------|------|
| `docs/js/config.js` | Frontend default hiển thị |
| `firestore.rules` `cap()` | Server-side enforcement |

**Luôn cập nhật cả 2 cùng lúc.** Nếu rules có capacity 10 nhưng config.js hiển thị 15 → UI cho join nhưng rules reject → confusing error.

## EVENT_ID namespacing
Toàn bộ data nằm dưới `events/{EVENT_ID}/`. Thay EVENT_ID trong `config.js` để tạo event mới hoàn toàn isolated (không cần xoá data cũ).
