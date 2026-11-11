// ============================================================================
// home-sheets.js — chuyển doc trang home ⇄ file Excel (mỗi loại danh sách 1 sheet, cột = tên field của schema).
// Dùng ở trình soạn admin (window.XLSX) và backend/scripts/home-import.js (require('xlsx')): thư viện XLSX được
// TRUYỀN VÀO, file này không phụ thuộc trình duyệt/Node. Tên sheet + tên cột là ĐỊNH DẠNG FILE — đổi = phá file cũ.
// Kết quả fromSheets() là doc THÔ: luôn chạy HomeSchema.validate() trước khi ghi. Chỉ lộ 1 tên toàn cục: HomeSheets.
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./home-schema.js'));
  else root.HomeSheets = factory(root.HomeSchema);
})(typeof self !== 'undefined' ? self : this, function (HS) {
  'use strict';

  const SHEET = {
    page: 'Trang', sections: 'Mục', timeline: 'Lịch trình', notes: 'Lưu ý', dress: 'Trang phục',
    colors: 'Màu trang phục', info: 'Di chuyển', vehicles: 'Xe', contacts: 'Liên hệ', guide: 'Hướng dẫn',
  };
  const keys = kind => Object.keys(HS.SPEC[kind]);
  const PAGE_KEYS = ['pageTitle'].concat(keys('hero').map(k => 'hero.' + k), keys('cta').map(k => 'cta.' + k), keys('footer').map(k => 'footer.' + k));
  // Field riêng theo type gom chung 1 bảng cột ở sheet "Mục"; mục type lạ lưu nguyên JSON ở cột "json".
  const SECTION_EXTRA = [...new Set([].concat(...Object.values(HS.TYPES).map(t => Object.keys(t.fields))))];
  const DAY_COLS = { dayLabel: 'label', dayDate: 'date', dayTitle: 'title', daySummary: 'summary' };
  const COLS = {
    sections: ['id', 'type', 'title', 'navLabel', 'icon'].concat(SECTION_EXTRA, ['json']),
    timeline: ['section', 'day'].concat(Object.keys(DAY_COLS), keys('tlItem')),
    notes: ['section'].concat(keys('note')),
    dress: ['section', 'item'].concat(keys('dress')),
    colors: ['section', 'item'].concat(keys('color')),
    info: ['section'].concat(keys('info')),
    vehicles: ['section'].concat(keys('vehicle')),
    contacts: ['section'].concat(keys('contact')),
  };
  // Sheet danh sách phẳng: sheet → [type mục, field danh sách, loại phần tử]
  const FLAT = { notes: ['notes', 'items', 'note'], info: ['transport', 'info', 'info'], vehicles: ['transport', 'vehicles', 'vehicle'], contacts: ['transport', 'contacts', 'contact'] };
  const MAX_COL_W = 60;
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const cellOut = (spec, v) => (spec && spec.t === 'b' ? (v ? 'x' : '') : (v == null ? '' : String(v)));

  const GUIDE = [
    ['Sheet', 'Cột', 'Ý nghĩa'],
    [SHEET.page, 'key / value', 'Thông tin chung: tiêu đề tab, đầu trang (hero.*), nút (cta.*), chân trang (footer.*). Xem documentation/md/HOME-TEMPLATE.md'],
    [SHEET.sections, 'id, type, title…', 'MỖI DÒNG 1 MỤC, theo đúng thứ tự hiện trên trang. type: timeline | notes | dresscode | transport | text. id: a-z, 0-9, "-" (không trùng)'],
    [SHEET.sections, 'infoTitle…contactsNote', 'Chỉ dùng cho mục type transport (tiêu đề / huy hiệu / ghi chú khối liên hệ)'],
    [SHEET.sections, 'body / bodyHtml', 'Chỉ dùng cho mục type text. bodyHtml (HTML) được ưu tiên hơn body'],
    [SHEET.sections, 'json', 'Mục type lạ (chưa hỗ trợ): toàn bộ dữ liệu dạng JSON — giữ nguyên, đừng sửa nếu không chắc'],
    [SHEET.timeline, 'section, day', 'section = id mục (sheet Mục). day = số thứ tự ngày (1, 2, 3…). Thông tin ngày (dayLabel…daySummary) ghi ở dòng ĐẦU của ngày'],
    [SHEET.timeline, 'time…tone', 'Mỗi dòng 1 hoạt động. tone: để trống = tự đoán màu theo nhãn; food | gala | game | move. Dòng không có hoạt động chỉ khai báo ngày'],
    [SHEET.dress, 'section, item', 'item = số thứ tự thẻ trang phục (1, 2…). featured: x = làm nổi bật'],
    [SHEET.colors, 'section, item', 'Màu gợi ý của thẻ trang phục số item. hex dạng #RRGGBB. border: x = viền (màu sáng tự có viền)'],
    [SHEET.info + ' / ' + SHEET.vehicles + ' / ' + SHEET.contacts, 'section', 'Dòng thông tin / xe / liên hệ của mục type transport'],
    ['(chung)', '', 'Ô giờ/ngày nên để dạng chữ (file xuất đã đặt sẵn định dạng Text). Excel tự đổi định dạng ⇒ gõ thêm dấu \' phía trước'],
  ];

  // ── doc → [{ name, rows, widths }] ──
  function toSheets(input) {
    const doc = HS.normalize(input);
    const out = {};
    for (const k of Object.keys(SHEET)) out[k] = k === 'page' ? [['key', 'value']] : k === 'guide' ? GUIDE.map(r => r.slice()) : [COLS[k].slice()];
    const pageVal = { pageTitle: doc.pageTitle };
    for (const g of ['hero', 'cta', 'footer']) for (const k of keys(g)) pageVal[g + '.' + k] = doc[g][k];
    PAGE_KEYS.forEach(k => out.page.push([k, cellOut(null, pageVal[k])]));
    for (const sec of doc.sections) {
      const def = HS.TYPES[sec.type];
      out.sections.push(COLS.sections.map(c => {
        if (c === 'json') return def ? '' : JSON.stringify(sec);
        if (!def && !['id', 'type', 'title', 'navLabel', 'icon'].includes(c)) return '';
        return cellOut(null, sec[c]);
      }));
      if (!def) continue;
      const id = sec.id;
      if (sec.type === 'timeline') {
        sec.days.forEach((d, di) => {
          const dayCells = Object.keys(DAY_COLS).map(c => d[DAY_COLS[c]]);
          if (!d.items.length) out.timeline.push([id, String(di + 1)].concat(dayCells, keys('tlItem').map(() => '')));
          d.items.forEach((it, ii) => out.timeline.push([id, String(di + 1)].concat(ii === 0 ? dayCells : dayCells.map(() => ''), keys('tlItem').map(k => cellOut(HS.SPEC.tlItem[k], it[k])))));
        });
      } else if (sec.type === 'dresscode') {
        sec.items.forEach((d, n) => {
          out.dress.push([id, String(n + 1)].concat(keys('dress').map(k => cellOut(HS.SPEC.dress[k], d[k]))));
          d.colors.forEach(c => out.colors.push([id, String(n + 1)].concat(keys('color').map(k => cellOut(HS.SPEC.color[k], c[k])))));
        });
      }
      for (const [sheet, [type, list, kind]] of Object.entries(FLAT)) {
        if (sec.type !== type) continue;
        sec[list].forEach(it => out[sheet].push([id].concat(keys(kind).map(k => cellOut(HS.SPEC[kind][k], it[k])))));
      }
    }
    return Object.keys(SHEET).map(k => ({ name: SHEET[k], rows: out[k], widths: widthsOf(out[k]) }));
  }
  function widthsOf(rows) {
    const w = [];
    rows.forEach(r => r.forEach((v, i) => { w[i] = Math.min(MAX_COL_W, Math.max(w[i] || 6, String(v).split('\n')[0].length + 2)); }));
    return w;
  }

  // ── { tên sheet: mảng dòng (dòng 0 = tiêu đề) } → { doc, errors, warnings } ──
  function fromSheets(sheets) {
    const errors = [], warnings = [];
    const err = (sheet, row, msg) => errors.push({ sheet, row, msg });
    const warn = (sheet, row, msg) => warnings.push({ sheet, row, msg });
    const doc = { v: HS.VERSION, hero: {}, cta: {}, footer: {}, sections: [] };

    // Đọc 1 sheet thành [{ row (số dòng Excel), cells: {cột: chuỗi} }]; thiếu sheet ⇒ [] (sheet bắt buộc ⇒ lỗi).
    function table(key, required, needCols) {
      const name = SHEET[key];
      const rows = sheets[name];
      if (!rows) { if (required) err(name, 0, 'thiếu sheet "' + name + '"'); return []; }
      const head = (rows[0] || []).map(h => String(h == null ? '' : h).trim());
      const missing = needCols.filter(c => !head.includes(c));
      if (missing.length) { err(name, 1, 'thiếu cột: ' + missing.join(', ')); return []; }
      const out = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const cells = {};
        let any = false;
        head.forEach((h, j) => { if (!h) return; const v = r[j] == null ? '' : String(r[j]); cells[h] = v; if (v.trim() !== '') any = true; });
        if (any) out.push({ row: i + 1, cells });
      }
      return out;
    }

    for (const { row, cells } of table('page', true, ['key', 'value'])) {
      const k = cells.key.trim();
      if (!k) continue;
      if (!PAGE_KEYS.includes(k)) { warn(SHEET.page, row, 'key lạ "' + k + '" — bỏ qua'); continue; }
      if (k === 'pageTitle') doc.pageTitle = cells.value;
      else { const [g, f] = k.split('.'); doc[g][f] = cells.value; }
    }

    const byId = new Map();
    for (const { row, cells } of table('sections', true, ['id', 'type'])) {
      const id = cells.id.trim(), type = cells.type.trim();
      const def = HS.TYPES[type];
      let sec;
      if (!def && (cells.json || '').trim()) {
        try { sec = JSON.parse(cells.json); } catch (e) { err(SHEET.sections, row, 'cột json không phải JSON hợp lệ'); continue; }
        if (!isObj(sec)) { err(SHEET.sections, row, 'cột json phải là object'); continue; }
      } else sec = {};
      sec.id = id;
      sec.type = type;
      // type lạ: chỉ ghi đè khi ô có giá trị (không thêm key rỗng vào dữ liệu giữ nguyên)
      for (const c of ['title', 'navLabel', 'icon']) { if (def) sec[c] = cells[c] || ''; else if ((cells[c] || '').trim()) sec[c] = cells[c]; }
      if (def) {
        for (const f of Object.keys(def.fields)) sec[f] = cells[f] || '';
        for (const l of Object.keys(def.lists)) sec[l] = [];
      }
      doc.sections.push(sec);
      if (byId.has(id)) err(SHEET.sections, row, 'id "' + id + '" bị trùng');
      else byId.set(id, { sec, type });
    }
    // Mục của 1 dòng ở sheet con: phải có trong sheet Mục và đúng type.
    function owner(sheet, row, cells, type) {
      const id = (cells.section || '').trim();
      const hit = byId.get(id);
      if (!hit) { err(sheet, row, 'mục "' + id + '" không có trong sheet ' + SHEET.sections); return null; }
      if (hit.type !== type) { err(sheet, row, 'mục "' + id + '" là type ' + hit.type + ', không phải ' + type); return null; }
      return hit.sec;
    }
    const num = (sheet, row, v, what) => {
      const n = Number(String(v).trim());
      if (!Number.isInteger(n) || n < 1) { err(sheet, row, what + ' phải là số nguyên ≥ 1 (đang "' + v + '")'); return 0; }
      return n;
    };
    const pickFields = (kind, cells) => { const o = {}; keys(kind).forEach(k => { o[k] = cells[k] || ''; }); return o; };

    // Lịch trình: gom theo (mục, số ngày); ngày xếp theo số, hoạt động theo thứ tự dòng.
    const dayMap = new Map();
    for (const { row, cells } of table('timeline', false, ['section', 'day'])) {
      const sec = owner(SHEET.timeline, row, cells, 'timeline');
      const n = num(SHEET.timeline, row, cells.day, 'day');
      if (!sec || !n) continue;
      if (!dayMap.has(sec)) dayMap.set(sec, new Map());
      const days = dayMap.get(sec);
      if (!days.has(n)) days.set(n, { label: '', date: '', title: '', summary: '', items: [] });
      const d = days.get(n);
      for (const c of Object.keys(DAY_COLS)) if (!d[DAY_COLS[c]] && (cells[c] || '').trim()) d[DAY_COLS[c]] = cells[c];
      const it = pickFields('tlItem', cells);
      if (keys('tlItem').some(k => it[k].trim())) d.items.push(it);
    }
    for (const [sec, days] of dayMap) sec.days = [...days.keys()].sort((a, b) => a - b).map(k => days.get(k));

    // Trang phục: thẻ theo số item; màu gắn vào thẻ cùng (mục, item).
    const dressMap = new Map();
    for (const { row, cells } of table('dress', false, ['section', 'item'])) {
      const sec = owner(SHEET.dress, row, cells, 'dresscode');
      const n = num(SHEET.dress, row, cells.item, 'item');
      if (!sec || !n) continue;
      if (!dressMap.has(sec)) dressMap.set(sec, new Map());
      if (dressMap.get(sec).has(n)) { err(SHEET.dress, row, 'item ' + n + ' của mục "' + sec.id + '" bị trùng'); continue; }
      dressMap.get(sec).set(n, Object.assign(pickFields('dress', cells), { colors: [] }));
    }
    for (const { row, cells } of table('colors', false, ['section', 'item'])) {
      const sec = owner(SHEET.colors, row, cells, 'dresscode');
      const n = num(SHEET.colors, row, cells.item, 'item');
      if (!sec || !n) continue;
      const card = dressMap.get(sec) && dressMap.get(sec).get(n);
      if (!card) { err(SHEET.colors, row, 'không có thẻ trang phục item ' + n + ' của mục "' + sec.id + '" (sheet ' + SHEET.dress + ')'); continue; }
      card.colors.push(pickFields('color', cells));
    }
    for (const [sec, cards] of dressMap) sec.items = [...cards.keys()].sort((a, b) => a - b).map(k => cards.get(k));

    for (const [sheet, [type, list, kind]] of Object.entries(FLAT)) {
      for (const { row, cells } of table(sheet, false, ['section'])) {
        const sec = owner(SHEET[sheet], row, cells, type);
        if (sec) sec[list].push(pickFields(kind, cells));
      }
    }
    return { doc, errors, warnings };
  }

  // ── Workbook (thư viện XLSX truyền vào) ──
  function toWorkbook(XLSX, doc) {
    const wb = XLSX.utils.book_new();
    for (const sh of toSheets(doc)) {
      const ws = XLSX.utils.aoa_to_sheet(sh.rows);
      // Định dạng Text cho mọi ô chữ: Excel không tự đổi "05:30" thành giờ hay "15/04" thành ngày khi sửa.
      for (const addr of Object.keys(ws)) if (addr[0] !== '!' && ws[addr].t === 's') ws[addr].z = '@';
      ws['!cols'] = sh.widths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sh.name);
    }
    return wb;
  }
  function fromWorkbook(XLSX, wb) {
    const sheets = {};
    for (const name of wb.SheetNames) sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false, blankrows: true });
    return fromSheets(sheets);
  }

  return { SHEET, COLS, PAGE_KEYS, toSheets, fromSheets, toWorkbook, fromWorkbook };
});
