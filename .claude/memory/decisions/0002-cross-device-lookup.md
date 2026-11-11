---
title: 0002-cross-device-lookup
tags: [adr]
related: [[index]], [[api-layer]], [[firestore-schema]], [[admin-panel]], [[0001-gender-rooms-from-allowlist]]
updated: 2026-11-10
---

# ADR 0002 — Tra cứu đăng ký xuyên thiết bị: `dedup_keys` mang `icon`, remote view

**Status:** accepted (phase A). Phase B (siết rules) còn mở.
**Date:** 2026-11-10

## Context
Quy tắc nghiệp vụ: mỗi người chỉ chọn phòng **đúng 1 lần, trên mọi thiết bị**.
Trước đó `members/{pid}` là khoá theo từng trình duyệt (`pid` ở localStorage), nên người đã đăng ký trên PC
mà nhập tên trên điện thoại (hoặc xoá localStorage) lại thấy lưới chọn phòng và có thể chọn thêm. Chốt liên
thiết bị duy nhất là `dedup_keys` nhưng nó chỉ là `{at}`, không biết người đó ở phòng nào để hiển thị.

## Decision
- **`dedup_keys/{key}` = `{at}` hoặc `{at, icon}`.** Vừa là chốt chống trùng, vừa là bảng tra công khai KHÔNG có PII
  và KHÔNG có pid. Định nghĩa (`api.js` `_dedupPlan`):
  - `k1 = _dedupKey` (NFC + trim + UPPER + bỏ khoảng trắng, **giữ dấu**). Không đổi (allowlist và dữ liệu cũ dùng).
  - `F = _foldKey` (`_normName`: bỏ dấu, đ→d, + bỏ khoảng trắng).
  - `ascii = (k1 === F)` ⇒ tên gõ không dấu.
  - `M = "m~" + F` — doc đánh dấu, **CHỈ tên có dấu mới ghi**. Prefix `m~` (không dùng `~`): tên gõ bắt đầu bằng "~" từng đụng namespace của M; `k1` luôn viết hoa nên không bao giờ chứa chữ thường.
- **Claim:**
  - Tên không dấu: đọc `k1` + `M`; một trong hai có ⇒ DUP; ghi `k1`.
  - Tên có dấu: đọc `k1` + `F` + `M`; `k1` hoặc `F` có ⇒ DUP; ghi `k1`, và ghi `M` chỉ khi `M` chưa có.
  - Hệ quả: "Le Van A" và "Lê Văn A" chỉ chọn được 1 lần, theo cả 2 thứ tự. "Hùng" ≠ "Hưng" ≠ "Lệ Vân A" ≠ "Lê Văn A" (đều đăng ký được).
- **Tra cứu** (`apiLookupRegistration`, FE `rvResolve`/`resolveReg`):
  - Tên có dấu: `k1` có ⇒ remote view. Không có `k1` mà có `F` ⇒ chặn, kèm thông báo "đã có đăng ký tên không dấu '<x>' (phòng X), nếu không phải bạn thì liên hệ BTC".
  - Tên không dấu: `k1` có ⇒ remote view. Không có `k1` mà có `M` ⇒ đếm ứng viên `_foldKey` trong `teams[*].names`: đúng 1 ⇒ remote view; ≥2 ⇒ yêu cầu gõ đủ dấu và chặn; 0 ⇒ chặn.
  - `apiState(fresh)` đọc `get({source:'server'})` để kiểm chứng phòng.
- **Cổng mềm gõ thiếu dấu = HỘP XÁC NHẬN (không tự chặn).** Lý do: không phân biệt được "gõ thiếu dấu" với "tên thật ít dấu hơn". Thanh/Thành, Anh/Ánh, Hoa/Hòa, Thu/Thư: chặn cứng sẽ chặn nhầm người thật.
  - Ứng viên: `api.js` `_markSubset(typed,cand) || _markSubset(cand,typed)` (2 chiều; `_markSubset` = chữ gốc giống hệt, dấu typed ⊆ dấu cand, đ = D + stroke) trên `teams[*].names` lấy từ server; loại tên trùng hệt k1. 2 chiều bắt được cả lần đầu gõ thiếu dấu rồi lần sau gõ đủ dấu.
  - `ui-render.js` `showSoftModal`/`softConfirm` hỏi "Bạn có phải là <Tên> (Phòng X)?". Nhiều ứng viên ⇒ mỗi người 1 nút; luôn có nút "Không, tôi là <tên gõ>".
  - Chọn ứng viên: `me.fields` chuẩn hoá về tên đã đăng ký, vào remote view (không reserve, không claim). `apiRegRelease` xoá `reg_keys` của tên vừa gõ nếu chính máy này giữ.
  - Chọn "Không": lưu `me.softNo[_foldKey] = chữ ký tập ứng viên` rồi đăng ký bình thường. Tập ứng viên đổi thì hỏi lại. Epoch reset xoá `softNo`.
  - Áp dụng ở init gate, popup save, và `softClaimGate` trước `apiClaim`. `freshState` có cache TTL `FRESH_STATE_TTL_MS = 3000`.
  - Không phụ thuộc cờ `DEDUP_STORE_ICON`. Lỗi mạng ⇒ fail-open.
  - Nhánh CỨNG giữ nguyên: tên có dấu trúng F ⇒ chặn kèm thông báo tên không dấu; tên không dấu trúng M mà nhiều người ⇒ ambiguous.
  - Rủi ro còn lại (chốt mềm): bấm nhầm "Không", 2 thiết bị gõ 2 kiểu dấu cùng lúc, lỗi mạng lúc đọc state, gọi API trực tiếp. Sự kiện cần chặt thì bật allowlist (`mini-outing-2026` đang bật `allowlistMode`).
- **Remote view (FE):** state `remoteView`; helper `enterRemoteView`, `rvValid`, `verifiedIcon`, `freshState`.
  Chỉ hiện khi tên có trong `teams[icon].names` và phòng không rỗng — chống icon giả/cũ.
  Init chỉ vào remote view khi `members/{pid}` trả null. Nút **"Không phải tôi"** xoá profile để nhập tên khác.
  Màn hiện: phòng, team, người cùng phòng (lấy từ `teams/{icon}.names`, công khai). Không cho chọn lại.
- **Rules:** KHÔNG đổi. Doc `M` dùng chung rule 3 nhánh của `dedup_keys` create: `isAdmin()`; HOẶC `hasOnly(['at'])` (giữ cho FE cũ, phase B bỏ); HOẶC `hasOnly(['at','icon'])` với `icon` là string và `getAfter(teams/{icon}).count == before + 1` trong cùng transaction.
- **Flag `DEDUP_STORE_ICON`** (`fe/js/config/config.js`, mặc định **false**). Chỉ bật SAU khi deploy rules mới.

## Privacy rationale
- `dedup_keys` là get công khai theo key. Chỉ thêm `icon` (tên phòng, đã công khai qua `teams`) — không có tên,
  MSNV thô, pid hay thời gian chi tiết ngoài `at` sẵn có.
- Tra cứu theo key đã chuẩn hoá: người ngoài phải biết tên/MSNV mới đọc được, tương đương `allowlist/{key}` hiện nay.
- Không trả pid ⇒ không lộ token định danh trình duyệt, không cho chiếm `members/{pid}` của người khác.

## Edge cases (đã audit)
- (a) Xoá localStorage hoặc đổi thiết bị ⇒ remote view.
- (b) Biến thể dấu ⇒ không dấu chặn được có dấu (và ngược lại) nhờ `F`/`M`; tên khác dấu thật sự (Hùng/Hưng) vẫn đăng ký được.
- (c) Race cross-tab / cross-device ⇒ transaction tuần tự hoá, đúng 1 thành công (E2E race Lê ∥ Le x10 ⇒ 1 thắng; Hùng ∥ Hưng x10 ⇒ cả 2 thắng, `M` tạo 1 lần).
- (d) Retry sau commit mơ hồ ⇒ nhận `ALREADY` + `icon`, UI hiện phòng.
- (e) Pre-check fail-open vẫn bị transaction chặn.
- (f) **Rules mở:** ai cũng tạo được dedup_keys rác để chặn một tên; `reg_keys`/`signups` delete vẫn mở ⇒ **hoãn sang phase B**.

## Consequences
- Positive: 1 người = 1 phòng trên mọi thiết bị; người đăng ký xong không thể chọn lại; hiển thị đúng phòng + đồng đội; tên khác người thật sự không bị chặn nhầm.
- Negative / trade-offs:
  - Tên không dấu chỉ tra được khi đủ duy nhất trong `teams[*].names` (≥2 ứng viên ⇒ yêu cầu gõ đủ dấu).
  - Chống tin cậy phía client + rules mở (f) ⇒ kẻ cố ý vẫn chặn được tên người khác đến khi phase B.
  - Dữ liệu cũ chưa có `icon` ⇒ cần backfill trước khi bật flag, nếu không remote view không hiện phòng.

## Go-live order
1. Deploy rules (`firebase deploy --only firestore:rules`).
2. Chạy `backend/scripts/backfill-dedup-icon.js` (dry-run mặc định) rồi `--apply`.
3. Bật `DEDUP_STORE_ICON = true` trong `config.js` + deploy hosting.

Trước bước 2, người gõ không dấu vẫn lọt (chưa có `M`/`icon` cũ).
Dry-run production (mini-outing-2026, 2026-11-10): 14 members, 14 tên có dấu, `M` sẽ tạo = 14, **CONFLICT = 0**.
Backfill quét **toàn bộ `dedup_keys`** (không dựa vào members/signups): thêm `icon` vào `k1` cũ, và với mỗi id có dấu tạo `m~<fold>` bằng `create()`. Dry-run production: `dedup_keys` = 14, M sẽ tạo = 14, CONFLICT = 0. Script có chế độ emulator (`FIRESTORE_EMULATOR_HOST`).

## Testing
- E2E trên **Firestore Emulator** (project `demo-icon-picker`, cần Java; JRE portable chạy được), puppeteer + Edge headless,
  mỗi incognito context là một thiết bị. **71/71 PASS.** Opus review 6 đợt, đợt cuối PASS.
- Static server vá `firebase-config.js`/`config.js` trong bộ nhớ để trỏ emulator, không sửa repo.

## Open work
- **Phase B — ĐÃ LÀM + DEPLOY 2026-11-10 (commit ffe57d7, ruleset 98d47162; nay nằm trong ruleset ad25cca7):** bỏ nhánh `hasOnly(['at'])` + cờ
  `DEDUP_STORE_ICON`; `teams` client chỉ +1/nối 1 tên ⇒ muốn chiếm khoá phải tốn 1 chỗ thật + tên hiện công khai (không còn
  "rác giá rẻ"); `signups/seed_*` chỉ admin. Còn mở: `reg_keys` create/delete (chốt mềm — admin "Bỏ chặn" gỡ được).
- **Script un-join** phải xoá: `members/{pid}`, `signups/{pid}`, `dedup_keys/k1`, `reg_keys`, gỡ tên khỏi `teams`. Doc `M` CHỈ xoá khi không còn người có dấu nào khác cùng `_foldKey` (vì `M` giữ chỗ cho bản không dấu).
  Xem [[admin-panel]] và [[api-layer]].

## Alternatives considered
- **Fold đối xứng (ghi `_foldKey` cho mọi tên) — đã loại.** Gộp cả những tên thật sự khác người: "Nguyễn Văn Hùng" và "Nguyễn Văn Hưng", Anh/Ánh, Lan/Lân. Người đăng ký sau bị chặn hoặc thấy nhầm phòng. Thay bằng so bất đối xứng (`k1` + `M` chỉ cho tên có dấu).
- Lưu tên phòng vào `reg_keys` — bỏ: reg_keys là chốt mềm tiền-join, không phải nguồn tra cứu; trộn vai trò làm khó rules.
- Đọc `signups` để tra phòng — bỏ: signups khoá đọc (chỉ admin, chứa PII).
- Dùng pid/cookie để nhận diện thiết bị — bỏ: không liên thiết bị được, và lộ token.
