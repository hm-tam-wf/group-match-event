---
title: event-profile
tags: [module, config, reuse]
code: [fe/js/config/profile.js, fe/js/config/theme.js, fe/js/config/config.js, fe/js/app.js, fe/js/ui/ui-utils.js, fe/js/ui/ui-render.js, fe/themes/tech/variants/tnt/strings.js, fe/themes/tech/variants/tnt/tnt.css, fe/index.html, backend/scripts/hosts.js, documentation/EVENT-PROFILE.md]
related: [[theme-system]], [[i18n-system]], [[ui-pipeline]], [[firestore-schema]], [[admin-panel]], [[conventions]]
updated: 2026-11-10
---

# Hồ sơ sự kiện + link riêng (bước 2 lộ trình "dùng lại cho nhiều sự kiện")

Tài liệu đầy đủ cho người vận hành: [EVENT-PROFILE.md](../../documentation/EVENT-PROFILE.md). Note này giữ phần dev cần nhớ.

## Chọn sự kiện (`boot()` app.js)
`?e=<id>` (regex `EVENT_ID_RE` ở theme.js, = bộ ký tự ID admin, ≤100) > `config/hosts.byHost[location.hostname]` >
`config/active.eventId`. `hosts` + `active` đọc SONG SONG (Promise.all) khi không có `?e=`. `?e=` sai định dạng / sự kiện
không tồn tại / map trỏ ID hỏng ⇒ màn noEvent — CỐ Ý không rơi về sự kiện đang mở (staging không ghi nhầm sự kiện thật).
`EVENT_ID_BY_HOST` + `hostEventId` (code) ĐÃ GỠ ⇒ map domain là DỮ LIỆU, sửa bằng `backend/scripts/hosts.js`
(dry-run mặc định, `--apply` mới ghi, in PRODUCTION/EMULATOR, kiểm sự kiện đích tồn tại, transaction).
**Rollout:** ghi `config/hosts` (`hm-tam-wf.github.io → event-demo`) TRƯỚC khi push code này lên Pages.

## `meta/config.profile` — key THIẾU = hành vi cũ
`variant` (id trong `AVAILABLE_VARIANTS`; `""` theme gốc; thiếu = `DEFAULT_VARIANT` 'tnt'), `lang` (thiếu = `defaultLang`
của variant rồi `DEFAULT_LANG` en), `brand {name,logoUrl,logoAlt}` (thiếu = `DEFAULT_BRAND` FARADAY; khai ⇒
`<html data-brand="custom">` ⇒ tnt.css `:not([data-brand="custom"])` thôi vẽ logo TNT, cả ở loader), `homeUrl` (thiếu =
`HOME_URL=null` hành vi cũ travel; `""` = không home ⇒ `hasHome()` false: ẩn `#dupCancel`/`#allowCancel`, `pmCancel` chỉ đóng
popup), `introMs` (ghi đè CSS var `--boot-hold-ms` inline trên `<html>`, kẹp 1000..15000), `copy {vi,en}` (đường dẫn chấm
trong STRINGS[lang]; chỉ key tồn tại; key HÀM ⇒ bọc hàm, `{0}`,`{1}` theo vị trí). URL: `?variant=` / `?lang=` thắng hồ sơ.

## Cơ chế chữ (đổi so với trước 2026-11-10)
- `STRINGS` gốc KHÔNG BAO GIỜ bị sửa sau khi nạp. Biến thể chỉ `registerVariantCopy(id, {vi:{ns:{…}}})` (config.js:
  `VARIANT_COPY`). `buildText(lang, variant, copy)` (profile.js) = bản sao nông STRINGS[lang] + chữ biến thể + profile.copy
  (tách nhánh dọc đường dẫn) ⇒ `applyEventProfile` gọi lại bao nhiêu lần cũng đúng (cache cũ → hồ sơ thật).
- `LANG` khởi tạo = `LANG_PARAM || DEFAULT_LANG` (config.js); profile.js đặt lại LANG + TEXT.

## Không nháy (first paint)
`<html data-event-page>` (chỉ index.html) ⇒ theme.js đọc `localStorage['linhthu:evprofile:' + (eventId của ?e= | '@'+hostname)]`
để đặt data-variant/data-brand trong `<head>`; profile.js (cuối body) `applyEventProfile(cachedEventProfile())` ngay lúc nạp;
`boot()` đọc meta/config ⇒ `applyEventProfile(cfg.profile)` + `cacheEventProfile` + `applyBootTexts()` (loader text, tab
title/H1 mặc định, `renderBrandSlot()`) TRƯỚC khi hiện nội dung. travel.html (không data-event-page) bỏ qua cache ⇒ luôn tnt.
Logo: `brandLogoHtml()` (ui-utils.js) dùng chung header (`#brandSlot` display:contents), popup định danh, đếm ngược, kết thúc.

## Global mới (tránh khai trùng khi viết trang khác nạp theme.js/config.js)
theme.js: `VARIANT_ID_RE, EVENT_ID_RE, PROFILE_CACHE_PREFIX, VARIANT_PARAM, eventIdFromUrl(), profileCacheKey(),
cachedEventProfile(), setActiveVariant()`, `ACTIVE_VARIANT` là `let`. config.js: `AVAILABLE_VARIANTS, VARIANT_COPY,
registerVariantCopy(), DEFAULT_BRAND, LEGACY_HOME_URL, NEW_EVENT_PROFILE (hồ sơ admin ghi khi tạo sự kiện mới), DEFAULT_LANG, LANG_PARAM`. profile.js: `BRAND, HOME_URL,
applyEventProfile(), cacheEventProfile(), buildText(), safeProfileUrl(), variantMeta()`. ui-render.js: `hasHome()`.

## Kiểm thử (2026-11-10, scratchpad — chuyển vào tests/ khi tích hợp bước 4)
unit-step2.js 43 case (vm, file thật, mỗi file `runInContext` riêng trong CÙNG context — const/let top-level vẫn chia sẻ);
layer P 8 case (Edge + emulator): ?e=, config/hosts (map/hỏng/không), hồ sơ đầy đủ, nút rời trang theo homeUrl, cache vẽ đầu,
homeUrl tường minh, sự kiện không hồ sơ y như cũ. Case cũ unit-step1 "TNT (vi) vẫn có toast.liveLost" lỗi thời (stub
ACTIVE_VARIANT + không nạp profile.js) — thay bằng case tương đương trong unit-step2.
