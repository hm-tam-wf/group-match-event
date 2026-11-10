# Trang quản trị (admin) — tính năng & vận hành

Trang `fe/admin.html` (một file, JS inline) + `fe/assets/admin.css`. Đăng nhập Firebase Auth (email/mật khẩu).
Quyền admin do `backend/firestore.rules` quyết định (hàm `isAdmin()`), trang admin chỉ là giao diện.

## 1. Tính năng (bước 3A)

| Ở đâu | Làm gì |
|---|---|
| Form sự kiện → tab **Nhận diện** | Soạn `meta/config.profile`: giao diện (biến thể / theme gốc), ngôn ngữ, logo, nút Huỷ / trang home, thời gian màn chào, chữ ghi đè vi/en (+ ô JSON nâng cao). Nút **Lưu & xem trước** mở `index.html?e=<id>` sau khi lưu. |
| Trang **Danh sách cho phép** → **Nạp Nhân sự + Phòng từ file mẫu** | Một file .xlsx: sheet *Nhân sự* → danh sách cho phép, sheet *Phòng* → danh sách đội (tên, số giường, giới tính). Xem trước + lỗi từng dòng. Thay cho `backend/scripts/tnt-import.js`. |
| Thẻ sự kiện → **Nhân bản** | Như `backend/scripts/clone-event.js`: chép mọi key cấu hình + hồ sơ, tuỳ chọn chép danh sách cho phép và trang home; KHÔNG chép đăng ký. |
| Trang **Đăng ký** → nút `⋯` mỗi dòng | Chuyển phòng · Gỡ khỏi phòng · Bỏ chặn (kèm khoá ghi lúc chọn phòng) · Xoá đăng ký. Mỗi thao tác là 1 transaction giữ đồng bộ đội / khoá chống trùng. |
| Thẻ sự kiện → **Mở sự kiện** | Kiểm tra trước: giờ đóng đã qua, danh sách cho phép bật mà rỗng, thiếu ô `name`, ô kiểm tra trùng không tồn tại ⇒ chặn; chưa đặt giờ đóng ⇒ cảnh báo. |
| Trang **Quản trị** | Xem UID của mình, thêm / gỡ quản trị viên theo UID (`admins/{uid}`). |

### Hồ sơ sự kiện (`profile`) — ghi thế nào
- **Tạo sự kiện**: luôn ghi `profile` tường minh (mặc định = giao diện hiện tại; `homeUrl: ""`).
- **Sửa sự kiện**: chỉ ghi `profile` (bằng `update`, thay cả map) khi đã sửa tab Nhận diện; không đụng thì giữ nguyên.
- Lựa chọn "Dùng logo mặc định của giao diện" = **không ghi** `brand` (skin như TNT giữ logo riêng của nó).
- Lựa chọn "Như cũ" ở nút Huỷ = **không ghi** `homeUrl` (hành vi cũ: về trang trước / travel.html).
- Logo / đường dẫn home chỉ nhận đường dẫn trong site hoặc `https://` (chặn `javascript:`, `data:`, `http:`, `//host`, `\`).

### File mẫu Nhân sự + Phòng
- Nút **Tải file mẫu** sinh file theo sự kiện đang chọn: cột đối chiếu = ô kiểm tra trùng (sự kiện theo tên: `NAME`), sheet Phòng điền sẵn các đội hiện có.
- Có sheet *Phòng* ⇒ THAY danh sách đội. Đội đang có người phải giữ đúng emoji (khoá `teams/{icon}`), nếu không admin chặn nạp.
- **Nạp thêm** giữ người cũ; **Xoá cũ & nạp mới** ghi xong danh sách mới rồi mới xoá mã không còn trong file.
- Cột *Phòng* (số thứ tự) + tích **Xếp sẵn** ⇒ xoá toàn bộ đăng ký hiện có rồi xếp sẵn (bắt gõ lại ID sự kiện).

### Thao tác từng người — ghi những gì
| Thao tác | teams | members/{pid} | signups/{pid} | dedup_keys k1 | dedup_keys m~{fold} | reg_keys |
|---|---|---|---|---|---|---|
| Chuyển phòng | bớt ở phòng cũ, nối cuối phòng mới | đổi icon | đổi icon | đổi icon, giữ `at` | đổi icon nếu chỉ còn người này giữ | giữ |
| Gỡ khỏi phòng | bớt tên, count−1 (về 0 ⇒ xoá doc đội) | xoá | bỏ icon (giữ hồ sơ) | xoá | xoá nếu không còn ai cùng gốc không dấu | giữ |
| Bỏ chặn (chỉ người chưa vào phòng) | — | — | giữ | xoá | xoá nếu không còn ai cùng gốc | xoá |
| Xoá đăng ký | bớt tên | xoá | xoá | xoá | xoá nếu không còn ai cùng gốc | xoá (nếu không còn hồ sơ khác cùng mã) |

`k1` chỉ bị giữ lại khi còn **hồ sơ khác cùng mã đang ở phòng** (khoá là của người đó).

## 2. Quản trị viên theo dữ liệu (`admins/{uid}`)
- `isAdmin()` = UID gốc (hardcode trong `isRootAdmin()`) **hoặc** có doc `admins/{uid}`. Client vô danh dừng ở `request.auth != null`, không tốn lượt đọc.
- Chỉ admin đọc / thêm / gỡ; không ai tự thêm chính mình; doc = `{ note?, addedBy, at }`, không sửa tại chỗ.
- UID gốc không gỡ được từ trang admin. Danh sách UID gốc trong `fe/admin.html` (`ROOT_ADMIN_UIDS`) **chỉ để hiển thị** — đổi UID gốc thì sửa cả hai nơi.
- Thêm người: họ có tài khoản Auth (Firebase Console → Authentication → Add user) → đăng nhập trang admin → trang **Quản trị** hiện UID → gửi UID cho một admin → admin thêm.

## 3. Rules — PHẢI deploy để các tính năng trên chạy
`backend/firestore.rules` đổi ở bước 3A: `admins/{uid}` + `isAdmin()` mới; admin được `update` `members` và `dedup_keys`
(chuyển phòng); client join được đội đang rỗng `{count:0, names:[]}`.

```
firebase deploy --only firestore:rules --project icon-picker
```

## 4. Tách domain admin — site Hosting riêng `pickyourgroup-admin`
`firebase.json` đã khai site `pickyourgroup-admin`: thư mục `hosting-admin/` do `backend/scripts/build-admin-site.js` dựng
(predeploy) — chỉ chép `admin.html` + đúng các file nó tham chiếu; `/` → `admin.html`; header `X-Robots-Tag: noindex`, `Cache-Control: no-cache`.
Site `pickyourgroup` (trang sự kiện) chuyển `/admin`, `/admin.html` sang site mới (302).

Làm theo ĐÚNG thứ tự (deploy site sự kiện trước bước 3 sẽ làm link admin cũ trỏ vào site chưa có):

1. Tạo site (1 lần):
   ```
   firebase hosting:sites:create pickyourgroup-admin --project icon-picker
   ```
2. Deploy rules (mục 3) nếu chưa.
3. Deploy riêng site admin (predeploy tự dựng `hosting-admin/`):
   ```
   firebase deploy --only hosting:pickyourgroup-admin --project icon-picker
   ```
4. Mở https://pickyourgroup-admin.web.app/ — đăng nhập, xem danh sách sự kiện, tab Đăng ký.
   - Báo `auth/unauthorized-domain` (hoặc muốn chắc): Firebase Console → Authentication → Settings → **Authorized domains** →
     thêm `pickyourgroup-admin.web.app` (và `pickyourgroup-admin.firebaseapp.com`).
   - Nếu API key web có giới hạn HTTP referrer (Google Cloud Console → APIs & Services → Credentials): thêm 2 domain trên.
5. Sau khi bước 4 ổn mới deploy site sự kiện (đổi redirect `/admin`):
   ```
   firebase deploy --only hosting:pickyourgroup --project icon-picker
   ```
6. Chạy ổn vài ngày ⇒ gỡ admin khỏi GitHub Pages: sửa `.github/workflows/pages.yml` để không đăng `admin.html` / `assets/admin.css`
   (hoặc thay bằng trang chuyển hướng sang https://pickyourgroup-admin.web.app/). Người từng vào `/admin` của site cũ có thể còn nhớ
   redirect 301 cũ sang Pages ⇒ báo mọi người lưu link mới.

Chạy thử bản dựng ở máy: `node backend/scripts/build-admin-site.js` (ra `hosting-admin/`, đã tự git-ignore).
Quay lại như cũ: trả 2 redirect của site `pickyourgroup` về link GitHub Pages rồi deploy site đó.
