# Triển khai bản chịu tải lớn (~500 người cùng lúc) bằng Firebase Firestore

App này có 3 chế độ chạy, tự nhận diện trong [docs/js/ui-utils.js](docs/js/ui-utils.js):

| Chế độ | Khi nào | Backend | Chịu tải |
|--------|---------|---------|----------|
| `firebase` | Có `FIREBASE_CONFIG.projectId` | Cloud Firestore | ✅ ~500+ người |
| `sheet` | Có `SCRIPT_URL` (Apps Script) | Google Sheet | ⚠️ chỉ vài chục người |
| `demo` | Không cấu hình gì | localStorage / RAM | Chạy thử 1 máy |

Hướng dẫn này bật chế độ **`firebase`** — frontend vẫn nằm trên **GitHub Pages**, dữ liệu nằm trên **Firestore**. **Không cần Apps Script nữa.**

---

## 1. Tạo dự án Firebase (một lần)

1. Vào https://console.firebase.google.com → **Add project** → đặt tên → tạo xong.
2. Trong dự án: **Build → Firestore Database → Create database**
   - Chọn **Production mode** (ta sẽ dán rules riêng ở bước 3).
   - Chọn location gần VN, ví dụ `asia-southeast1` (Singapore).
3. Lấy cấu hình web: **⚙ Project settings → General → Your apps →** bấm icon `</>` (Web) → đăng ký app → copy object `firebaseConfig`.

## 2. Dán cấu hình vào app

Mở [docs/js/firebase-config.js](docs/js/firebase-config.js), điền `FIREBASE_CONFIG` (apiKey, projectId, …) lấy ở bước 1.
> Các khoá web này **công khai được** (Firestore bảo vệ bằng Security Rules, không phải bằng việc giấu key).

Kiểm tra `CAPACITY` ở [docs/js/config.js](docs/js/config.js) đúng sĩ số mong muốn, và **danh sách `ICONS`** có đủ số đội bạn cần.

## 3. Dán Security Rules

Firebase Console → **Firestore Database → Rules** → xoá hết, dán toàn bộ nội dung [firestore.rules](firestore.rules) → **Publish**.
> ⚠️ Trong file rules có `function cap() { return 10; }` — **số này phải khớp `CAPACITY`** ở [docs/js/config.js](docs/js/config.js). Đổi sĩ số thì sửa cả hai.
> (Comment trong `firestore.rules` vẫn ghi tên file cũ "ClientConfig.html" — nay là `docs/js/config.js`.)

## 4. Đẩy lên GitHub Pages

Thư mục `docs/` đã là sản phẩm cuối (HTML/CSS/JS thật) — **không còn bước build**. Chỉ cần commit & push:

```powershell
git add -A
git commit -m "Deploy Firestore build"
git push
```

GitHub repo → **Settings → Pages → Source:** branch `master`, folder `/docs` → Save. Vài phút sau có URL `https://<user>.github.io/<repo>/`.

## 5. Lấy data người tham gia

Firebase Console → **Firestore Database → collection `signups`**: mỗi doc là 1 người (tên/email/SĐT/đội).
Muốn xuất Excel: dùng **Export** trong console, hoặc một script `firebase-admin` đọc collection `signups`.

---

## Vì sao bản này chịu được ~500 người

- **Ghi (tham gia đội): atomic bằng `runTransaction`** ([docs/js/api.js](docs/js/api.js)) — mili-giây, không phải khóa tuần tự 1–2s như Apps Script. Không ai thành người thứ 11; không trùng email; 1 người 1 đội.
- **Sĩ số ép ở Security Rules** (`count <= cap()`): client gian lận cũng không vượt được.
- **Đọc realtime bằng `onSnapshot`** — server tự đẩy thay đổi, **bỏ hẳn việc poll mỗi 3 giây**. Đây là thứ giết Apps Script ở quy mô lớn. Mỗi đội là 1 doc nhỏ nên 500 client cùng nghe vẫn nhẹ.
- **Bảo mật PII**: tên/email/SĐT chỉ nằm ở `signups` (khoá đọc). Doc đội công khai chỉ có TÊN.

## Mô hình "tăng số suất"

Sức chứa tối đa = **số icon (đội) × CAPACITY**. Muốn nhận ~500 người:
- 50 đội × `CAPACITY=10`, **hoặc** 10 đội × `CAPACITY=50`, v.v.
- Thêm đội = thêm phần tử vào mảng `ICONS` ([docs/js/config.js](docs/js/config.js)); **mỗi `icon` phải là một emoji DUY NHẤT** (nó là khoá định danh đội). Cần nhiều đội thì dùng các emoji khác nhau.

## Chi phí

Sự kiện ~500 người thường nằm gọn trong **free tier** (Spark). Nếu vượt hạn mức đọc (do nhiều listener × nhiều lần đổi), bật **Blaze (pay-as-you-go)**: chi phí thực tế cỡ **vài cent** cho cả buổi.

## Ghi chú bảo mật (đủ cho sự kiện nội bộ; siết thêm nếu cần)

- Rules hiện cho mọi người tạo doc — đủ cho event. Muốn chặt hơn: bật **Firebase Anonymous Auth** rồi thêm điều kiện `request.auth != null`.
- `employee_ids/{key}` cho `get` (transaction cần) nên người biết chính xác 1 MSNV có thể dò "MSNV này đã đăng ký chưa" (không đọc được PII). Cấm liệt kê cả bảng (`list:false`) nên không enumerate được.
- Các file Apps Script ([legacy-apps-script/](legacy-apps-script/): `Config.gs`/`Game.gs`/`Handlers.gs`/`Sheet.gs`/`Index.html`) giờ là **legacy** — chế độ `firebase` không dùng tới. Giữ làm dự phòng, không deploy.
