---
title: conventions
tags: [meta]
related: [[index]], [[architecture]]
updated: 2026-11-10
---

# Conventions

## Commands
- Dev: `npx serve fe` hoặc VS Code Live Server trên `fe/index.html`
- Export signups: `npm run export` (cần `serviceAccountKey.json`)
- Load test: `node backend/scripts/loadtest.js` (500 concurrent signups)
- Domain → sự kiện mặc định: `node backend/scripts/hosts.js [--set <domain>=<id> | --remove <domain>] [--apply]`
  (mặc định chỉ xem trước; ghi `config/hosts`). Link riêng mỗi sự kiện: `index.html?e=<id>` — xem [[event-profile]].
  ⚠ Lần đầu đưa bước 2 lên Pages: ghi `hm-tam-wf.github.io → event-demo` TRƯỚC khi push (code đã gỡ `EVENT_ID_BY_HOST`).
- **Test: `npm test`** (sau `npm ci`) = 5 suite trong `tests/`: unit (FE thật trong Node vm), rules, scripts (script backend thật),
  admin (Firebase giả qua CDP), e2e (thiết bị Node `a*` + trình duyệt thật `b*`) — tất cả trên Firestore Emulator project
  `demo-icon-picker`, KHÔNG chạm production. Chạy lẻ: `npm run test:unit|test:rules|test:scripts|test:admin|test:e2e`.
  Cần Java 21+ (`JAVA_HOME`), Edge/Chrome (tự dò hoặc `TEST_BROWSER`), firebase-tools đúng bản `package.json → config.firebaseTools`.
  Cổng = `TEST_PORT_BASE` + offset (mặc định 21000 ⇒ 21080…); chạy song song nhiều đợt ⇒ mỗi đợt một base.
  Thêm case = thêm 1 file `tests/<suite>/cases/<tên>.js` (runner tự nhận) — hướng dẫn: [TESTING.md](../../documentation/TESTING.md).
  CI: `.github/workflows/ci.yml` (PR + push master); deploy production theo tag `v*`: `deploy.yml` + [DEPLOY.md](../../documentation/DEPLOY.md).
  2026-11-10: unit 69 · rules 3 · scripts 22 · admin 10 · e2e 62 — PASS hết (gồm case bước 2).
- Deploy (SONG SONG 2 hosting, cùng serve `fe/`, cùng Firestore project `icon-picker`):
  - **Firebase Hosting** (thủ công): `firebase deploy --only hosting` → https://pickyourgroup.web.app (site `pickyourgroup`, không build step). Site cũ `pickyoursquad-faraday.web.app` redirect 301 sang đây.
    **Chỉ chạy trang sự kiện** (user quyết định 2026-11-10): `ignore` bỏ `admin.html` + `assets/admin.css` khỏi deploy, `redirects` đưa `/admin.html`, `/admin` → 302 sang site admin `pickyourgroup-admin` (https://pickyourgroup-admin.web.app, deploy `firebase deploy --only hosting:pickyourgroup-admin`; từ 2026-11-11 là nơi DUY NHẤT chạy admin). Site sự kiện = master a291ea2 từ 2026-11-11. Không phải lớp bảo mật — dữ liệu vẫn do Firestore rules (UID admin) bảo vệ.
    GOTCHA kiểm thử: Hosting emulator (firebase-tools 15.19, nhiều site) KHÔNG áp `redirects` (cả site faraday vốn chạy thật trên prod cũng không) và không áp `ignore` ⇒ không dùng emulator để kiểm redirect; kiểm bằng preview channel (`firebase hosting:channel:deploy <tên> --only pickyourgroup`) hoặc curl prod sau deploy.
  - **GitHub Pages** (tự động, staging/demo): `.github/workflows/pages.yml` chép `fe/` → `_site/` (bỏ `js/admin/`, `assets/admin*.css`; `admin.html` = trang chuyển hướng sang `ADMIN_URL`) + `deploy-pages` mỗi khi push master đụng `fe/` → https://hm-tam-wf.github.io/group-match-event/ (index → `event-demo` qua `config/hosts`). Cần 1 lần bật Settings → Pages → Source = GitHub Actions. Admin KHÔNG chạy trên Pages từ 2026-11-11.

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
  - `NAME_MAX_LEN = 80` (ui-utils.js, `validName`) ↔ `okName` ≤120 trong `backend/firestore.rules` (teams): rules PHẢI ≥ FE (rules
    không đọc được hằng JS) — đổi một bên thì kiểm bên kia. `SUB_RETRY_BASE_MS/MAX_MS` (api.js), `MAX_TIMER_MS` (app.js, trần int32 setTimeout).
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
