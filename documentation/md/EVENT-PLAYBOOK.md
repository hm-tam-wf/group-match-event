# Quy trình làm một sự kiện mới

Áp dụng cho mọi sự kiện, có đổi giao diện hay không. Đi từ lúc nhận yêu cầu tới khi dọn dẹp xong. Mỗi bước nói làm gì,
ở đâu; chi tiết kỹ thuật nằm ở các tài liệu cuối trang.

> Bản HTML (mục lục, nút chép lệnh, checklist bấm được): [../html/EVENT-PLAYBOOK.html](../html/EVENT-PLAYBOOK.html).
> Sửa nội dung thì sửa cả 2 file.

## Toàn cảnh

| Bước | Việc | Ai làm |
|---|---|---|
| 0 | Xác định phạm vi: chỉ đổi dữ liệu hay phải sửa code | Người phụ trách cùng người làm code |
| 1 | Tạo sự kiện | Người phụ trách, trên trang admin |
| 2 | Làm phần code (**chỉ khi cần**) | Người làm code; người có quyền Firebase deploy |
| 3 | Giao diện, trang thông tin | Người phụ trách, trên trang admin |
| 4 | Nạp người tham gia, đội | Người phụ trách, trên trang admin |
| 5 | Chạy thử | Người phụ trách |
| 6 | Mở sự kiện, gửi link | Người phụ trách |
| 7 | Theo dõi khi diễn ra | Người phụ trách |
| 8 | Kết thúc, dọn dẹp | Người phụ trách |

Bước 1, 3, 4 làm song song với Bước 2 được. Riêng việc chọn skin mới ở Bước 3 phải đợi code lên production.

## Nguyên tắc

- Một bộ code dùng cho mọi sự kiện; mỗi sự kiện là một bộ dữ liệu riêng, gọi bằng **ID**.
- Làm được trên trang admin thì không sửa code.
- Phải sửa code thì **thêm mới, không sửa đè**: skin mới nằm trong thư mục riêng; tính năng mới là tuỳ chọn, sự kiện
  không bật thì chạy y như cũ.
- Code chỉ đi một đường: nhánh riêng → test → `master` (staging) → production.
- Repo công khai: không commit họ tên thật, file nhân sự, khoá service account.

## Hệ thống gồm gì

| Phần | Dùng để | Cập nhật bằng |
|---|---|---|
| Trang sự kiện | người tham gia đăng ký, xem trang thông tin | deploy site sự kiện |
| Trang admin | người phụ trách cấu hình, theo dõi | deploy site admin |
| Staging | xem trước code mới nhất trên `master` | tự động khi push `master` |
| Firestore | cấu hình, danh sách, đăng ký của mọi sự kiện | trang admin hoặc script; rules deploy riêng |

Địa chỉ hiện tại:

| Phần | Địa chỉ |
|---|---|
| Trang sự kiện | https://pickyourgroup.web.app |
| Trang admin | https://pickyourgroup-admin.web.app |
| Staging | https://hm-tam-wf.github.io/group-match-event/ |

- **Link riêng** `<trang sự kiện>/?e=<id>` luôn mở đúng sự kiện đó, kể cả khi chưa Mở. **Link gốc** (không có `?e=`)
  mở sự kiện đang được Mở.
- Link cũ `<trang sự kiện>/admin` và `admin.html` trên staging tự chuyển sang trang admin.
- Máy local, staging và production đọc ghi **cùng một dữ liệu thật**. Đăng ký thử ở đâu cũng là ghi thật vào sự kiện đó.

## Bước 0: Xác định phạm vi

| Cần gì | Làm ở đâu | Phải deploy |
|---|---|---|
| Tên, mô tả, đội (tên, màu, sĩ số, giới tính), giờ mở và đóng, ô người đăng ký điền, chống trùng, danh sách cho phép | Admin, tab Thiết lập | Không |
| Chọn giao diện có sẵn, ngôn ngữ (vi, en), logo, nút Huỷ / Quay lại, chữ trên trang, thời gian màn chào | Admin, tab Nhận diện | Không |
| Trang thông tin: lịch trình, lưu ý, trang phục, di chuyển, văn bản | Admin, trang Trang thông tin | Không |
| Danh sách người tham gia và đội | Admin, trang Danh sách cho phép | Không |
| Màu, ảnh nền, font, logo vẽ bằng CSS, bố cục khác | Skin mới (Bước 2) | Có |
| Loại mục mới cho trang thông tin | Code (Bước 2) | Có |
| Ngôn ngữ ngoài vi và en, trang mới, tính năng mới, luật đăng ký mới | Code (Bước 2), có thể cả rules | Có |

- Mọi thứ cần đều thuộc nhóm "Không" thì bỏ qua Bước 2.
- Logo, ảnh: dùng link `https://` có sẵn thì không cần deploy; muốn để file ảnh trong repo thì đi qua Bước 2.

## Bước 1: Tạo sự kiện

1. Admin → **Sự kiện** → **Tạo sự kiện**, hoặc **Nhân bản** sự kiện gần giống nhất (chép cấu hình và hồ sơ; tuỳ chọn
   chép danh sách cho phép, trang thông tin; không chép đăng ký).
2. Đặt **ID**: chữ thường, số, gạch ngang. ID nằm trong link riêng, đặt rồi đừng đổi.
3. Tab **Thiết lập**: thông tin chung, đội, thời gian (giờ Việt Nam), chống trùng và danh sách cho phép, ô người đăng ký
   điền. Nên đặt cả **giờ đóng** (lý do ở Bước 8).
   - Mô tả hiển thị được HTML đơn giản (`<b>`, `<ul><li>`).
   - Mỗi đội: emoji (không trùng nhau), tên, màu, sĩ số riêng (trống = dùng sĩ số chung), giới tính nếu chia theo giới.
   - Giờ mở trống = mở ngay; giờ đóng trống = không tự đóng.
   - Ô người đăng ký điền phải có ô key `name`; ô dùng để chống trùng phải nằm trong các ô này.
   - **Danh sách cho phép**: chỉ người có tên trong danh sách mới tham gia được. **Chia theo giới tính**: người tham gia
     chỉ nhập tên, hệ thống tra giới tính trong danh sách và khoá đội khác giới.
4. Lưu. **Chưa bấm Mở.**

Nhân bản chép cả giờ mở và đóng của sự kiện cũ: nhớ sửa lại phần Thời gian.

## Bước 2: Làm phần code (chỉ khi cần)

### 2.1 Tạo nhánh riêng

```bash
git switch master
git pull
git switch -c event/<id>
```

Không sửa thẳng `master`, không làm tiếp trên nhánh của sự kiện cũ.

### 2.2 Skin mới (giao diện khác)

`<theme>` là theme nền đang dùng (hiện là `tech`), `<skin>` là tên skin mới.

1. Tạo thư mục `fe/themes/<theme>/variants/<skin>/`:
   - `<skin>.css`: mọi selector bắt đầu bằng `[data-theme="<theme>"][data-variant="<skin>"]`. Muốn khác hẳn thì đè lại
     token màu, nền, font của theme nền.
   - `strings.js`: gọi `registerVariantCopy("<skin>", { vi: {…}, en: {…} })` để đổi chữ (không sửa `STRINGS` gốc).
   - `img/`: ảnh của skin.
2. Thêm 1 dòng vào `AVAILABLE_VARIANTS` trong `fe/js/config/config.js` (`{ id, label, theme, defaultLang }`). Trang admin
   lấy danh sách skin từ đây.
3. Nạp file của skin:
   - CSS vào `fe/index.html` và `fe/home.html`.
   - `strings.js` vào `fe/index.html` (sau `themes/<theme>/strings.js`, trước `js/config/profile.js`) và `fe/admin.html`.
4. Lưu ý:
   - Logo vẽ bằng CSS: thêm `:not([data-brand="custom"])` để sự kiện khai logo riêng vẫn đổi được.
   - Tiêu đề chữ gradient có dấu chồng (Ố, Ấ, Ề…) dễ mất dấu: thêm `padding-top` cho `h1` trong skin.

### 2.3 Tính năng mới, sửa phần dùng chung

- Thêm thành tuỳ chọn trong cấu hình hoặc hồ sơ sự kiện; **thiếu tuỳ chọn thì giữ hành vi cũ**, để sự kiện khác không đổi.
- Đổi cách ghi dữ liệu: sửa `backend/firestore.rules` và test rules.
- Loại mục mới cho trang thông tin: `fe/js/home/home-schema.js` (`TYPES`), `fe/js/home/home-render.js`, trình soạn trong admin.
- Viết test cho phần mới ([TESTING.md](TESTING.md), mục "Thêm case mới").

### 2.4 Xem trước ở máy

```bash
npx serve fe
```

- Mở `http://localhost:3000/?e=<id>&variant=<skin>&lang=vi`. `?variant=` và `?lang=` chỉ ép tạm để xem, chưa ghi gì
  vào hồ sơ. Trang thông tin: `home.html?e=<id>&variant=<skin>`.
- Kiểm ở bề ngang điện thoại (360 đến 390px) và máy tính: màn chờ, màn chào, form, lưới đội, popup xác nhận, màn đã
  tham gia, đếm ngược.

### 2.5 Test

```bash
npm test
```

Cần Node, Java 21+, Chrome hoặc Edge ([TESTING.md](TESTING.md)). Push nhánh và mở Pull Request: CI chạy lại toàn bộ test.

### 2.6 Đưa vào master (staging)

Merge khi CI xanh. Vài phút sau staging chạy code mới: kiểm `<staging>/?e=<id>&variant=<skin>`.

### 2.7 Deploy production

Người có quyền Firebase của project chạy. Mỗi site: deploy ra preview channel → mở link preview CLI in ra, thêm
`?e=<id>`, chỉ xem (không đăng ký) → clone đúng bản vừa xem lên live. `<tên>` là tên kênh tạm, vd `ev-<id>`.

```bash
# Trang sự kiện
firebase hosting:channel:deploy <tên> --only pickyourgroup --expires 1h --project icon-picker
firebase hosting:clone pickyourgroup:<tên> pickyourgroup:live --project icon-picker

# Trang admin (cần khi có skin mới, vì danh sách skin của admin nằm trong code)
firebase hosting:channel:deploy <tên> --only pickyourgroup-admin --expires 1h --project icon-picker
firebase hosting:clone pickyourgroup-admin:<tên> pickyourgroup-admin:live --project icon-picker

# Rules (chỉ khi có sửa)
npm run deploy:rules
```

- Deploy trang sự kiện trước, trang admin sau.
- Rules và code đi cùng nhau: deploy lúc không có sự kiện đang chạy; rollback thì rollback cả hai.
- Xong sớm hơn giờ mở **ít nhất 1 giờ**: trang sự kiện gửi kèm `Cache-Control: max-age=3600`, trình duyệt có thể giữ
  bản cũ tới 1 giờ (staging: 10 phút).
- Khi đã bật deploy theo tag ([DEPLOY.md](DEPLOY.md)): thay các lệnh trên bằng push tag `vX.Y.Z`.

## Bước 3: Giao diện, trang thông tin

1. **Sự kiện** → **Sửa** → tab **Nhận diện**: giao diện, ngôn ngữ, logo, nút Huỷ / Quay lại, chữ trên trang, thời gian
   màn chào → **Lưu & xem trước**.
2. Có trang thông tin: menu **Trang thông tin** → chọn sự kiện → soạn từng mục, hoặc **Nạp Excel** / JSON → **Lưu** →
   **Xem trang**. Rồi ở tab Nhận diện, chọn nút Huỷ "Về trang home của sự kiện".
3. Sự kiện tạo mới (không nhân bản) mang hồ sơ mặc định trong code: luôn mở tab Nhận diện kiểm lại.

## Bước 4: Nạp người tham gia, đội

Chỉ khi bật danh sách cho phép ở Bước 1.

1. **Danh sách cho phép** → chọn sự kiện → **Tải file mẫu** (sinh theo sự kiện: sheet Phòng điền sẵn các đội đang có,
   kèm sheet Hướng dẫn).
2. Sheet **Nhân sự**, mỗi dòng một người:
   - Cột đối chiếu (theo ô chống trùng; chống trùng theo tên thì là `NAME`): họ tên **có dấu đầy đủ**, đúng như người
     tham gia sẽ gõ (hoa thường, khoảng trắng không quan trọng).
   - `Gender`: `Nam` hoặc `Nữ`; trống = vào được mọi đội.
   - `Phòng`: trống = người đó tự chọn trên web; ghi số thứ tự đội = xếp sẵn (người được xếp sẵn không cần vào web).
3. Sheet **Phòng** (đội, tuỳ chọn): `STT`, `Tên phòng`, `Số giường`, `Giới tính` (Nam, Nữ, trống = chung), `Team`
   (tuỳ chọn, hiện kèm tên đội), `Emoji` (tuỳ chọn). Có sheet này thì **thay toàn bộ** danh sách đội; không muốn đổi đội
   thì xoá sheet. Đội đang có người phải giữ đúng emoji (file mẫu đã điền sẵn), sai thì admin chặn nạp.
4. Chọn file → xem trước (số người theo giới, bảng đội, lỗi từng dòng như trùng tên, sai giới, quá sĩ số) → hết lỗi mới nạp:
   - **Xoá cũ & nạp mới**: lần đầu; ghi xong danh sách mới rồi mới xoá tên cũ không còn trong file.
   - **Nạp thêm**: bổ sung, giữ người cũ.
   - Tích **Xếp sẵn** khi dùng cột Phòng: xoá toàn bộ đăng ký hiện có rồi xếp lại, phải gõ lại ID.
5. Chỉ có danh sách người, không đổi đội: dùng khung **Nhập từ Excel** cùng trang.
6. Lưu file dạng `.xlsx`; dùng CSV thì chọn "CSV UTF-8", nếu không tiếng Việt bị lỗi.
7. File thật để ngoài git (`btc-data/` đã được ignore); repo chỉ giữ file mẫu tên giả.

## Bước 5: Chạy thử

1. Mở link riêng `<trang sự kiện>/?e=<id>` trên điện thoại.
2. Đăng ký thử vài trường hợp: người hợp lệ, người không có trong danh sách, đội đầy, đội bị khoá theo luật của sự kiện.
   Có chia theo giới tính: thử một người Nam và một người Nữ, chỉ đội cùng giới bấm được.
3. Giờ mở ở tương lai thì trang chỉ hiện đếm ngược: tạm để trống giờ mở, thử xong đặt lại.
4. Thử xong: **Sự kiện** → **Xóa dữ liệu** (gõ lại ID). Danh sách cho phép được giữ.

## Bước 6: Mở sự kiện, gửi link

1. **Sự kiện** → **Mở**. Trang admin tự kiểm trước: giờ đóng đã qua, danh sách cho phép trống, thiếu ô `name`, ô kiểm
   trùng không tồn tại, chưa có đội thì chưa cho mở.
2. Chỉ một sự kiện ở trạng thái Mở: Mở sự kiện mới là thay sự kiện cũ trên link gốc.
3. Gửi link gốc (theo sự kiện đang Mở) hoặc link riêng `?e=<id>` (luôn đúng sự kiện này). Trang thông tin:
   `<trang sự kiện>/home.html?e=<id>`.

## Bước 7: Theo dõi khi diễn ra

- **Tổng quan**: sĩ số, đăng ký mới nhất, thẻ Mức dùng Firestore.
- Sửa 1 người trong danh sách: trang **Danh sách cho phép**. Người đã vào đội: trang **Đăng ký** → nút `⋯` (Chuyển
  phòng, Gỡ khỏi phòng, Bỏ chặn, Xoá đăng ký).
- Đổi đội, sĩ số, danh sách khi đang chạy: người tham gia phải tải lại trang mới thấy. Không đổi hay xoá đội đã có người.
- Không deploy code khi sự kiện đang chạy, trừ sửa lỗi gấp (vẫn qua preview channel).

## Bước 8: Kết thúc, dọn dẹp

1. **Sự kiện** → **Kết thúc**: gỡ sự kiện khỏi link gốc. **Link riêng `?e=<id>` vẫn nhận đăng ký tới giờ đóng**: chưa
   đặt giờ đóng thì sửa giờ đóng về hiện tại.
2. Xuất kết quả: **Đăng ký** → chọn sự kiện → **Xuất Excel** (hoặc script, [EXPORT.md](EXPORT.md)).
3. File thật của người phụ trách: giữ ngoài git, xoá khi hết cần.
4. Xoá hẳn sự kiện (tuỳ chọn): **Xóa dữ liệu** → **Xóa sự kiện** (xoá cả danh sách cho phép).
5. Giữ skin, code mới để sự kiện sau chọn lại. Lỗi hay bài học mới: ghi vào tài liệu.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân, cách xử lý |
|---|---|
| Báo "không có trong danh sách" dù có tên | Gõ thiếu dấu hoặc sai chính tả. Phải gõ đúng như trong danh sách (hoa thường, khoảng trắng không quan trọng). |
| Hai người trùng họ tên | Người thứ hai bị chặn. Sửa tên trong danh sách cho khác nhau (vd thêm phòng ban) và báo người đó gõ đúng như vậy. |
| Sửa danh sách, đội, sĩ số giữa chừng mà người tham gia không thấy | Người tham gia phải tải lại trang. Không đổi hay xoá đội đã có người. |
| Bấm Lưu trên admin báo "Missing or insufficient permissions" | Tài khoản đang đăng nhập không phải quản trị viên. Đăng nhập đúng tài khoản, hoặc nhờ người có quyền thêm ở trang Quản trị viên. |
| Admin không cho Mở sự kiện | Đọc danh sách lỗi admin hiện (giờ đóng đã qua, danh sách trống, thiếu ô `name`…), bấm Sửa sự kiện. |
| Vẫn thấy giao diện cũ sau khi deploy | Trình duyệt còn giữ bản cũ: tải lại trang (Ctrl+F5), hoặc đợi tối đa 1 giờ (staging: 10 phút). |
| Trang admin không mang giao diện của sự kiện | Bình thường: trang admin có giao diện riêng. |

## Khi bản mới bị lỗi

- **Trang sự kiện, trang admin**: Firebase Console → Hosting → chọn site → Release history → bản trước → Rollback.
- **Rules**: Firebase Console → Firestore → Rules → lịch sử phiên bản → khôi phục bản trước. Rules đi kèm code thì
  rollback cả hai.
- **Cấu hình sự kiện sai**: sửa lại trên trang admin, không cần deploy.

## Checklist

Trước khi Mở:

- [ ] Đã chốt phạm vi (Bước 0)
- [ ] Code mới (nếu có) đã lên production, sớm hơn giờ mở ít nhất 1 giờ
- [ ] Thiết lập: tên, đội, sĩ số, giờ mở và giờ đóng, chống trùng, ô nhập
- [ ] Nhận diện: giao diện, ngôn ngữ, logo, nút Huỷ, chữ
- [ ] Trang thông tin (nếu có) đã lưu và xem được
- [ ] Danh sách người và đội nạp không lỗi
- [ ] Chạy thử trên điện thoại, xong bấm Xóa dữ liệu
- [ ] Đã Mở, bấm thử đúng link sẽ gửi

Sau sự kiện:

- [ ] Kết thúc, giờ đóng đã qua
- [ ] Xuất Excel
- [ ] Dọn file thật; (tuỳ chọn) xoá sự kiện

## Tài liệu chi tiết

| Tài liệu | Nội dung |
|---|---|
| [EVENT-PROFILE.md](EVENT-PROFILE.md) | Hồ sơ sự kiện, link `?e=`, thêm skin |
| [ADMIN.md](ADMIN.md) | Tính năng admin, file mẫu, thao tác từng người |
| [HOME-TEMPLATE.md](HOME-TEMPLATE.md) | Trang thông tin: cấu trúc, file Excel, script |
| [TESTING.md](TESTING.md) | Chạy test, thêm case |
| [DEPLOY.md](DEPLOY.md) | Deploy theo tag, rollback |
| [EXPORT.md](EXPORT.md) | Xuất danh sách đăng ký |
| [USAGE-MONITORING.md](USAGE-MONITORING.md) | Thẻ Mức dùng Firestore |
