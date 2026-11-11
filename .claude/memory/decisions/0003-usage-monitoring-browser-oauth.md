---
title: 0003-usage-monitoring-browser-oauth
tags: [adr, admin]
related: [[index]], [[admin-panel]]
updated: 2026-11-11
---

# ADR 0003 — Số liệu Firestore thật trong admin: OAuth Google ngay trong trình duyệt (GIS token)

**Status:** accepted
**Date:** 2026-11-11

## Context
Admin muốn xem trong trang quản trị số lượt đọc / ghi / xoá thật của cả project và chi phí. Firestore SDK phía client không trả
con số này; nguồn đúng là Cloud Monitoring API (+ Cloud Billing API để biết Spark/Blaze). API Google Cloud không nhận token Firebase
Auth (admin đăng nhập email/mật khẩu). Project ở gói Spark (Cloud Functions cần Blaze). Service account Admin SDK không có quyền
Monitoring.

## Decision
Thẻ "Mức dùng Firestore" xin **token OAuth chỉ đọc** bằng Google Identity Services (token model) ngay trong trình duyệt — scope
`monitoring.read` + `cloud-billing.readonly`, client ID "Web application" khai origin site admin — rồi gọi thẳng REST của Monitoring
/ Billing. Token chỉ trong bộ nhớ tab; không đụng Firebase Auth; không ghi Firestore.

## Consequences
- Positive: không cần Blaze, không server, không lưu khoá; quyền theo IAM của người xem; tắt được bằng cách xoá client ID.
- Negative / trade-offs: Owner phải bật 1 lần trong Google Cloud (consent screen, client ID, API); người xem cần tài khoản Google có
  quyền trên project; kết nối lại mỗi lần tải trang / sau ~1 giờ; app ở Testing ⇒ màn "unverified app" + giới hạn 100 test user.

## Alternatives considered
- Cloud Function (service account) trả số liệu cho admin — cần Blaze + deploy functions.
- Script backend định kỳ ghi số vào Firestore cho admin đọc — cần máy chạy lịch + cấp Monitoring Viewer cho service account; số không tức thời.
- Bật Google provider của Firebase Auth rồi lấy access token từ `signInWithPopup` — bật đăng nhập Google cho cả project và tạo user
  Auth thừa; GIS tách bạch hơn.
- Chỉ đếm lượt đọc của tab admin — dễ nhưng thiếu phần trang sự kiện (nơi tốn nhiều nhất).

## Cập nhật 2026-11-11
Chạy thật thành công trên site admin (Client ID đã cấu hình, `bedf93e`). Thẻ đọc được billing ⇒ project `icon-picker` thực tế đã ở
**Blaze** (bối cảnh "Spark" ở trên là giả định lúc quyết định). Quyết định vẫn giữ: không cần server; nhưng vượt quota giờ bị TÍNH
TIỀN thay vì bị chặn ⇒ con số "Ước tính" có ý nghĩa — giá mặc định vẫn chưa xác minh cho asia-southeast1.
