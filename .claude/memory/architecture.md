---
title: architecture
tags: [meta]
related: [[index]], [[conventions]], [[firestore-schema]], [[api-layer]]
updated: 2026-06-03
---

# Architecture

## Overview
**Group Match** là app đăng ký sự kiện theo team, dành cho sự kiện nội bộ (~500 người đồng thời). Mỗi icon/emoji đại diện cho 1 đội. Người dùng điền tên + mã nhân viên → chọn đội → join. Đội tự khoá khi đầy (mặc định 10 người). Mỗi người chỉ join được 1 đội. Không cần đăng nhập để tham gia.

## Big pieces
- **Frontend (`fe/`)** — Static HTML/CSS/JS, không build, ship thẳng (path tương đối → chạy được cả root lẫn subpath). Deploy **SONG SONG 2 nơi**: Firebase Hosting (site `pickyoursquad-faraday` → pickyoursquad-faraday.web.app, deploy thủ công) **và** GitHub Pages (https://hm-tam-wf.github.io/group-match-event/, tự động qua Actions). Tất cả logic ở browser-side.
- **Firestore** — Primary database. Realtime push (onSnapshot). Client ghi trực tiếp qua SDK (rules bảo vệ).
- **Firebase Auth** — Chỉ dùng cho admin panel. Người dùng thường không cần auth.
- **Google Apps Script** (`legacy/apps-script/`) — Backend cũ, archived. Không còn dùng.
- **Admin tools** (`backend/scripts/export.js`, `backend/scripts/loadtest.js`) — Node.js scripts chạy local, dùng firebase-admin.

## How they connect
1. Browser load `fe/index.html` → scripts load theo thứ tự cố định (xem [[conventions]])
2. `api.js` auto-detect backend: Firebase (live) → Sheet (legacy) → Demo (localStorage)
3. `app.js` gọi `apiSubscribe()` → Firestore `onSnapshot` push realtime updates về team counts
4. Khi user submit: `apiClaim()` chạy Firestore **transaction** — kiểm tra dedup + capacity + 1-person-1-team đồng thời atomically
5. Nếu transaction fail (tranh chấp), retry tối đa 8 lần với exponential backoff + jitter
6. Admin truy cập `fe/admin.html` → đăng nhập Firebase → xem danh sách signup → export CSV

## Firestore collections (namespaced `events/{EVENT_ID}/`)
```
teams/{icon}         — public: count + member first names (realtime display)
members/{playerId}   — guard 1-person-1-team (write-only từ client, không list được)
dedup_keys/{empId}   — guard duplicate registration (timestamp only, không store value)
signups/{playerId}   — full PII (read-locked: admin UID only)
meta/config          — event config: title, fields, icons, capacity (admin-write, public-read)
```

## Capacity management — critical sync point
`CAPACITY` phải nhất quán ở 2 nơi:
1. `fe/js/config/config.js` — frontend default
2. `backend/firestore.rules` function `cap()` — hoặc đọc từ `meta/config.capacity` (dynamic)

Xem chi tiết: [[firestore-schema]]

## See also
- [[conventions]] — script order, build/deploy commands
- [[api-layer]] — chi tiết 3 backends và retry logic
- [[firestore-schema]] — security rules, collection structure
