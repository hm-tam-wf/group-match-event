// ============================================================================
// profile.js — HỒ SƠ SỰ KIỆN: events/{id}/meta/config.profile → skin (biến thể), ngôn ngữ, logo, câu chữ,
// trang home, thời gian màn intro. Mỗi sự kiện đổi bằng DỮ LIỆU (admin) thay vì sửa code + deploy.
// ----------------------------------------------------------------------------
// Nạp SAU config.js + themes/<theme>/strings.js + mọi themes/<theme>/variants/<id>/strings.js, TRƯỚC
// firebase-config.js (cần STRINGS / VARIANT_COPY / AVAILABLE_VARIANTS / DEFAULT_*; theme.js ở <head> cung cấp
// setActiveVariant / VARIANT_PARAM / cachedEventProfile / profileCacheKey).
// QUY TẮC VÀNG: key THIẾU = hành vi cũ ⇒ sự kiện chưa có hồ sơ chạy y như trước. Hợp đồng: documentation/EVENT-PROFILE.md
//   • Lúc nạp: áp hồ sơ đã lưu ở lần mở trước (chưa có ⇒ mặc định) ⇒ loader / tiêu đề đúng ngôn ngữ + skin ngay.
//   • boot() (app.js) đọc meta/config xong ⇒ applyEventProfile(cfg.profile) + cacheEventProfile(cfg.profile)
//     TRƯỚC khi vẽ thứ phụ thuộc chữ/logo (nội dung chính còn ẩn sau loader ⇒ không nháy).
// ============================================================================
const PROFILE_LANGS  = ["vi", "en"];
const INTRO_MS_MIN   = 1000;     // giới hạn thời gian giữ màn terminal (ms)
const INTRO_MS_MAX   = 15000;
const BRAND_NAME_MAX = 40;
const BRAND_ALT_MAX  = 80;

let BRAND    = DEFAULT_BRAND;    // khối logo đang dùng — brandLogoHtml() (ui-utils.js) đọc
let HOME_URL = null;             // null = hành vi cũ (LEGACY_HOME_URL); "" = không có trang home; chuỗi = link home

function _ownKey(o, k) {
  return !!o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
}

// Link do admin nhập: chỉ nhận đường dẫn tương đối trong site hoặc https:// — chặn javascript:, data:, //domain-khác.
function safeProfileUrl(u) {
  if (typeof u !== "string") return "";
  const s = u.trim();
  if (!s) return "";
  if (/^https:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//") || s.startsWith("\\")) return "";
  return s;
}

function variantMeta(id) {
  if (!id || !Array.isArray(AVAILABLE_VARIANTS)) return null;
  return AVAILABLE_VARIANTS.find(v => v && v.id === id) || null;
}

// Ghi đè MỘT chuỗi theo đường dẫn chấm ("banner.ok"), TÁCH NHÁNH (copy) dọc đường ⇒ không đụng STRINGS gốc.
// Chỉ key ĐÃ TỒN TẠI. Key gốc là HÀM ⇒ bọc chuỗi thành hàm, {0},{1}… = tham số theo vị trí.
function _overrideText(root, path, value) {
  const parts = String(path).split(".");
  if (parts.some(p => !p)) return false;
  let obj = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!_ownKey(obj, k) || !obj[k] || typeof obj[k] !== "object" || Array.isArray(obj[k])) return false;
    obj[k] = Object.assign({}, obj[k]);
    obj = obj[k];
  }
  const leaf = parts[parts.length - 1];
  if (!_ownKey(obj, leaf)) return false;
  if (typeof obj[leaf] === "function") {
    obj[leaf] = (...args) => value.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m));
    return true;
  }
  if (typeof obj[leaf] === "string") { obj[leaf] = value; return true; }
  return false;
}

// Bảng chữ hiệu lực = bản sao STRINGS[lang] + chữ của biến thể + profile.copy[lang]. STRINGS gốc giữ nguyên
// ⇒ gọi lại với hồ sơ khác (cache cũ → hồ sơ thật) vẫn ra đúng.
function buildText(lang, variantId, copy) {
  const base = STRINGS[lang] || STRINGS.en;
  const out = {};
  Object.keys(base).forEach(ns => {
    const v = base[ns];
    out[ns] = (v && typeof v === "object" && !Array.isArray(v)) ? Object.assign({}, v) : v;
  });
  const vc = variantId && VARIANT_COPY[variantId] && VARIANT_COPY[variantId][lang];
  if (vc && typeof vc === "object") {
    Object.keys(vc).forEach(ns => { out[ns] = Object.assign({}, out[ns] || {}, vc[ns]); });
  }
  const oc = (copy && typeof copy === "object") ? copy[lang] : null;
  if (oc && typeof oc === "object" && !Array.isArray(oc)) {
    Object.keys(oc).forEach(path => {
      if (typeof oc[path] !== "string") return;
      if (!_overrideText(out, path, oc[path])) {
        try { console.warn("[profile] bỏ qua copy key không tồn tại:", lang + "." + path); } catch (e) {}
      }
    });
  }
  return out;
}

// Áp hồ sơ sự kiện. Gọi được nhiều lần (luôn dựng lại từ dữ liệu gốc). Trả về giá trị đã áp (kiểm thử dùng).
function applyEventProfile(profile) {
  const p = (profile && typeof profile === "object" && !Array.isArray(profile)) ? profile : {};
  const root = document.documentElement;

  // 1) Biến thể: ?variant= (xem trước) > profile.variant > DEFAULT_VARIANT. Id không có trong AVAILABLE_VARIANTS ⇒ theme gốc.
  let variant = _ownKey(p, "variant") ? (typeof p.variant === "string" ? p.variant.trim() : "") : DEFAULT_VARIANT;
  if (VARIANT_PARAM !== null) variant = VARIANT_PARAM;
  if (variant && !variantMeta(variant)) variant = "";
  setActiveVariant(variant);

  // 2) Ngôn ngữ: ?lang= > profile.lang > defaultLang của biến thể > DEFAULT_LANG.
  const meta = variantMeta(variant);
  let lang = DEFAULT_LANG;
  if (meta && PROFILE_LANGS.includes(meta.defaultLang)) lang = meta.defaultLang;
  if (PROFILE_LANGS.includes(p.lang)) lang = p.lang;
  if (LANG_PARAM) lang = LANG_PARAM;
  LANG = lang;
  TEXT = buildText(LANG, variant, _ownKey(p, "copy") ? p.copy : null);
  try { root.lang = LANG; } catch (e) {}

  // 3) Logo: khai brand ⇒ dùng đúng brand đó (tên + logo rỗng = ẩn khối logo) và gắn data-brand="custom"
  //    để biến thể thôi thay logo bằng logo của nó (CSS :not([data-brand="custom"])). Thiếu ⇒ DEFAULT_BRAND.
  if (_ownKey(p, "brand") && p.brand && typeof p.brand === "object" && !Array.isArray(p.brand)) {
    BRAND = {
      name:    String(p.brand.name    || "").trim().slice(0, BRAND_NAME_MAX),
      logoUrl: safeProfileUrl(p.brand.logoUrl),
      logoAlt: String(p.brand.logoAlt || "").trim().slice(0, BRAND_ALT_MAX),
    };
    root.setAttribute("data-brand", "custom");
  } else {
    BRAND = DEFAULT_BRAND;
    root.removeAttribute("data-brand");
  }

  // 4) Trang home: thiếu key ⇒ null (hành vi cũ); có key ⇒ link an toàn, hoặc "" = không có trang home.
  HOME_URL = _ownKey(p, "homeUrl") ? safeProfileUrl(p.homeUrl) : null;

  // 5) Thời gian giữ màn terminal: ghi đè CSS var --boot-hold-ms (ui-render đọc qua getComputedStyle).
  const ms = Number(p.introMs);
  if (_ownKey(p, "introMs") && Number.isFinite(ms)) {
    root.style.setProperty("--boot-hold-ms", String(Math.round(Math.min(INTRO_MS_MAX, Math.max(INTRO_MS_MIN, ms)))));
  } else {
    root.style.removeProperty("--boot-hold-ms");
  }
  return { variant: ACTIVE_VARIANT, lang: LANG, brand: BRAND, homeUrl: HOME_URL };
}

// Lưu hồ sơ vừa đọc ⇒ lần mở sau vẽ đầu đúng skin / ngôn ngữ (theme.js + lần áp lúc nạp bên dưới).
function cacheEventProfile(profile) {
  try {
    const p = (profile && typeof profile === "object" && !Array.isArray(profile)) ? profile : {};
    localStorage.setItem(profileCacheKey(), JSON.stringify(p));
  } catch (e) {}
}

// Lúc nạp: hồ sơ đã lưu (nếu có) — chưa có thì mặc định, y như trước khi có hồ sơ.
applyEventProfile(cachedEventProfile());
