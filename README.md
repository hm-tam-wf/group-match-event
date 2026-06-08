# Group Match — Thành lập đội

Web app cho sự kiện: mỗi **icon = 1 đội**, tối đa `CAPACITY` (mặc định **10**) thành viên.
Người chơi điền thông tin → tham gia 1 đội; đội đủ người thì chốt danh sách. Mỗi người chỉ vào **1 đội**.

Frontend là **web tĩnh** (HTML + CSS + JS thường, thư mục `fe/`), deploy **song song** trên
**Firebase Hosting** và **GitHub Pages** (cùng serve `fe/`). Dữ liệu lưu trên **Cloud Firestore**.

## App tự nhận diện 3 chế độ backend

Xác định trong [fe/js/ui/ui-utils.js](fe/js/ui/ui-utils.js) (`const MODE = …`):

| Chế độ | Khi nào | Backend |
|--------|---------|---------|
| `firebase` | Có `FIREBASE_CONFIG.projectId` (xem [fe/js/config/firebase-config.js](fe/js/config/firebase-config.js)) | Cloud Firestore (đang dùng) |
| `sheet` | `SCRIPT_URL` khác rỗng (Apps Script) | Google Sheet (**legacy**, xem [legacy/apps-script/](legacy/apps-script/)) |
| `demo` | Không cấu hình gì | `localStorage` / RAM (chạy thử 1 máy) |

> `SCRIPT_URL` để **rỗng** trong [fe/js/config/config.js](fe/js/config/config.js) (web tĩnh không có Apps Script),
> nên app rơi vào `firebase` nếu đã cấu hình Firebase, ngược lại `demo`.

## Cấu trúc thư mục

```
fe/                       ← 2 hosting cùng serve thư mục này (Firebase public:"fe" + GitHub Pages)
  index.html              ← HTML shell: <link> css + <script src> các file js theo ĐÚNG thứ tự
  admin.html              ← trang quản trị (đứng riêng): đăng nhập Firebase Auth, xem & tải Excel signups
  assets/styles.css       ← giao diện (Soft Cloud Candy)
  js/
    config/config.js      ← FIELDS, DEDUP_FIELD, EVENT_ID, CAPACITY, ICONS, POLL_MS, SCRIPT_URL
    config/firebase-config.js ← FIREBASE_CONFIG, BLOCK_DUP, khởi tạo db (SDK nạp qua CDN ở index.html)
    data/storage.js       ← lưu token định danh + đội đã tham gia (localStorage)
    data/api.js           ← tầng dữ liệu: apiState / apiClaim / apiSubscribe (3 chế độ)
    ui/ui-utils.js        ← MODE, state, tiện ích, validate
    ui/ui-render.js       ← render hồ sơ, lưới đội, banner
    app.js                ← khởi tạo, realtime/poll, xác nhận tham gia

backend/
  firestore.rules         ← Security Rules (DÁN vào Firebase Console). cap()=10 phải khớp CAPACITY
  scripts/export.js · loadtest.js
documentation/
  EXPORT.md               ← công cụ xuất danh sách signups ra CSV (firebase-admin)
  SETUP-FIREBASE.md       ← hướng dẫn dựng Firestore + deploy
legacy/apps-script/       ← backend Apps Script CŨ — KHÔNG còn dùng (giữ làm dự phòng)
```

> Thứ tự nạp script trong `index.html` rất quan trọng: các biến toàn cục (`const`) được khai báo
> ở file trước và dùng ở file sau. Dùng `<script src>` thường (KHÔNG `type=module`) để giữ thứ tự đó.

## Chạy thử cục bộ

Mở qua **server tĩnh** (đừng mở bằng `file://` — Firebase/`fetch` cần `http`):

```powershell
npx serve fe
# hoặc: dùng "Live Server" của VS Code, mở fe/index.html
```

## Deploy (song song 2 hosting)

`fe/` đã là sản phẩm cuối — **không còn bước build**. App dùng **path tương đối** nên chạy được cả ở
root (Firebase) lẫn subpath (Pages). Cả hai cùng nói chuyện với **1 Firestore project `icon-picker`**
→ dữ liệu signup dùng chung.

### Firebase Hosting (thủ công)

Cấu hình ở [firebase.json](firebase.json) (`hosting.public = "fe"`, site `pickyoursquad-faraday`). Lần đầu cần tạo site:

```powershell
firebase login
firebase hosting:sites:create pickyoursquad-faraday   # 1 lần (đã tạo), tạo pickyoursquad-faraday.web.app
firebase deploy --only hosting
```

URL: **https://pickyoursquad-faraday.web.app**

### GitHub Pages (tự động)

[.github/workflows/pages.yml](.github/workflows/pages.yml) upload `fe/` làm artifact rồi `deploy-pages`
mỗi khi push `master` đụng `fe/` (hoặc chạy tay ở tab **Actions**). Không cần `/docs`, không cần secret.

URL: **https://hm-tam-wf.github.io/group-match-event/**

> Bật **1 lần**: repo **Settings → Pages → Source = GitHub Actions**.
> Trang **admin** trên domain Pages cần thêm `hm-tam-wf.github.io` vào **Firebase Auth → Authorized domains**
> (app công khai thì không cần). Firebase project ID vẫn là `icon-picker` — khác với hosting *site* `pickyoursquad-faraday`.

## Xuất danh sách đăng ký

Xem [EXPORT.md](documentation/EXPORT.md): `npm install` rồi `npm run export` (đọc collection `signups` qua `firebase-admin`).

## Thay đổi sĩ số đội (CAPACITY)

Phải sửa **cả 2 nơi** cho khớp: `CAPACITY` trong [fe/js/config/config.js](fe/js/config/config.js) và `function cap()`
trong [backend/firestore.rules](backend/firestore.rules) (rồi Publish lại rules trên Firebase Console).
