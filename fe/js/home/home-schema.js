// ============================================================================
// home-schema.js — SCHEMA trang home của sự kiện: events/{eventId}/meta/home
// ----------------------------------------------------------------------------
// MỘT nguồn sự thật cho cả 3 nơi dùng (tài liệu: documentation/HOME-TEMPLATE.md):
//   • fe/home.html            — normalize() KHOAN DUNG trước khi vẽ (dữ liệu lạ/thiếu ⇒ giá trị rỗng, không vỡ trang);
//   • trình soạn admin        — validate() CHẶT trước khi ghi (lỗi kèm đường dẫn field để tô đỏ ô nhập);
//   • backend/scripts/home-import.js — require() file này trong Node.
// Không phụ thuộc DOM / Firebase. Bọc UMD: trình duyệt chỉ lộ đúng 1 tên toàn cục `HomeSchema`
// (không khai const/let top-level ⇒ không đụng tên global của theme.js / config.js).
// ============================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HomeSchema = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 1;
  // ID sự kiện — cùng quy tắc ?e= (hợp đồng §3) và form admin.
  const EVENT_ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
  // ID mục ⇒ neo DOM "sec-<id>" + tab mục lục. Duy nhất trong 1 trang.
  const SECTION_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
  const TYPE_RE = /^[a-z][a-z0-9-]{0,31}$/;
  const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  // Màu nhãn hoạt động (lịch trình). "" = tự đoán theo chữ của nhãn (giống travel.js).
  const TONES = ['', 'food', 'gala', 'game', 'move'];
  const MAX_SECTIONS = 12;
  const MAX_DOC_CHARS = 900000;   // dưới giới hạn 1 MiB/doc của Firestore (đo theo độ dài JSON)
  const DOC_PATH = { col: 'events', sub: 'meta', home: 'home', config: 'config' };
  // Icon dùng khi field icon để trống (trang home vẽ; trình soạn hiện làm placeholder).
  const DEFAULT_ICON = { date: '📅', location: '📍', venue: '🏨', schedule: '🗓️', section: '📌', item: '•', note: '📌', infoRow: '•' };

  // ── Kiểu lá ── s: chuỗi thường (LUÔN escape khi vẽ) · html: chuỗi HTML (lọc thẻ khi vẽ — chỉ field tên *Html)
  //              url: https:// hoặc đường dẫn trong site · hex: #RGB/#RRGGBB · tone · b: boolean · sid: id mục · type
  const str = max => ({ t: 's', max });
  const url = max => ({ t: 'url', max });
  const html = max => ({ t: 'html', max });
  const BOOL = { t: 'b' }, HEX = { t: 'hex' }, TONE = { t: 'tone' }, SID = { t: 'sid' }, TYPE = { t: 'type' };

  // Field lá của từng loại object (thứ tự = thứ tự hiện trong trình soạn / cột Excel).
  const SPEC = {
    root:    { pageTitle: str(120) },
    hero:    { badge: str(60), title: str(120), subtitle: str(300),
               date: str(80), duration: str(60), dateIcon: str(16),
               location: str(120), locationIcon: str(16),
               venue: str(120), venueIcon: str(16),
               imageUrl: url(500), imageAlt: str(120) },
    cta:     { label: str(40), icon: str(16), url: url(500), scheduleLabel: str(40), scheduleIcon: str(16) },
    footer:  { text: str(200), subtext: str(200) },
    section: { id: SID, type: TYPE, title: str(120), navLabel: str(40), icon: str(16) },
    day:     { label: str(40), date: str(40), title: str(120), summary: str(600) },
    tlItem:  { time: str(40), icon: str(16), title: str(160), desc: str(1000), tag: str(40), tone: TONE },
    note:    { icon: str(16), badge: str(40), title: str(160), desc: str(1000) },
    dress:   { day: str(120), time: str(80), highlight: str(160), desc: str(1000), tip: str(600), featured: BOOL },
    color:   { name: str(60), hex: HEX, border: BOOL },
    info:    { icon: str(16), label: str(80), text: str(600) },
    vehicle: { name: str(40), label: str(120), plate: str(40), lead: str(120) },
    contact: { role: str(80), name: str(80), phone: str(40), duty: str(160) },
  };
  // Danh sách con lồng trong 1 object: field → [loại phần tử, số phần tử tối đa].
  const LISTS = {
    day:   { items: ['tlItem', 40] },
    dress: { colors: ['color', 12] },
  };
  // Field riêng + danh sách theo TYPE của mục. Type không có ở đây = "type lạ": dữ liệu được GIỮ NGUYÊN
  // (trình soạn sửa dạng JSON), trang home bỏ qua ⇒ thêm type mới về sau không làm mất dữ liệu cũ.
  const TYPES = {
    timeline:  { fields: {}, lists: { days: ['day', 14] } },
    notes:     { fields: {}, lists: { items: ['note', 40] } },
    dresscode: { fields: {}, lists: { items: ['dress', 20] } },
    transport: { fields: { infoTitle: str(80), contactsTitle: str(80), contactsBadge: str(40), contactsNote: str(300) },
                 lists: { info: ['info', 20], vehicles: ['vehicle', 30], contacts: ['contact', 20] } },
    text:      { fields: { body: str(5000), bodyHtml: html(20000) }, lists: {} },
  };
  const ROOT_KEYS = ['v', 'pageTitle', 'hero', 'cta', 'sections', 'footer'];

  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const jsonCopy = v => JSON.parse(JSON.stringify(v));

  // URL an toàn cho src/href: "" | https://<host>… | đường dẫn tương đối trong site.
  // Cấm mọi scheme khác (javascript:, data:, http:…), "//host", dấu "\", khoảng trắng/ký tự điều khiển.
  function isSafeUrl(v) {
    if (typeof v !== 'string') return false;
    if (v === '') return true;
    if (/[\s\u0000-\u001f\u007f\\]/.test(v)) return false;
    if (/^https:\/\/[^/?#]+/i.test(v)) return true;
    if (v.startsWith('//')) return false;
    return !/^[a-z][a-z0-9+.-]*:/i.test(v);
  }

  const TRUTHY = ['true', 'x', '1', 'yes', 'y', 'có', 'co'];
  const FALSY = ['false', '0', 'no', 'n', 'không', 'khong', ''];

  function coerce(spec, v, path, ctx) {
    if (spec.t === 'b') {
      if (typeof v === 'boolean') return v;
      if (v == null) return false;
      const sv = String(v).trim().toLowerCase();
      if (TRUTHY.includes(sv)) return true;
      if (!FALSY.includes(sv)) ctx.err(path, 'phải là đúng/sai (x = có)');
      return false;
    }
    let s;
    if (v == null) s = '';
    else if (typeof v === 'string') s = v;
    else if (typeof v === 'number' && isFinite(v)) s = String(v);
    else { ctx.err(path, 'phải là chuỗi'); s = ''; }
    s = s.replace(/\r\n?/g, '\n').trim();
    if (spec.max && s.length > spec.max) ctx.err(path, `dài quá ${spec.max} ký tự (đang ${s.length})`);
    if (spec.t === 'url' && !isSafeUrl(s)) { ctx.err(path, 'URL không hợp lệ — chỉ https://… hoặc đường dẫn trong site'); return ctx.strict ? s : ''; }
    if (spec.t === 'hex' && !HEX_RE.test(s)) { ctx.err(path, 'mã màu phải dạng #RRGGBB'); return ctx.strict ? s : ''; }
    if (spec.t === 'tone' && !TONES.includes(s)) { ctx.err(path, 'màu nhãn không hợp lệ'); return ctx.strict ? s : ''; }
    return s;
  }

  function normFields(fields, src, base, ctx, out) {
    for (const k of Object.keys(fields)) out[k] = coerce(fields[k], src[k], base + k, ctx);
  }

  function normList(kind, max, raw, path, ctx) {
    if (raw == null) return [];
    if (!Array.isArray(raw)) { ctx.err(path, 'phải là danh sách'); return []; }
    if (raw.length > max) ctx.err(path, `tối đa ${max} dòng (đang ${raw.length})`);
    return raw.map((it, i) => normKind(kind, it, `${path}[${i}]`, ctx));
  }

  function normKind(kind, raw, path, ctx) {
    let src = raw;
    if (!isObj(src)) { if (src != null) ctx.err(path, 'phải là object'); src = {}; }
    const out = {};
    const base = path ? path + '.' : '';
    normFields(SPEC[kind], src, base, ctx, out);
    const lists = LISTS[kind] || {};
    for (const k of Object.keys(lists)) out[k] = normList(lists[k][0], lists[k][1], src[k], base + k, ctx);
    ctx.unknown(src, Object.keys(SPEC[kind]).concat(Object.keys(lists)), path);
    return out;
  }

  function normSection(raw, i, ctx) {
    const path = `sections[${i}]`;
    if (!isObj(raw)) { ctx.err(path, 'mỗi mục phải là object'); return null; }
    const type = typeof raw.type === 'string' ? raw.type.trim() : '';
    const def = TYPES[type];
    if (!def) {
      if (!TYPE_RE.test(type)) ctx.err(path + '.type', 'type không hợp lệ');
      else ctx.warn(path, `type "${type}" chưa được trang home hỗ trợ — giữ nguyên dữ liệu, không hiển thị`);
      const copy = jsonCopy(raw);
      copy.type = type;
      copy.id = typeof raw.id === 'string' ? raw.id.trim() : '';
      return copy;
    }
    const out = {};
    normFields(SPEC.section, raw, path + '.', ctx, out);
    normFields(def.fields, raw, path + '.', ctx, out);
    for (const k of Object.keys(def.lists)) out[k] = normList(def.lists[k][0], def.lists[k][1], raw[k], `${path}.${k}`, ctx);
    ctx.unknown(raw, Object.keys(SPEC.section).concat(Object.keys(def.fields), Object.keys(def.lists)), path);
    return out;
  }

  // strict=true (validate): giữ nguyên giá trị sai để trình soạn hiện lại + báo lỗi.
  // strict=false (normalize): bỏ giá trị không an toàn, tự sửa id mục thiếu/trùng ⇒ trang home luôn vẽ được.
  function run(raw, strict) {
    const errors = [], warnings = [];
    const ctx = {
      strict,
      err: (p, m) => errors.push({ path: p, msg: m }),
      warn: (p, m) => warnings.push({ path: p, msg: m }),
      unknown: (src, known, path) => {
        for (const k of Object.keys(src)) if (!known.includes(k)) warnings.push({ path: (path ? path + '.' : '') + k, msg: 'trường lạ — bỏ qua' });
      },
    };
    let src = raw;
    if (!isObj(src)) { ctx.err('', 'dữ liệu trang home phải là object'); src = {}; }
    if (src.v != null && src.v !== VERSION) {
      if (typeof src.v === 'number' && src.v > VERSION) ctx.err('v', `dữ liệu dùng schema v${src.v}, bản này chỉ hiểu v${VERSION} — cập nhật code trước khi sửa`);
      else ctx.warn('v', `phiên bản schema "${src.v}" không hợp lệ — coi như v${VERSION}`);
    }
    const doc = { v: VERSION };
    normFields(SPEC.root, src, '', ctx, doc);
    doc.hero = normKind('hero', src.hero, 'hero', ctx);
    doc.cta = normKind('cta', src.cta, 'cta', ctx);
    let secs = src.sections;
    if (secs == null) secs = [];
    if (!Array.isArray(secs)) { ctx.err('sections', 'phải là danh sách'); secs = []; }
    if (secs.length > MAX_SECTIONS) ctx.err('sections', `tối đa ${MAX_SECTIONS} mục (đang ${secs.length})`);
    const pairs = secs.map((r, i) => [i, normSection(r, i, ctx)]).filter(p => p[1]);
    const seen = new Set();
    for (const [i, sec] of pairs) {
      const okId = SECTION_ID_RE.test(sec.id) && !seen.has(sec.id);
      if (!okId) {
        if (strict) ctx.err(`sections[${i}].id`, !sec.id ? 'thiếu id' : seen.has(sec.id) ? `id "${sec.id}" bị trùng` : 'id chỉ gồm a-z, 0-9, "-" (≤ 32 ký tự, không mở đầu bằng "-")');
        else { let n = i + 1; while (seen.has('s' + n)) n++; sec.id = 's' + n; }
      }
      seen.add(sec.id);
    }
    doc.sections = pairs.map(p => p[1]);
    doc.footer = normKind('footer', src.footer, 'footer', ctx);
    ctx.unknown(src, ROOT_KEYS, '');
    const size = JSON.stringify(doc).length;
    if (size > MAX_DOC_CHARS) ctx.err('', `dữ liệu quá lớn (${size} ký tự JSON, tối đa ${MAX_DOC_CHARS})`);
    return { ok: errors.length === 0, errors, warnings, doc };
  }

  const validate = raw => run(raw, true);
  const normalize = raw => run(raw, false).doc;

  // ── Khuôn trống (trình soạn "Thêm dòng" / "Thêm mục") ──
  function blank(kind) {
    const out = {};
    const f = SPEC[kind];
    for (const k of Object.keys(f)) out[k] = f[k].t === 'b' ? false : '';
    const lists = LISTS[kind] || {};
    for (const k of Object.keys(lists)) out[k] = [];
    if (kind === 'color') out.hex = '#FFFFFF';
    return out;
  }
  function blankSection(type, id, extra) {
    const def = TYPES[type];
    if (!def) throw new Error('type không hỗ trợ: ' + type);
    const out = blank('section');
    out.id = id;
    out.type = type;
    for (const k of Object.keys(def.fields)) out[k] = '';
    for (const k of Object.keys(def.lists)) out[k] = [];
    return Object.assign(out, extra || {});
  }
  // id mục chưa dùng: "<base>", "<base>-2", "<base>-3"…
  function uniqueId(base, taken) {
    const b = String(base || 's').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 's';
    const used = new Set(taken || []);
    if (!used.has(b)) return b;
    let n = 2;
    while (used.has(`${b}-${n}`)) n++;
    return `${b}-${n}`;
  }

  // ── Đường dẫn field dạng "sections[2].days[0].items[3].time" (trùng format lỗi của validate) ──
  function parsePath(p) {
    const out = [];
    String(p).replace(/\[(\d+)\]|[^.[\]]+/g, (m, n) => { out.push(n !== undefined ? Number(n) : m); return m; });
    return out;
  }
  function getPath(obj, p) {
    return parsePath(p).reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, p, val) {
    const ks = parsePath(p);
    const last = ks.pop();
    const parent = ks.reduce((o, k) => o[k], obj);
    parent[last] = val;
  }

  // Ref Firestore (chạy được với SDK compat ở trình duyệt lẫn firebase-admin ở Node: cùng API collection/doc).
  const homeRef = (db, eventId) => db.collection(DOC_PATH.col).doc(eventId).collection(DOC_PATH.sub).doc(DOC_PATH.home);
  const configRef = (db, eventId) => db.collection(DOC_PATH.col).doc(eventId).collection(DOC_PATH.sub).doc(DOC_PATH.config);

  return {
    VERSION, EVENT_ID_RE, SECTION_ID_RE, TYPE_RE, HEX_RE, TONES, MAX_SECTIONS, MAX_DOC_CHARS, DOC_PATH, DEFAULT_ICON,
    SPEC, LISTS, TYPES,
    isSafeUrl, validate, normalize, blank, blankSection, uniqueId,
    parsePath, getPath, setPath, homeRef, configRef,
  };
});
