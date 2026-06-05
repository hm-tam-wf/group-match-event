# Legacy — Google Apps Script (KHÔNG còn dùng)

Đây là backend **cũ** của app, viết cho **Google Apps Script + Google Sheet**. App hiện chạy ở
chế độ **`firebase`** (Cloud Firestore) và deploy bằng web tĩnh trên Firebase Hosting, nên **toàn bộ
thư mục này không còn được dùng tới**. Giữ lại làm **dự phòng/tham khảo** — KHÔNG deploy.

| File | Vai trò cũ |
|------|-----------|
| `Index.html` | Template HtmlService (có `include()` và `<?= ScriptApp.getService().getUrl() ?>`) — chỉ chạy trên Apps Script |
| `Config.gs` | Hằng số backend (CAPACITY, FIELD_KEYS, BLOCK_DUP_EMAIL, …) |
| `Game.gs` | `getState()` / `claim()` — đọc/ghi Google Sheet |
| `Handlers.gs` | `doGet` / `doPost`, định tuyến action, LockService |
| `Sheet.gs` | Tạo/lấy sheet đích |
| `appsscript.json` | Manifest dự án Apps Script |
| `.clasp.json` | Cấu hình `clasp` (gitignored). `rootDir` cũ là gốc repo — đã không còn khớp sau khi dời file vào đây |

Nếu muốn hồi sinh chế độ `sheet`: đưa các file `.gs` + `Index.html` về gốc repo, chỉnh
`.clasp.json` (`rootDir`) cho khớp, `clasp push`, rồi điền `SCRIPT_URL` (URL web app) vào
[../fe/js/config/config.js](../fe/js/config/config.js) — khi đó `MODE` sẽ tự chuyển sang `sheet`
(nếu không bật Firebase).
