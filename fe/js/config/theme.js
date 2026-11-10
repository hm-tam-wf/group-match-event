// ============================================================================
// theme.js — Giao diện (theme) + biến thể: NGUỒN SỰ THẬT DUY NHẤT cho cả site.
// ----------------------------------------------------------------------------
// Nạp trong <head> (index.html, travel.html) để áp data-theme / data-variant
// TRƯỚC khi trình duyệt vẽ → không nháy giao diện (FOUC). File này độc lập:
// chỉ set thuộc tính trên <html>, không phụ thuộc script khác,
// nên đặt ngoài chuỗi nạp "thiêng" config→firebase→storage→api→ui→app.
//
//   • Đổi giao diện cả site = đổi ĐÚNG chuỗi ACTIVE_THEME bên dưới.
//   • Thêm theme mới: tạo thư mục fe/themes/<tên>/ + <tên>.css (recipe ở assets/themes.css).
//   • Biến thể sự kiện (skin riêng của một dịp, gói trong themes/<tên>/variants/<biến-thể>/):
//     sự kiện chọn bằng DỮ LIỆU — events/{id}/meta/config.profile.variant, js/config/profile.js áp lại
//     sau khi đọc cấu hình. DEFAULT_VARIANT chỉ dùng khi hồ sơ KHÔNG khai variant (sự kiện cũ) và cho
//     trang không phải trang sự kiện (travel.html).
//   • Trang sự kiện (<html data-event-page>): lần vẽ đầu dùng variant của hồ sơ đã lưu ở lần mở trước
//     (localStorage) để màn loading đúng skin ngay; hồ sơ thật đọc xong sẽ áp lại nếu khác.
//   • Xem trước biến thể KHÔNG cần đổi dữ liệu: thêm ?variant=<tên> vào URL (?variant= rỗng = ép tắt) — thắng hồ sơ.
// ============================================================================
let activeTheme = 'tech';
try {
  activeTheme = localStorage.getItem('theme') || 'tech';
} catch (e) {}
const ACTIVE_THEME    = activeTheme;    // 'default' | 'tech'
const DEFAULT_VARIANT = 'tnt';          // biến thể khi hồ sơ sự kiện KHÔNG khai variant (giữ nguyên sự kiện cũ)
const VARIANT_ID_RE   = /^[a-z0-9-]{0,32}$/;
const EVENT_ID_RE     = /^[a-z0-9][a-z0-9-]{0,99}$/;   // ?e=<id> — cùng bộ ký tự với ID sự kiện trong admin
const PROFILE_CACHE_PREFIX = 'linhthu:evprofile:';     // hồ sơ sự kiện lần trước — CHỈ để vẽ đầu đúng skin

// ?variant= trên URL: null = không có; "" = ép tắt biến thể; tên = xem trước biến thể đó.
let VARIANT_PARAM = null;
try {
  const variantParam = new URLSearchParams(location.search).get('variant');
  if (variantParam !== null && VARIANT_ID_RE.test(variantParam)) VARIANT_PARAM = variantParam;
} catch (e) {}

// ?e=<id> trên URL → { given: có tham số, id: id hợp lệ, "" nếu sai định dạng }.
function eventIdFromUrl() {
  try {
    const raw = new URLSearchParams(location.search).get('e');
    if (raw === null) return { given: false, id: '' };
    const id = raw.trim();
    return { given: true, id: EVENT_ID_RE.test(id) ? id : '' };
  } catch (e) {
    return { given: false, id: '' };
  }
}
// Khoá cache hồ sơ: theo ?e= nếu có, không thì theo domain (sự kiện mặc định của domain đó).
function profileCacheKey() {
  const u = eventIdFromUrl();
  return PROFILE_CACHE_PREFIX + (u.id || ('@' + location.hostname));
}
function cachedEventProfile() {
  try {
    const s = localStorage.getItem(profileCacheKey());
    const p = s ? JSON.parse(s) : null;
    return (p && typeof p === 'object' && !Array.isArray(p)) ? p : null;
  } catch (e) {
    return null;
  }
}

let ACTIVE_VARIANT = DEFAULT_VARIANT;   // biến thể đang áp — mọi file khác đọc tên này; đổi qua setActiveVariant()
function setActiveVariant(v) {
  ACTIVE_VARIANT = (typeof v === 'string' && VARIANT_ID_RE.test(v)) ? v : '';
  if (ACTIVE_VARIANT) document.documentElement.setAttribute('data-variant', ACTIVE_VARIANT);
  else document.documentElement.removeAttribute('data-variant');
}

document.documentElement.setAttribute('data-theme', ACTIVE_THEME);
(function applyInitialVariant() {
  let v = DEFAULT_VARIANT;
  if (document.documentElement.hasAttribute('data-event-page')) {
    const cached = cachedEventProfile();
    if (cached && Object.prototype.hasOwnProperty.call(cached, 'variant')) v = String(cached.variant || '');
    // Logo riêng của sự kiện (profile.brand) ⇒ biến thể không thay logo bằng logo của nó (CSS :not([data-brand="custom"])).
    if (cached && cached.brand && typeof cached.brand === 'object') document.documentElement.setAttribute('data-brand', 'custom');
  }
  if (VARIANT_PARAM !== null) v = VARIANT_PARAM;
  setActiveVariant(v);
})();
