# Triển khai bản chịu tải lớn (~500 người cùng lúc) bằng Firebase Firestore

App này có 3 chế độ chạy, tự nhận diện trong [fe/js/ui/ui-utils.js](fe/js/ui/ui-utils.js):

| Chế độ | Khi nào | Backend | Chịu tải |
|--------|---------|---------|----------|
| `firebase` | Có `FIREBASE_CONFIG.projectId` | Cloud Firestore | ✅ ~500+ người |
| `sheet` | Có `SCRIPT_URL` (Apps Script) | Google Sheet | ⚠️ chỉ vài chục người |
| `demo` | Không cấu hình gì | localStorage / RAM | Chạy thử 1 máy |

Hướng dẫn này bật chế độ **`firebase`** — frontend deploy **song song** trên **Firebase Hosting** (`group-match-event.web.app`) và **GitHub Pages** (`hm-tam-wf.github.io/group-match-event/`, tự động qua Actions), dữ liệu nằm trên **Firestore**. **Không cần Apps Script nữa.**

---

## 1. Tạo dự án Firebase (một lần)

1. Vào https://console.firebase.google.com → **Add project** → đặt tên → tạo xong.
2. Trong dự án: **Build → Firestore Database → Create database**
   - Chọn **Production mode** (ta sẽ dán rules riêng ở bước 3).
   - Chọn location gần VN, ví dụ `asia-southeast1` (Singapore).
3. Lấy cấu hình web: **⚙ Project settings → General → Your apps →** bấm icon `</>` (Web) → đăng ký app → copy object `firebaseConfig`.

## 2. Dán cấu hình vào app

Mở [fe/js/config/firebase-config.js](fe/js/config/firebase-config.js), điền `FIREBASE_CONFIG` (apiKey, projectId, …) lấy ở bước 1.
> Các khoá web này **công khai được** (Firestore bảo vệ bằng Security Rules, không phải bằng việc giấu key).

Kiểm tra `CAPACITY` ở [fe/js/config/config.js](fe/js/config/config.js) đúng sĩ số mong muốn, và **danh sách `ICONS`** có đủ số đội bạn cần.

## 3. Dán Security Rules

Firebase Console → **Firestore Database → Rules** → xoá hết, dán toàn bộ nội dung [backend/firestore.rules](backend/firestore.rules) → **Publish**.
> ⚠️ Trong file rules có `function cap() { return 10; }` — **số này phải khớp `CAPACITY`** ở [fe/js/config/config.js](fe/js/config/config.js). Đổi sĩ số thì sửa cả hai.
> (Comment trong `backend/firestore.rules` vẫn ghi tên file cũ "ClientConfig.html" — nay là `fe/js/config/config.js`.)

## 4. Đẩy lên Firebase Hosting

Thư mục `fe/` đã là sản phẩm cuối (HTML/CSS/JS thật) — **không còn bước build**. Cấu hình ở
[firebase.json](../firebase.json) (`hosting.public = "fe"`, site `group-match-event`). Lần đầu cần tạo site:

```powershell
firebase login
firebase hosting:sites:create group-match-event   # 1 lần — tạo group-match-event.web.app
firebase deploy --only hosting
```

Sau khi deploy có URL `https://group-match-event.web.app`.
> 💡 App còn deploy **song song** trên **GitHub Pages** qua [.github/workflows/pages.yml](../.github/workflows/pages.yml)
> (tự động khi push `master` đụng `fe/`) → `https://hm-tam-wf.github.io/group-match-event/`. Bật 1 lần ở repo
> **Settings → Pages → Source = GitHub Actions**; trang admin trên domain Pages cần thêm `hm-tam-wf.github.io`
> vào **Firebase Auth → Authorized domains**. Hai hosting dùng chung Firestore nên dữ liệu signup là một.

## 5. Lấy data người tham gia

Firebase Console → **Firestore Database → `events/{EVENT_ID}/signups`**: mỗi doc là 1 người (tên/MSNV/đội).
Muốn xuất Excel, chọn **một** trong các cách:
- **Trang admin** `fe/admin.html` — đăng nhập rồi tải `.xlsx` ngay trên trình duyệt (xem mục 6, không cần cài gì).
- Script `firebase-admin` ([EXPORT.md](EXPORT.md)) — xuất CSV ở máy có service-account key.
- **Export** sẵn trong Firebase Console.

## 6. Trang admin (xem & tải Excel) — `fe/admin.html`

Trang đứng riêng cho ban tổ chức xem danh sách `signups` và tải Excel. Bảo mật bằng **Firebase Authentication thật** + **Security Rules** (không phải mật khẩu kiểm tra bằng JavaScript). `signups` vẫn khoá đọc với mọi khách; chỉ tài khoản admin có UID nằm trong rules mới đọc được.

**6.1. Bật đăng nhập & tạo tài khoản admin**

1. Firebase Console → **Build → Authentication → Get started**.
2. Tab **Sign-in method** → bật **Email/Password** → Save.
3. Tab **Users → Add user** → nhập email + mật khẩu cho admin → Add user.
4. Vẫn ở tab **Users**, copy giá trị cột **User UID** của tài khoản vừa tạo (chuỗi dài ~28 ký tự).

**6.2. Cấp quyền đọc cho UID đó**

Mở [backend/firestore.rules](backend/firestore.rules), trong `match /events/{eventId}/signups` thay placeholder bằng UID thật:

```
allow read: if request.auth != null
            && request.auth.uid in ["UID_ADMIN_CỦA_BẠN"];
```

Nhiều admin thì thêm nhiều UID: `["uid1", "uid2", ...]`. Rồi **Publish lại** rules (mục 3).
> Để nguyên `"DÁN_UID_ADMIN"` thì **chưa ai** đọc được `signups` — đây là trạng thái an toàn mặc định.

**6.3. Truy cập & tải Excel**

- Mở `admin.html` cùng gốc với app: `https://group-match-event.web.app/admin.html` (hoặc `npx serve fe` rồi vào `/admin.html` khi chạy thử).
- Đăng nhập bằng email/mật khẩu ở bước 6.1.
- Ô **Sự kiện (EVENT_ID)** mặc định là sự kiện hiện tại; sửa để xem sự kiện cũ rồi bấm **Tải dữ liệu**.
- Bảng hiện đủ Họ tên, MSNV, Đội, Thời gian + tổng số người và số người mỗi đội.
- Bấm **⬇ Tải Excel** → tải file `{EVENT_ID}.xlsx`.
- Đăng nhập sai UID (không có trong rules) sẽ vào được trang nhưng báo *"chưa có quyền xem"* — đúng như thiết kế, PII không lộ.

---

## Vì sao bản này chịu được ~500 người

- **Ghi (tham gia đội): atomic bằng `runTransaction`** ([fe/js/data/api.js](fe/js/data/api.js)) — mili-giây, không phải khóa tuần tự 1–2s như Apps Script. Không ai thành người thứ 11; không trùng email; 1 người 1 đội.
- **Sĩ số ép ở Security Rules** (`count <= cap()`): client gian lận cũng không vượt được.
- **Đọc realtime bằng `onSnapshot`** — server tự đẩy thay đổi, **bỏ hẳn việc poll mỗi 3 giây**. Đây là thứ giết Apps Script ở quy mô lớn. Mỗi đội là 1 doc nhỏ nên 500 client cùng nghe vẫn nhẹ.
- **Bảo mật PII**: tên/email/SĐT chỉ nằm ở `signups` (khoá đọc). Doc đội công khai chỉ có TÊN.

## Mô hình "tăng số suất"

Sức chứa tối đa = **số icon (đội) × CAPACITY**. Muốn nhận ~500 người:
- 50 đội × `CAPACITY=10`, **hoặc** 10 đội × `CAPACITY=50`, v.v.
- Thêm đội = thêm phần tử vào mảng `ICONS` ([fe/js/config/config.js](fe/js/config/config.js)); **mỗi `icon` phải là một emoji DUY NHẤT** (nó là khoá định danh đội). Cần nhiều đội thì dùng các emoji khác nhau.

## Chạy sự kiện mới

Mỗi sự kiện có **không gian dữ liệu riêng** dưới `events/{EVENT_ID}/`. Để mở sự kiện mới:

1. Mở [fe/js/config/config.js](fe/js/config/config.js), đổi `EVENT_ID` sang nhãn mới (chỉ **chữ thường, số, gạch ngang**), vd `"su-kien-2026-q2"`.
2. (Tuỳ chọn) chỉnh `FIELDS` / `ICONS` / `CAPACITY` cho sự kiện đó. Nhớ `CAPACITY` khớp `cap()` trong [backend/firestore.rules](backend/firestore.rules).
3. `firebase deploy --only hosting` (đẩy `fe/` lên Firebase Hosting). **Không cần đổi gì khác trên Firebase** — Security Rules đã bọc sẵn `events/{eventId}/...`.

Dữ liệu sự kiện cũ **vẫn còn nguyên** ở `events/{event_cũ}/signups`, mở lại / xuất qua Console bất cứ lúc nào. Người tham gia mở lại web ở sự kiện mới sẽ thấy form trống (trạng thái cục bộ cũng tách theo `EVENT_ID`), không kẹt "đã có đội" của sự kiện trước.

## Chi phí

Sự kiện ~500 người thường nằm gọn trong **free tier** (Spark). Nếu vượt hạn mức đọc (do nhiều listener × nhiều lần đổi), bật **Blaze (pay-as-you-go)**: chi phí thực tế cỡ **vài cent** cho cả buổi.

## Ghi chú bảo mật (đủ cho sự kiện nội bộ; siết thêm nếu cần)

- Rules hiện cho mọi người tạo doc — đủ cho event. Muốn chặt hơn: bật **Firebase Anonymous Auth** rồi thêm điều kiện `request.auth != null`.
- `dedup_keys/{key}` cho `get` (transaction cần) nên người biết chính xác 1 giá trị chống trùng (vd MSNV) có thể dò "giá trị này đã đăng ký chưa" (không đọc được PII). Cấm liệt kê cả bảng (`list:false`) nên không enumerate được.
- Các file Apps Script ([legacy/apps-script/](legacy/apps-script/): `Config.gs`/`Game.gs`/`Handlers.gs`/`Sheet.gs`/`Index.html`) giờ là **legacy** — chế độ `firebase` không dùng tới. Giữ làm dự phòng, không deploy.
