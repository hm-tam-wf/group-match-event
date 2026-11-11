# Deploy production theo tag (Firebase Hosting + Firestore rules)

`.github/workflows/deploy.yml`: push tag `v*` (vd `v1.4.0`) trỏ vào commit **thuộc `master`** ⇒ chạy lại toàn bộ test
(`ci.yml`) trên đúng commit đó ⇒ `firebase deploy --only hosting,firestore:rules --project icon-picker --non-interactive`.

| Có deploy | Không deploy |
|---|---|
| Cả 3 site trong `firebase.json`: `pickyourgroup` (trang sự kiện, `fe/`), `pickyourgroup-admin` (admin, predeploy dựng `hosting-admin/`), `pickyoursquad-faraday` (redirect 301) | GitHub Pages (staging/demo, không còn admin) — vẫn do `pages.yml` tự deploy khi push `master` |
| `backend/firestore.rules` | Dữ liệu Firestore, indexes, mọi script backend |

- Mỗi lúc 1 lần deploy (`concurrency: deploy-production`); tag đến sau xếp hàng, không huỷ lần đang chạy.
- Tag trỏ vào commit không nằm trên `master` ⇒ job `deploy` dừng với lỗi "Tag không thuộc master".
- Thiếu secret ⇒ job `deploy` dừng với lỗi "Thiếu secret FIREBASE_SERVICE_ACCOUNT" (job `test` vẫn chạy).
- Release message của Hosting = `<tag> (<7 ký tự sha>)` ⇒ dễ tìm bản để rollback trong Console.
- Lệnh tay cũ vẫn dùng được khi cần: `npm run deploy` (hosting), `npm run deploy:rules`.

## 1. Tạo service account quyền tối thiểu (làm 1 lần)

Vai trò cần cho `firebase deploy --only hosting,firestore:rules`:

| Vai trò | Để làm gì |
|---|---|
| `roles/firebasehosting.admin` (Firebase Hosting Admin) | tạo version + release cho các site Hosting |
| `roles/firebaserules.admin` (Firebase Rules Admin) | tạo ruleset + cập nhật release `cloud.firestore` |
| `roles/serviceusage.serviceUsageConsumer` (Service Usage Consumer) | CLI kiểm tra API đã bật trước khi deploy |

> ⚠️ Bộ vai trò trên là **đề xuất, CHƯA kiểm trên project thật** (đoán theo các API mà CLI gọi). Nếu lần deploy đầu báo
> `403 … does not have permission …`, thông báo lỗi nêu đúng permission còn thiếu ⇒ thêm vai trò HẸP nhất chứa permission đó.
> Tránh `roles/editor` / `roles/owner` / `roles/firebase.admin` (quá rộng: đọc/ghi được cả dữ liệu Firestore).

Cách 1 — Cloud Shell / gcloud:

```bash
PROJECT=icon-picker
SA=github-deploy
gcloud iam service-accounts create "$SA" --project "$PROJECT" --display-name "GitHub Actions: deploy hosting + rules"
for ROLE in roles/firebasehosting.admin roles/firebaserules.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA@$PROJECT.iam.gserviceaccount.com" --role "$ROLE"
done
gcloud iam service-accounts keys create key.json --iam-account "$SA@$PROJECT.iam.gserviceaccount.com"
```

Cách 2 — Console: Google Cloud Console → project `icon-picker` → IAM & Admin → Service Accounts → Create service account
(`github-deploy`) → cấp 3 vai trò trên → mở service account → Keys → Add key → JSON.

Key JSON = mật khẩu: không commit (`.gitignore` đã chặn `*firebase-adminsdk*.json`, `serviceAccountKey*.json`), không gửi qua chat;
dán vào secret xong thì **xoá file local**. Tổ chức chặn tạo key (`iam.disableServiceAccountKeyCreation`) ⇒ dùng
Workload Identity Federation (mục 5).

## 2. Thêm secret vào GitHub (làm 1 lần)

1. Repo → Settings → Environments → New environment → tên **`production`** (workflow đã khai `environment: production`).
2. (Khuyến nghị) Deployment branches and tags → Selected branches and tags → Add rule → **Tag** `v*`.
   (Tuỳ chọn) Required reviewers ⇒ mỗi lần deploy phải có người bấm duyệt.
3. Environment secrets → Add secret: tên **`FIREBASE_SERVICE_ACCOUNT`**, giá trị = TOÀN BỘ nội dung `key.json`.
   (Đặt ở Settings → Secrets and variables → Actions cũng chạy, nhưng secret của environment chỉ lộ cho job deploy.)

## 3. Quy trình release

1. Merge PR vào `master` khi CI (`test`) xanh.
2. Tag đúng commit trên `master` (SemVer `vMAJOR.MINOR.PATCH`):

   ```bash
   git checkout master && git pull
   git tag -a v1.4.0 -m "Mô tả ngắn thay đổi"
   git push origin v1.4.0
   ```
3. Actions → **Deploy production** → run của tag: `test` (toàn bộ suite; ước lượng 5–10 phút trên runner, chưa đo) → `deploy`
   (chờ duyệt nếu bật reviewers).
4. Kiểm tra sau deploy: mở https://pickyourgroup.web.app (trang sự kiện chạy, không lỗi console);
   Firebase Console → Hosting → release mới mang tên tag; Firestore → Rules → thời điểm publish mới.
5. Tag sai (chưa deploy xong / muốn huỷ): huỷ run trên tab Actions rồi xoá tag `git tag -d v1.4.0 && git push origin :refs/tags/v1.4.0`.

## 4. Rollback

- **Hosting** (nhanh nhất): Firebase Console → Hosting → site `pickyourgroup` → Release history → bản trước → ⋮ → Rollback.
  Site redirect `pickyoursquad-faraday` hiếm khi đổi; rollback tương tự nếu cần.
- **Rules**: Firebase Console → Firestore → Rules → khung lịch sử phiên bản → mở bản trước → khôi phục / chép vào editor → Publish
  (tên nút có thể khác theo giao diện Console).
  Hoặc từ máy đã `firebase login`: `git checkout <tag-cũ> -- backend/firestore.rules && npm run deploy:rules`
  (xong nhớ `git checkout HEAD -- backend/firestore.rules`).
- **Cả hai về đúng một release cũ**: Actions → run của tag cũ → Re-run all jobs (chạy lại test + deploy commit cũ; workflow của
  commit cũ phải đã có `deploy.yml`).
- Lưu ý: hosting và rules deploy chung một lệnh nhưng **không nguyên tử** — lỗi giữa chừng có thể để một phần đã lên. Đọc log job,
  sửa rồi deploy lại (tag mới) hoặc rollback phần đã lên. Rules mới đi kèm FE mới (đổi dữ liệu ghi) ⇒ rollback CẢ HAI, không chỉ một.

## 5. Đề xuất chưa làm (cần quyết định)

- **`pages.yml` chỉ deploy khi test xanh**: thêm job `test: uses: ./.github/workflows/ci.yml` và `needs: test` cho job `deploy`
  (hiện push `master` deploy Pages ngay, song song với CI). Hoặc gom Pages vào release theo tag để 2 hosting luôn cùng phiên bản
  (admin khi đó cũng chỉ lên khi tag).
- **Branch protection / ruleset cho `master`**: bắt buộc check `test` trước khi merge; cấm push thẳng.
- **Tag ruleset**: chỉ maintainer được tạo tag `v*` (vì tag = deploy production).
- **Keyless (Workload Identity Federation)** thay JSON key: `google-github-actions/auth` dùng `workload_identity_provider` +
  `service_account`, thêm `permissions: id-token: write` cho job deploy — không còn key dài hạn để lộ.
