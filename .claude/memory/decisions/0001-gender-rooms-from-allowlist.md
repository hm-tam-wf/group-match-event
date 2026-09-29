---
title: 0001-gender-rooms-from-allowlist
tags: [adr]
related: [[index]], [[allowlist]], [[api-layer]], [[firestore-schema]], [[theme-system]]
updated: 2026-09-29
---

# ADR 0001 — Phân phòng Nam/Nữ: giới tính lấy từ Danh sách cho phép, khoá ở client

**Status:** accepted
**Date:** 2026-09-29

## Context
Sự kiện "Mini Outing · TNT" (PDF BTC "MINI MINI MINI.pdf") chia phòng ngủ theo giới: "Nam riêng, nữ riêng".
PDF vẽ ô "MÃ GIỚI: Nam/Nữ" thay chỗ ô MSNV — nhưng MSNV là khoá chống trùng + allowlist; và hồ sơ bị KHOÁ
ngay sau khi lưu (tính năng "Sửa thông tin" đã tắt) ⇒ ai tự chọn nhầm giới sẽ bị khoá khỏi chính phòng của mình.

## Decision
- Giữ form **Tên + MSNV**. Người chơi **KHÔNG tự chọn giới**: giới tính lấy từ cột **Giới tính** trong file
  xlsx của Danh sách cho phép (user chốt). Dòng thiếu giới ⇒ không khoá phòng nào (fail-open).
- Bật/tắt theo sự kiện: checkbox admin **"Check giới tính"** → `meta/config.allowlistGenderCheck`
  (tính năng CON của allowlist, giống "Đối chiếu họ tên"). Phòng gắn giới ở `icons[].gender` ("" = phòng chung).
- Lưới vẫn hiện đủ phòng; phòng khác giới bị KHOÁ với nhãn "Phòng Nữ"/"Phòng Nam" (user chọn khoá, không ẩn).
- Chốt 2 lớp đều ở client: UI (`gLocked` trong renderState) + `apiClaim` transaction dùng lại `allowSnap` ĐÃ
  đọc (không thêm read) → `REASON.GENDER_MISMATCH`. **Không đổi Firestore rules.**

## Consequences
- Positive: không có lỗi "chọn nhầm giới"; admin sửa file là người chơi reload có giới mới (`myGender` chỉ ở RAM,
  đọc lại mỗi lần tải); tính năng trơ hoàn toàn với sự kiện không bật cờ.
- Negative / trade-offs: cùng mức tin cậy với allowlist/dedup (client-enforced) — client sửa mã nguồn vẫn lách
  được; `allowlist/{key}` get công khai ⇒ ai biết MSNV thì đọc được giới tính (như tên hiện nay);
  `seedTeams` (chia đội sẵn từ file) không kiểm giới — admin tự chịu trách nhiệm.

## Alternatives considered
- Dropdown Nam/Nữ người chơi tự chọn (+ đối chiếu file) — bỏ: user muốn lấy thẳng từ file, khỏi bước chọn.
- Chặn cứng ở rules — bỏ: `members` là `hasOnly(['icon','at'])`, rules không tra được mảng icons, cần thêm
  read mỗi claim; trong khi nguồn giới vốn chỉ tin cậy ngang allowlist.
- Ẩn phòng khác giới — bỏ: user chọn khoá + nhãn để vẫn thấy tổng thể.
