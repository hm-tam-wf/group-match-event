# Thẻ "Mức dùng Firestore" trong admin: bật từng bước

> Bản HTML dễ xem hơn (có nút chép, mục lục): [html/USAGE-MONITORING.html](../html/USAGE-MONITORING.html), mở bằng trình duyệt.
> Sửa nội dung thì sửa cả 2 file.

Thẻ nằm cuối trang **Tổng quan** của admin (https://pickyourgroup-admin.web.app), hiện số **thật** của cả project `icon-picker`
lấy từ Cloud Monitoring:

- lượt **đọc / ghi / xoá** Firestore hôm nay so với quota miễn phí (50.000 / 20.000 / 20.000 mỗi ngày) và đếm ngược tới giờ reset;
- biểu đồ lượt đọc 7 ngày quota gần nhất và hôm nay (kèm bảng số liệu đọc / ghi / xoá);
- gói **Spark** (miễn phí, 0 ₫) hay **Blaze** (trả theo mức dùng, ước tính chi phí phần vượt quota).

Ngày quota tính theo giờ Pacific: reset lúc 00:00 giờ Pacific = **15:00 giờ VN** (14:00 khi Mỹ theo giờ mùa hè, khoảng giữa tháng 3
đến đầu tháng 11).

## Cách hoạt động

- Bấm **Kết nối Google** → cửa sổ Google hỏi quyền → trang nhận một **token chỉ đọc** (`monitoring.read`, `cloud-billing.readonly`).
  Không đụng đăng nhập admin (Firebase Auth), không ghi gì vào Firestore.
- Token chỉ nằm trong bộ nhớ của tab, tự hết hạn sau khoảng 1 giờ; **Ngắt kết nối Google** thu hồi ngay; tải lại trang thì kết nối lại.
- Mở trang admin KHÔNG gọi Google: script Google chỉ tải khi rê chuột, focus hoặc bấm nút Kết nối.
- Client ID không phải bí mật (giống apiKey của Firebase): chỉ chạy trên origin đã khai báo, với tài khoản được phép, và chỉ xem
  được project mà tài khoản đó có quyền.
- Đọc metric qua API tính theo số time series trả về, 1 triệu đầu miễn phí mỗi billing account; mỗi lần làm mới khoảng 6 time series
  và 1 lời gọi billing, coi như 0. Đã chạy thật trên `icon-picker` (gói Blaze) ngày 2026-11-11; project gói Spark thì **chưa thử**.

## Bật từng bước (khoảng 10 phút, làm 1 lần)

**Chuẩn bị**

- Đăng nhập Google bằng tài khoản **Owner** của project `icon-picker`. Thường là tài khoản Firebase CLI đang dùng: chạy
  `firebase login:list` để xem. Trang báo không có quyền hoặc không thấy project thì đổi tài khoản (ảnh đại diện góc phải trên).
- Các link dưới đã chọn sẵn project và thêm `hl=en` để giao diện tiếng Anh, khớp tên nút trong hướng dẫn.

### Bước 1: Bật API (2 phút)

1. Mở [Cloud Monitoring API](https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=icon-picker&hl=en) →
   **Enable**. Thấy nút **Manage** nghĩa là đã bật sẵn.
2. Tuỳ chọn: mở [Cloud Billing API](https://console.cloud.google.com/apis/library/cloudbilling.googleapis.com?project=icon-picker&hl=en)
   → **Enable**, để thẻ biết gói Spark hay Blaze. Không cần thì xem [Bỏ qua billing](#bỏ-qua-billing).
3. Trang báo cần billing account thì dừng lại, ghi nguyên văn thông báo.

### Bước 2: Màn hình đồng ý OAuth (3 phút)

1. Mở [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=icon-picker&hl=en) → **Get started**.
   Không thấy nút này nghĩa là đã cấu hình từ trước: nhảy tới mục 5.
2. **App Information**: App name `Pick group admin`, User support email chọn email của bạn → **Next**.
3. **Audience**: chọn **Internal** nếu bấm được (project thuộc Google Workspace của công ty, khỏi thêm Test users); không thì
   **External** → **Next**.
4. **Contact Information**: nhập email của bạn → **Next** → tick **I agree to the Google API Services: User Data Policy** →
   **Continue** → **Create**.
5. Chỉ với External: menu trái **Audience** → mục **Test users** → **+ Add users** → nhập email Google của những người sẽ xem thẻ →
   **Save**. Giữ trạng thái **Testing** (không cần Google xác minh, tối đa 100 người), không bấm **Publish app**.
6. Menu trái **Data Access** → **Add or remove scopes** → kéo xuống ô **Manually add scopes**, dán 2 dòng:

   ```
   https://www.googleapis.com/auth/monitoring.read
   https://www.googleapis.com/auth/cloud-billing.readonly
   ```

   → **Add to table** → **Update** → về trang Data Access bấm **Save**. Có cảnh báo "cần xác minh" thì bỏ qua (app đang Testing).
   Bỏ qua billing thì chỉ dán dòng đầu.

### Bước 3: Tạo OAuth Client ID (2 phút)

1. Mở [Clients](https://console.cloud.google.com/auth/clients?project=icon-picker&hl=en) → **+ Create client**.
2. **Application type**: **Web application**. **Name**: `admin usage`.
3. Mục **Authorized JavaScript origins** → **+ Add URI** → `https://pickyourgroup-admin.web.app` (không có `/` cuối). Có dùng
   domain `https://pickyourgroup-admin.firebaseapp.com` thì thêm dòng thứ hai. Lưu ý: KHÔNG điền vào *Authorized redirect URIs*.
4. Để trống **Authorized redirect URIs**. Có ô **Use this client for an AI-powered agent** thì không tick.
5. **Create** → copy **Client ID** (dạng `123456789-abc….apps.googleusercontent.com`). Không cần Client secret.
6. Kiểm nhanh: dãy số đầu Client ID (trước dấu `-`) phải trùng `messagingSenderId` trong
   [`fe/js/config/firebase-config.js`](../../fe/js/config/firebase-config.js). Khác nghĩa là đã tạo nhầm project.

Google ghi chú: thiết lập client có thể mất **5 phút đến vài giờ** mới có hiệu lực. Lần bật đầu tiên của project này mất khoảng
15 phút; trong lúc chờ, cửa sổ Google báo `Lỗi 401: invalid_client` kèm "no registered origin" (xem [Sự cố](#sự-cố)).

### Bước 4: Quyền xem (chỉ khi cần)

Bỏ qua nếu người xem là Owner, Editor hoặc Viewer của project. Người khác: mở
[IAM](https://console.cloud.google.com/iam-admin/iam?project=icon-picker&hl=en) → **Grant access** → nhập email Google của họ → vai
trò **Monitoring Viewer** (thêm **Browser** để thẻ đọc được trạng thái billing) → **Save**. App External thì thêm họ vào Test users
(bước 2, mục 5).

### Bước 5: Dán Client ID và deploy (người deploy làm)

1. Dán vào [`fe/js/admin/usage-config.js`](../../fe/js/admin/usage-config.js): `oauthClientId: "…"`. Client ID không phải bí mật, commit
   được.
2. Deploy site admin: `firebase deploy --only hosting:pickyourgroup-admin`. Muốn kiểm trước rồi mới lên live:

   ```
   firebase hosting:channel:deploy <tên> --only pickyourgroup-admin --expires 1h
   firebase hosting:clone pickyourgroup-admin:<tên> pickyourgroup-admin:live
   ```

   Preview channel có origin khác nên không bấm Kết nối Google được ở đó; chỉ kiểm trang tải được và thẻ hiện nút Kết nối.

### Bước 6: Thử

1. Mở https://pickyourgroup-admin.web.app → đăng nhập admin như mọi khi → **Tổng quan** → kéo xuống cuối, thẻ **Mức dùng Firestore**
   → **Kết nối Google**.
2. Chọn tài khoản → màn **Google hasn't verified this app** → **Continue** (app của chính bạn, đang Testing; app Internal không có
   màn này) → tick cả 2 quyền → **Continue**.
3. Thẻ hiện số đọc / ghi / xoá và biểu đồ là xong. Nút ↻ trên thẻ (hoặc nút **Tải lại** của trang khi token còn hạn) để lấy số mới;
   số liệu Cloud Monitoring trễ vài phút.

## Bỏ qua billing

Thẻ vẫn chạy đủ phần đọc / ghi / xoá khi bỏ phần billing; chỉ không biết gói Spark hay Blaze: thẻ hiện "Gói chưa rõ" và dòng chi phí
nêu cả 2 khả năng. Chọn 1 trong 3 cách:

| Cách | Làm gì | Thẻ hiện |
|---|---|---|
| Không bật Cloud Billing API | Bỏ bước 1, mục 2 | "Chưa biết gói vì Cloud Billing API chưa bật" kèm link bật |
| Bỏ tick quyền billing khi kết nối | Bước 6, mục 2: chỉ tick quyền Monitoring | "Chưa biết gói vì chưa cấp quyền xem billing khi kết nối" |
| Tắt hẳn | Thêm `checkBilling: false` vào `usage-config.js` rồi deploy | Không xin quyền billing nữa, cửa sổ Google chỉ hỏi 1 quyền |

```js
window.ADMIN_USAGE_CONFIG = {
  oauthClientId: "…",
  checkBilling: false
};
```

Tắt hẳn thì cũng bỏ dòng `cloud-billing.readonly` ở bước 2 (mục 6) và quyền **Browser** ở bước 4.

## Sự cố

| Thấy | Nguyên nhân | Sửa |
|---|---|---|
| Cửa sổ Google: `Error 400: origin_mismatch` | Origin admin chưa có trong Client ID | Bước 3, mục 3: thêm đúng `https://pickyourgroup-admin.web.app`, đợi vài phút |
| `Lỗi 401: invalid_client` kèm **no registered origin** | Client vừa tạo chưa có hiệu lực, hoặc origin chưa được lưu (điền nhầm vào *Authorized redirect URIs*, chưa bấm **Save**) | Mở client, kiểm mục **Authorized JavaScript origins**. Có rồi thì đợi 5 đến 15 phút, tải lại trang admin (F5), thử lại. Kiểm không cần đăng nhập: xem dưới bảng |
| `invalid_client` kèm **The OAuth client was not found** | Client ID sai hoặc client đã bị xoá | So `usage-config.js` với trang Clients |
| `Error 403: access_denied` / "has not completed the Google verification process" | Tài khoản chưa là Test user (External) | Bước 2, mục 5 |
| "Cloud Monitoring API chưa bật cho project" | Bước 1 chưa làm | Bấm link "Bật …" trên thẻ, đợi 1 đến 2 phút, **Thử lại** |
| "Tài khoản Google này không có quyền đọc số liệu" | Thiếu IAM | Bước 4 |
| "Gói chưa rõ" | Billing bị bỏ qua (cố ý, hoặc thiếu Cloud Billing API / quyền Browser) | Muốn biết gói: làm ngược lại mục [Bỏ qua billing](#bỏ-qua-billing), kết nối lại và giữ tick |
| "Trình duyệt chặn cửa sổ đăng nhập Google" | Chặn popup | Cho phép popup với `pickyourgroup-admin.web.app` |
| "Google yêu cầu project bật billing mới cho đọc số liệu qua API" | Project gói Spark (chưa thử thực tế; một báo cáo trên diễn đàn Google thấy chỉ token service account bị chặn) | Xem số ở Usage and billing của Firebase; hoặc nâng Blaze (vẫn giữ quota miễn phí mỗi ngày, chỉ tính phần vượt) |
| Lỗi khác | Chưa gặp | Gửi lại nguyên văn thông báo trên thẻ |

**Kiểm origin đã có hiệu lực chưa, không cần đăng nhập:** mở cửa sổ ẩn danh, dán link dưới (thay `CLIENT_ID` bằng giá trị trong
`usage-config.js`). Thấy trang đăng nhập Google nghĩa là origin đã nhận; thấy trang lỗi "Access blocked" / "register the JavaScript
origin" nghĩa là chưa.

```
https://accounts.google.com/o/oauth2/v2/auth?gsiwebsdk=3&client_id=CLIENT_ID&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fmonitoring.read&redirect_uri=storagerelay%3A%2F%2Fhttps%2Fpickyourgroup-admin.web.app%3Fid%3Dauth1&prompt=&response_type=token&include_granted_scopes=true&hl=en
```

## Ghi chú số liệu

- Số lấy từ metric `firestore.googleapis.com/document/{read,write,delete}_count` (giống tab Usage của Firebase console), gần đúng số
  tính phí; trang [Usage and billing](https://console.firebase.google.com/project/icon-picker/usage) là nguồn chính thức.
- Chi phí "ước tính" chỉ có nghĩa khi project ở Blaze (`icon-picker` đang ở Blaze): cộng theo ngày (số vượt quota ÷ 100.000 × giá).
  Giá mặc định là mức **trần** phổ biến ($0.06 / $0.18 / $0.02 cho 100.000 đọc / ghi / xoá), **chưa xác minh** cho vùng
  `asia-southeast1` của project: sửa `pricePer100k` trong `usage-config.js` theo https://cloud.google.com/firestore/pricing (chọn
  Singapore). Chưa gồm lưu trữ, băng thông.
- Spark không bao giờ tính tiền: vượt quota thì Firestore từ chối yêu cầu tới giờ reset (trang sự kiện có thể lỗi); thẻ cảnh báo khi vượt.

Code: `fe/js/admin/usage-core.js` (logic thuần, test `tests/unit/cases/usage-core.js`), `fe/js/admin/usage-panel.js` (giao diện và
Google Identity Services), `fe/js/admin/usage-config.js`; test giao diện với Google giả: `tests/admin/cases/usage-card.js`.
