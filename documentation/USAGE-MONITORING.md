# Thẻ "Mức dùng Firestore" trong admin — bật 1 lần

Thẻ nằm cuối trang **Tổng quan** của admin (https://pickyourgroup-admin.web.app), hiện số **thật** của cả project `icon-picker`
lấy từ Cloud Monitoring:

- lượt **đọc / ghi / xoá** Firestore hôm nay so với quota miễn phí (50.000 / 20.000 / 20.000 mỗi ngày) + đếm ngược tới giờ reset;
- biểu đồ lượt đọc 7 ngày quota gần nhất + hôm nay (kèm bảng số liệu đọc / ghi / xoá);
- gói **Spark** (miễn phí — 0 ₫) hay **Blaze** (trả theo dùng — ước tính chi phí phần vượt quota).

Ngày quota tính theo giờ Pacific: reset lúc 00:00 giờ Pacific = **15:00 giờ VN** (14:00 khi Mỹ theo giờ mùa hè, khoảng giữa tháng 3 – đầu tháng 11).

## Cách hoạt động

- Bấm **Kết nối Google** → cửa sổ Google hỏi quyền → trang nhận một **token chỉ đọc** (`monitoring.read`, `cloud-billing.readonly`).
  Không đụng đăng nhập admin (Firebase Auth), không ghi gì vào Firestore.
- Token chỉ nằm trong bộ nhớ của tab, tự hết hạn sau khoảng 1 giờ; **Ngắt kết nối Google** thu hồi ngay; tải lại trang = kết nối lại.
- Mở trang admin KHÔNG gọi Google: script Google chỉ tải khi rê chuột / focus / bấm nút Kết nối.
- Client ID không phải bí mật (giống apiKey của Firebase): chỉ chạy trên origin đã khai báo, với tài khoản được phép, và chỉ xem
  được project mà tài khoản đó có quyền.
- Đọc metric qua API tính theo số time series trả về, 1 triệu đầu miễn phí mỗi billing account; mỗi lần làm mới ≈ 6 time series
  + 1 lời gọi billing ⇒ coi như 0. Project đang ở Spark (chưa có billing account) — trường hợp này **chưa thử** trên project thật.

## Bật (Owner của project làm, khoảng 10 phút, 1 lần)

Đăng nhập Google Cloud Console bằng tài khoản Owner của `icon-picker`.

1. **Bật API**
   - Cloud Monitoring API: https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=icon-picker → **Enable**
     (nút là **Manage** nghĩa là đã bật sẵn).
   - Cloud Billing API — để thẻ biết Spark hay Blaze (bỏ qua được, thẻ sẽ ghi "Gói chưa rõ"):
     https://console.cloud.google.com/apis/library/cloudbilling.googleapis.com?project=icon-picker → **Enable**.
2. **Màn hình đồng ý OAuth** (Google Auth Platform): https://console.cloud.google.com/auth/overview?project=icon-picker
   - Chưa cấu hình bao giờ: **Get started** → App name `Pick group admin`, User support email = email của bạn → **Audience**:
     **Internal** nếu có (project thuộc Google Workspace của công ty), không thì **External** → Contact email → đồng ý → **Create**.
   - External: **Audience** → **Test users** → **Add users** → thêm (các) tài khoản Google sẽ xem số liệu. Giữ trạng thái **Testing**
     (không cần gửi Google xác minh; tối đa 100 người).
   - **Data Access** → **Add or remove scopes** → ô *Manually add scopes* dán 2 dòng dưới → **Add to table** → **Update** → **Save**:
     ```
     https://www.googleapis.com/auth/monitoring.read
     https://www.googleapis.com/auth/cloud-billing.readonly
     ```
3. **Tạo OAuth Client ID**: https://console.cloud.google.com/auth/clients?project=icon-picker → **Create client**
   - Application type **Web application** · Name `admin usage`.
   - **Authorized JavaScript origins** → **Add URI** → `https://pickyourgroup-admin.web.app` (không có `/` cuối; thêm
     `https://pickyourgroup-admin.firebaseapp.com` nếu có dùng domain đó). Không cần *Authorized redirect URIs*.
   - **Create** → copy **Client ID** (dạng `123456789-abc….apps.googleusercontent.com`). Không cần Client secret.
4. **Quyền xem** — chỉ khi người xem KHÔNG phải Owner / Editor / Viewer của project:
   https://console.cloud.google.com/iam-admin/iam?project=icon-picker → **Grant access** → email Google của họ → vai trò
   **Monitoring Viewer** (+ **Browser** để thẻ đọc được trạng thái billing).
5. **Dán Client ID** vào [`fe/js/admin/usage-config.js`](../fe/js/admin/usage-config.js) (`oauthClientId: "…"`) — hoặc gửi Client ID
   cho người deploy — rồi deploy site admin: `firebase deploy --only hosting:pickyourgroup-admin`.

## Dùng

Admin → **Tổng quan** → cuối trang, thẻ **Mức dùng Firestore** → **Kết nối Google** → chọn tài khoản → **Continue / Allow**.
App ở trạng thái Testing hiện màn "Google hasn't verified this app" → **Continue** (app của chính bạn).
Nút ↻ trên thẻ (hoặc nút **Tải lại** của trang khi token còn hạn) để lấy số mới; số liệu Cloud Monitoring trễ vài phút.

## Sự cố

| Thấy | Nguyên nhân | Sửa |
|---|---|---|
| Cửa sổ Google báo `Error 400: origin_mismatch` | Origin admin chưa có trong Client ID | Bước 3: thêm đúng `https://pickyourgroup-admin.web.app`, đợi vài phút |
| `Error 403: access_denied` / "has not completed the Google verification process" | Tài khoản chưa là Test user (External) | Bước 2: thêm vào Test users |
| `invalid_client` | Client ID sai hoặc đã xoá | Kiểm lại `usage-config.js` |
| "Cloud Monitoring API chưa bật cho project" | Bước 1 chưa làm | Bấm link "Bật …" trên thẻ, đợi 1–2 phút, **Thử lại** |
| "Tài khoản Google này không có quyền đọc số liệu" | Thiếu IAM | Bước 4 |
| "Gói chưa rõ" | Cloud Billing API chưa bật, bỏ tick quyền billing khi kết nối, hoặc thiếu quyền Browser | Bước 1 (Billing API) / bước 4, kết nối lại và giữ tick |
| "Trình duyệt chặn cửa sổ đăng nhập Google" | Chặn popup | Cho phép popup với `pickyourgroup-admin.web.app` |
| "Google yêu cầu project bật billing mới cho đọc số liệu qua API" | API đòi billing với project Spark (chưa xác minh — một báo cáo trên diễn đàn Google thấy chỉ token service account bị chặn, token người dùng thì không) | Xem số ở Usage and billing; hoặc nâng Blaze (vẫn giữ quota miễn phí mỗi ngày, chỉ tính phần vượt) |
| Lỗi khác khi project chỉ ở gói Spark | Chưa thử thực tế | Gửi lại nguyên văn thông báo trên thẻ |

## Ghi chú số liệu

- Số lấy từ metric `firestore.googleapis.com/document/{read,write,delete}_count` (giống tab Usage của Firebase console) — gần đúng
  số tính phí; trang [Usage and billing](https://console.firebase.google.com/project/icon-picker/usage) là nguồn chính thức.
- Chi phí "ước tính" chỉ có nghĩa khi project ở Blaze: Σ theo ngày (số vượt quota ÷ 100.000 × giá). Giá mặc định là mức **trần** phổ
  biến ($0.06 / $0.18 / $0.02 cho 100.000 đọc / ghi / xoá), **chưa xác minh** cho vùng `asia-southeast1` của project — sửa
  `pricePer100k` trong `usage-config.js` theo https://cloud.google.com/firestore/pricing (chọn Singapore). Chưa gồm lưu trữ, băng thông.
- Spark không bao giờ tính tiền: vượt quota thì Firestore từ chối yêu cầu tới giờ reset (trang sự kiện có thể lỗi) — thẻ cảnh báo khi vượt.

Code: `fe/js/admin/usage-core.js` (logic thuần — test `tests/unit/cases/usage-core.js`), `fe/js/admin/usage-panel.js` (giao diện +
Google Identity Services), `fe/js/admin/usage-config.js`; test giao diện với Google giả: `tests/admin/cases/usage-card.js`.
