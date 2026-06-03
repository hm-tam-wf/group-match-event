---
title: conventions
tags: [meta]
related: [[index]], [[architecture]]
updated: 2026-06-03
---

# Conventions

## Commands
- Dev: `npx serve docs` hoặc VS Code Live Server trên `docs/index.html`
- Export signups: `npm run export` (cần `serviceAccountKey.json`)
- Load test: `node loadtest.js` (500 concurrent signups)
- Deploy: `git push` — GitHub Pages tự serve `docs/` (không có build step)

## Code style
- **Language:** Vanilla HTML/CSS/JS — không framework, không module system, không bundler
- **Scope:** Tất cả JS dùng global scope — biến trong một file có thể dùng ở file khác
- **Naming:** camelCase cho JS, kebab-case cho CSS class/id
- **Script loading order là bất biến:** `config → firebase-config → storage → api → ui-utils → ui-render → app`
  — Sai thứ tự = undefined reference errors ngay lập tức
- **CSS variables** cho toàn bộ design tokens (xem [[design-tokens]])
- **Không có linting** — code style maintain thủ công

## Git
- **Branch naming:** `feat/<feature>`, `fix/<bug>`, `chore/<task>`, `refactor/<scope>`
  - Ví dụ: `feat/firestore-config-admin`, `fix/admin-second-uid-recreated`
- **Commit format:** Conventional Commits với message tiếng Việt
  - `feat(scope): mô tả`
  - `fix(scope): mô tả`
  - `refactor: mô tả`
  - `chore: mô tả`

## Do / Don't
- **Do:** Giữ `docs/` là production-ready bất cứ lúc nào (direct serve, không build)
- **Do:** Cập nhật `CAPACITY` đồng thời ở `config.js` VÀ `firestore.rules` (xem [[firestore-schema]])
- **Don't:** Dùng ES modules (`import`/`export`) — browser chạy trực tiếp file này không qua bundler
- **Don't:** Thêm npm dependencies cho frontend — CDN only (Firebase SDK, Google Fonts)
- **Don't:** Commit `serviceAccountKey.json` — gitignored, chứa Firebase admin credentials
