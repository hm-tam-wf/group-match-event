---
title: conventions
tags: [meta]
related: [[index]], [[architecture]]
updated: 2026-06-03
---

# Conventions

## Commands
- Dev: `npx serve fe` hoặc VS Code Live Server trên `fe/index.html`
- Export signups: `npm run export` (cần `serviceAccountKey.json`)
- Load test: `node backend/scripts/loadtest.js` (500 concurrent signups)
- Deploy (SONG SONG 2 hosting, cùng serve `fe/`, cùng Firestore project `icon-picker`):
  - **Firebase Hosting** (thủ công): `firebase deploy --only hosting` → pickyoursquad-faraday.web.app (site `pickyoursquad-faraday`, không build step).
  - **GitHub Pages** (tự động): `.github/workflows/pages.yml` upload `fe/` làm artifact + `deploy-pages` mỗi khi push master đụng `fe/` → https://hm-tam-wf.github.io/group-match-event/. Cần 1 lần bật Settings → Pages → Source = GitHub Actions. Trang admin trên domain Pages cần thêm `hm-tam-wf.github.io` vào Firebase Auth → Authorized domains.

## Code style
- **Language:** Vanilla HTML/CSS/JS — không framework, không module system, không bundler
- **Scope:** Tất cả JS dùng global scope — biến trong một file có thể dùng ở file khác
- **Naming:** camelCase cho JS, kebab-case cho CSS class/id
- **Script loading order là bất biến:** `config → firebase-config → storage → api → ui-utils → ui-render → app`
  — Sai thứ tự = undefined reference errors ngay lập tức
- **CSS variables** cho toàn bộ design tokens (xem [[design-tokens]])
- **Không có linting** — code style maintain thủ công
- **Chống hardcode (một nguồn sự thật):** KHÔNG nhúng magic value rải rác. Dùng hằng số đặt tên,
  khai báo ĐÚNG MỘT nơi (file nạp trước nơi dùng) rồi tham chiếu lại:
  - `MODE_FIREBASE/SHEET/DEMO` (api.js) — thay literal `"firebase"/"sheet"/"demo"`
  - `COL.*` (api.js) — tên collection Firestore (`teams/members/dedup_keys/signups/reg_keys/allowlist`)
  - `REASON.*` (api.js) — mã lý do apiClaim/apiReg* trả về (`dup/full/already/notAllowed/...`)
  - `SK.*` (storage.js) — khoá localStorage tầng app (`me/claims/reservedKey/allowlistMode/allowlist`)
  - Magic number UI: `AVATAR_PREVIEW_MAX/CONFETTI_COUNT/RESIZE_DEBOUNCE_MS` (ui-render.js), `TOAST_HIDE_MS` (ui-utils.js)
  - **CONTRACT** (giữ VALUE cố định): tên field/collection Firestore, khoá localStorage, prefix `linhthu:`,
    CSS id/class HTML tham chiếu — đổi tên là migration, KHÔNG phải refactor. Chỉ được gom về hằng, không đổi value.
  - `admin.html` có bản copy literal RIÊNG (inline JS, không share global) — sửa đồng bộ thủ công nếu đổi.

## Git
- **Branch naming:** `feat/<feature>`, `fix/<bug>`, `chore/<task>`, `refactor/<scope>`
  - Ví dụ: `feat/firestore-config-admin`, `fix/admin-second-uid-recreated`
- **Commit format:** Conventional Commits với message tiếng Việt
  - `feat(scope): mô tả`
  - `fix(scope): mô tả`
  - `refactor: mô tả`
  - `chore: mô tả`

## Do / Don't
- **Do:** Giữ `fe/` là production-ready bất cứ lúc nào (direct serve, không build)
- **Do:** Cập nhật `CAPACITY` đồng thời ở `config.js` VÀ `firestore.rules` (xem [[firestore-schema]])
- **Don't:** Dùng ES modules (`import`/`export`) — browser chạy trực tiếp file này không qua bundler
- **Don't:** Thêm npm dependencies cho frontend — CDN only (Firebase SDK, Google Fonts)
- **Don't:** Commit `serviceAccountKey.json` — gitignored, chứa Firebase admin credentials
