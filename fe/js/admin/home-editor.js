// ============================================================================
// home-editor.js — trình soạn trang home (events/{eventId}/meta/home) gắn vào admin.
// ----------------------------------------------------------------------------
// API:  HomeEditor.mount(el, { db, eventId, previewBase? }) → Promise   (mount lại = tự unmount bản cũ)
//       HomeEditor.unmount() · isDirty() · getDoc() · setDoc(doc)
// Cần nạp TRƯỚC: js/home/home-schema.js (HomeSchema), js/home/home-sheets.js (HomeSheets); window.XLSX (admin có sẵn)
// cho nạp/xuất Excel. CSS: assets/admin-home.css (class "he-*") + dùng lại class/token của assets/admin.css.
// Ghi: validate (HomeSchema) trước, rồi set() TRỌN doc (không merge) ⇒ xoá mục/dòng là xoá thật.
// Form dựng từ HomeSchema.SPEC/TYPES ⇒ thêm field/type ở schema là trình soạn tự có ô nhập (chỉ cần thêm nhãn).
// Chỉ lộ 1 tên toàn cục: HomeEditor.
// ============================================================================
(function (root) {
  'use strict';

  const HS = root.HomeSchema, SH = root.HomeSheets;
  const DI = HS ? HS.DEFAULT_ICON : {};
  const PREVIEW_PAGE = 'home.html';
  const EVENT_PAGE = 'index.html';
  const FILE_PREFIX = 'home-';

  // ── Nhãn tiếng Việt ──
  const LABEL = {
    root: { pageTitle: 'Tiêu đề tab trình duyệt' },
    hero: { badge: 'Nhãn nhỏ trên tiêu đề', title: 'Tiêu đề lớn (H1)', subtitle: 'Khẩu hiệu', date: 'Ngày', duration: 'Thời lượng', dateIcon: 'Icon ngày',
            location: 'Địa điểm', locationIcon: 'Icon địa điểm', venue: 'Nơi ở / khách sạn', venueIcon: 'Icon nơi ở', imageUrl: 'Ảnh (https:// hoặc đường dẫn trong site)', imageAlt: 'Mô tả ảnh' },
    cta: { label: 'Nhãn nút chính', icon: 'Icon nút chính', url: 'Link nút chính', scheduleLabel: 'Nhãn nút xem lịch trình', scheduleIcon: 'Icon nút lịch trình' },
    footer: { text: 'Chân trang — dòng 1', subtext: 'Chân trang — dòng 2' },
    section: { id: 'ID (neo #sec-…)', type: 'Loại', title: 'Tiêu đề mục', navLabel: 'Nhãn trên mục lục', icon: 'Icon' },
    transport: { infoTitle: 'Tiêu đề khối thông tin', contactsTitle: 'Tiêu đề khối liên hệ', contactsBadge: 'Huy hiệu (vd 24/7)', contactsNote: 'Ghi chú khối liên hệ' },
    text: { body: 'Nội dung (văn bản thường; dòng trống = đoạn mới)', bodyHtml: 'Nội dung HTML (tuỳ chọn — ưu tiên hơn văn bản; chỉ giữ thẻ cơ bản)' },
    day: { label: 'Nhãn ngày', date: 'Ngày', title: 'Tiêu đề ngày', summary: 'Tóm tắt' },
    tlItem: { time: 'Giờ', icon: 'Icon', title: 'Hoạt động', desc: 'Mô tả', tag: 'Nhãn', tone: 'Màu nhãn' },
    note: { icon: 'Icon', badge: 'Nhãn', title: 'Tiêu đề', desc: 'Nội dung' },
    dress: { day: 'Dịp / ngày', time: 'Thời gian', highlight: 'Trang phục chính', desc: 'Mô tả', tip: 'Mẹo', featured: 'Làm nổi bật thẻ' },
    color: { name: 'Tên màu', hex: 'Mã màu', border: 'Viền' },
    info: { icon: 'Icon', label: 'Nhãn', text: 'Nội dung' },
    vehicle: { name: 'Xe', label: 'Mô tả', plate: 'Biển số', lead: 'Trưởng xe' },
    contact: { role: 'Vai trò', name: 'Họ tên', phone: 'Điện thoại', duty: 'Phụ trách' },
  };
  const GROUP_LABEL = { hero: 'Đầu trang', cta: 'Nút', footer: 'Chân trang' };
  const LIST_LABEL = {
    'timeline.days': 'Ngày', 'day.items': 'Hoạt động', 'notes.items': 'Lưu ý', 'dresscode.items': 'Thẻ trang phục', 'dress.colors': 'Màu',
    'transport.info': 'Dòng thông tin', 'transport.vehicles': 'Xe', 'transport.contacts': 'Liên hệ',
  };
  const TYPE_INFO = {
    timeline: { label: 'Lịch trình', icon: '🗓️', title: 'Lịch trình' },
    notes: { label: 'Lưu ý', icon: '📌', title: 'Lưu ý' },
    dresscode: { label: 'Trang phục', icon: '👕', title: 'Trang phục' },
    transport: { label: 'Di chuyển & liên hệ', icon: '🚌', title: 'Di chuyển & liên hệ' },
    text: { label: 'Văn bản', icon: '📝', title: 'Thông tin thêm' },
  };
  const TONE_LABEL = { '': 'Tự động', food: 'Ẩm thực', gala: 'Gala', game: 'Hoạt động', move: 'Di chuyển' };
  // Placeholder = giá trị trang home dùng khi ô để trống (đường dẫn đã bỏ chỉ số [n]).
  const PLACEHOLDER = {
    'hero.dateIcon': DI.date, 'hero.locationIcon': DI.location, 'hero.venueIcon': DI.venue, 'cta.scheduleIcon': DI.schedule,
    'sections.icon': DI.section, 'sections.days.items.icon': DI.item, 'sections.items.icon': DI.note, 'sections.info.icon': DI.infoRow,
  };
  const COLLAPSIBLE = new Set(['day', 'dress']);   // dòng có danh sách con ⇒ gập được
  const SVG = {
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    down2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    up2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
    reload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  };

  let st = null;   // trạng thái của lần mount hiện tại (null = chưa mount)

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const json = v => JSON.stringify(v);
  const fid = p => 'he-' + p.replace(/[^a-zA-Z0-9]+/g, '-');
  const colorValue = v => (/^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : /^#[0-9a-fA-F]{3}$/.test(v) ? '#' + v.slice(1).split('').map(c => c + c).join('').toLowerCase() : '#ffffff');
  const splitIdx = p => { const m = /^(.*)\[(\d+)\]$/.exec(p); return m ? [m[1], Number(m[2])] : [null, -1]; };
  const current = () => HS.validate(st.doc).doc;     // bản đã chuẩn hoá của nội dung đang soạn

  function widthClass(spec) {
    if (spec.t === 'b' || spec.t === 'tone' || spec.t === 'hex' || spec.t === 'sid') return 'he-w-s';
    if (spec.t === 'url') return 'he-w-m';                 // URL: ô 1 dòng (không textarea dù dài)
    if (spec.max <= 16) return 'he-w-xs';
    if (spec.max <= 40) return 'he-w-s';
    if (spec.max < 300 && spec.t !== 'html') return 'he-w-m';
    return 'he-w-l';
  }
  function placeholderFor(path) {
    if (path === 'hero.title') return st.cfgTitle;
    if (path === 'cta.url') return `${EVENT_PAGE}?e=${st.eventId}`;
    return PLACEHOLDER[path.replace(/\[\d+\]/g, '')] || '';
  }

  // ── Ô nhập ──
  function fieldHtml(kind, key, spec, value, path) {
    const label = (LABEL[kind] && LABEL[kind][key]) || key;
    const w = widthClass(spec);
    const attr = `data-path="${esc(path)}" id="${fid(path)}"`;
    if (spec.t === 'b') return `<label class="cb-wrap he-f he-cbf ${w}"><input type="checkbox" ${attr}${value ? ' checked' : ''}><span>${esc(label)}</span></label>`;
    let control;
    if (spec.t === 'tone') control = `<select ${attr}>${HS.TONES.map(t => `<option value="${t}"${t === value ? ' selected' : ''}>${TONE_LABEL[t]}</option>`).join('')}</select>`;
    else if (spec.t === 'hex') control = `<span class="he-hex"><input type="color" data-hex-for="${esc(path)}" value="${colorValue(value)}" aria-label="${esc(label)}"><input type="text" ${attr} value="${esc(value)}" maxlength="7" placeholder="#RRGGBB" spellcheck="false"></span>`;
    else if (w === 'he-w-l') control = `<textarea ${attr} rows="${spec.max > 1000 ? 6 : spec.max >= 1000 ? 3 : 2}"${spec.max ? ` maxlength="${spec.max}"` : ''}${spec.t === 'html' ? ' spellcheck="false"' : ''}>${esc(value)}</textarea>`;
    else {
      const ph = placeholderFor(path);
      control = `<input type="text" ${attr} value="${esc(value)}"${spec.max ? ` maxlength="${spec.max}"` : ''}${ph ? ` placeholder="${esc(ph)}"` : ''}${spec.t === 'sid' ? ' spellcheck="false" autocapitalize="off"' : ''}>`;
    }
    return `<label class="field he-f ${w}" for="${fid(path)}"><span>${esc(label)}</span>${control}</label>`;
  }
  function fieldsHtml(kind, obj, base, skip) {
    const spec = HS.SPEC[kind];
    return Object.keys(spec).filter(k => !(skip || []).includes(k)).map(k => fieldHtml(kind, k, spec[k], obj[k], base + k)).join('');
  }

  // ── Danh sách ──
  function toolsHtml(path, i, n) {
    return `<span class="he-tools">`
      + `<button type="button" class="icon-btn" data-act="up" data-path="${esc(path)}" title="Chuyển lên" aria-label="Chuyển lên"${i === 0 ? ' disabled' : ''}>${SVG.up}</button>`
      + `<button type="button" class="icon-btn" data-act="down" data-path="${esc(path)}" title="Chuyển xuống" aria-label="Chuyển xuống"${i === n - 1 ? ' disabled' : ''}>${SVG.down}</button>`
      + `<button type="button" class="icon-btn he-del" data-act="del" data-path="${esc(path)}" title="Xoá" aria-label="Xoá">${SVG.del}</button></span>`;
  }
  function summaryOf(kind, it) {
    if (kind === 'day') return `${[it.label || 'Ngày', it.date].filter(Boolean).join(' · ')}${it.title ? ' — ' + it.title : ''} (${it.items.length} hoạt động)`;
    if (kind === 'dress') return `${it.day || it.highlight || 'Thẻ trang phục'} (${it.colors.length} màu)`;
    return it.title || '(chưa có tiêu đề)';
  }
  function listHtml(ownerKind, listKey, kind, arr, path, max) {
    const label = LIST_LABEL[ownerKind + '.' + listKey] || listKey;
    return `<div class="he-list"><div class="he-list-head"><span class="he-list-title">${esc(label)}</span><span class="he-count">${arr.length}/${max}</span></div>`
      + arr.map((it, i) => rowHtml(kind, it, `${path}[${i}]`, i, arr.length)).join('')
      + `<button type="button" class="btn-ghost btn-sm he-add" data-act="add" data-path="${esc(path)}" data-kind="${kind}"${arr.length >= max ? ' disabled' : ''}>${SVG.plus}<span>Thêm ${esc(label.toLowerCase())}</span></button></div>`;
  }
  function rowHtml(kind, it, path, i, n) {
    const lists = HS.LISTS[kind] || {};
    const body = `<div class="he-fields">${fieldsHtml(kind, it, path + '.')}</div>`
      + Object.keys(lists).map(k => listHtml(kind, k, lists[k][0], it[k], `${path}.${k}`, lists[k][1])).join('');
    if (COLLAPSIBLE.has(kind)) {
      return `<details class="he-row he-row-c" data-path="${esc(path)}"${st.open.has(it) ? ' open' : ''}><summary><span class="he-idx">${i + 1}</span>`
        + `<span class="he-sum" data-sum="${esc(path)}">${esc(summaryOf(kind, it))}</span>${toolsHtml(path, i, n)}</summary><div class="he-row-body">${body}</div></details>`;
    }
    return `<div class="he-row" data-path="${esc(path)}"><div class="he-row-head"><span class="he-idx">${i + 1}</span>${toolsHtml(path, i, n)}</div>${body}</div>`;
  }

  // ── Mục ──
  function sectionHtml(sec, i, n) {
    const path = `sections[${i}]`;
    const def = HS.TYPES[sec.type];
    const info = TYPE_INFO[sec.type] || { label: sec.type || '?', icon: '🧩' };
    let body;
    if (!def) {
      body = `<p class="hint">Loại "${esc(sec.type)}" chưa có trình soạn riêng và trang home chưa hiển thị — dữ liệu được giữ nguyên, sửa trực tiếp JSON nếu cần.</p>`
        + `<label class="field he-f he-w-l"><span>JSON của mục</span><textarea class="he-json" data-raw="${esc(path)}" rows="8" spellcheck="false">${esc(JSON.stringify(sec, null, 2))}</textarea></label>`;
    } else {
      body = `<div class="he-fields">${fieldsHtml('section', sec, path + '.', ['type'])}`
        + Object.keys(def.fields).map(k => fieldHtml(sec.type, k, def.fields[k], sec[k], `${path}.${k}`)).join('') + '</div>'
        + Object.keys(def.lists).map(k => listHtml(sec.type, k, def.lists[k][0], sec[k], `${path}.${k}`, def.lists[k][1])).join('');
    }
    return `<details class="he-sec" data-path="${esc(path)}"${st.open.has(sec) ? ' open' : ''}><summary>`
      + `<span class="he-sec-ic" data-sum-ic="${esc(path)}">${esc(sec.icon || info.icon)}</span><span class="pill">${esc(info.label)}</span>`
      + `<span class="he-sum he-sec-title" data-sum="${esc(path)}">${esc(sec.title || '(chưa có tiêu đề)')}</span>`
      + `<code class="he-anchor" data-anchor="${esc(path)}">#sec-${esc(sec.id)}</code>${toolsHtml(path, i, n)}</summary>`
      + `<div class="he-sec-body">${body}</div></details>`;
  }

  // ── Khung ──
  function barHtml() {
    const s = st;
    const btn = (act, cls, icon, text) => `<button type="button" class="${cls} btn-sm" data-act="${act}">${icon || ''}<span>${text}</span></button>`;
    return `<div class="panel he-bar">`
      + `<div class="he-bar-info"><div class="he-ev">Trang home của <b>${esc(s.cfgTitle || s.eventId)}</b> <code>${esc(s.eventId)}</code></div>`
      + `<div class="he-status" role="status" aria-live="polite"></div></div>`
      + `<div class="btn-row he-actions">`
      + btn('preview', 'btn-ghost', SVG.eye, 'Xem trang') + btn('exportXlsx', 'btn-ghost', SVG.down2, 'Xuất Excel') + btn('importXlsx', 'btn-ghost', SVG.up2, 'Nạp Excel')
      + btn('exportJson', 'btn-ghost', SVG.down2, 'Xuất JSON') + btn('importJson', 'btn-ghost', SVG.up2, 'Nạp JSON') + btn('reload', 'btn-ghost', SVG.reload, 'Tải lại')
      + btn('save', 'btn-pri', SVG.save, 'Lưu') + `</div>`
      + `<input type="file" class="he-file" data-file="json" accept=".json,application/json" hidden>`
      + `<input type="file" class="he-file" data-file="xlsx" accept=".xlsx,.xls" hidden></div>`;
  }
  function noticeHtml() {
    const s = st;
    const link = `<code>${esc(PREVIEW_PAGE)}?e=${esc(s.eventId)}</code>`;
    if (s.readOnly) return `<div class="alert he-notice">Dữ liệu dùng schema mới hơn bản trình soạn này — chỉ xem, không lưu được (cập nhật code admin trước).</div>`;
    if (!s.exists) return `<p class="hint he-notice">Sự kiện này <b>chưa có trang home</b>. Soạn nội dung rồi bấm <b>Lưu</b> để tạo — link: ${link}.</p>`;
    return `<p class="hint he-notice">Link trang: ${link} · Lưu sẽ thay TOÀN BỘ nội dung trang bằng nội dung đang soạn.</p>`;
  }
  function humanPath(path) {
    const toks = HS.parsePath(path);
    const out = [];
    let kind = 'root', type = '';
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i], next = toks[i + 1];
      if (kind === 'root' && GROUP_LABEL[t]) { out.push(GROUP_LABEL[t]); kind = t; continue; }
      if (kind === 'root' && t === 'sections') {
        if (typeof next !== 'number') { out.push('Các mục'); continue; }
        const sec = st.doc.sections[next];
        type = sec ? sec.type : '';
        out.push(`Mục ${next + 1}${sec && sec.title ? ` "${sec.title}"` : ''}`);
        kind = 'section'; i++; continue;
      }
      const owner = kind === 'section' ? type : kind;
      const listDef = kind === 'section' ? (HS.TYPES[type] || { lists: {} }).lists[t] : (HS.LISTS[kind] || {})[t];
      if (listDef) {
        const lab = LIST_LABEL[owner + '.' + t] || t;
        if (typeof next === 'number') { out.push(`${lab} ${next + 1}`); kind = listDef[0]; i++; } else out.push(lab);
        continue;
      }
      out.push((kind === 'section' ? (LABEL.section[t] || (LABEL[type] || {})[t]) : (LABEL[kind] || {})[t]) || t);
    }
    return out.join(' › ') || 'Toàn trang';
  }
  function issuesHtml() {
    const s = st;
    let out = '';
    const rawErrs = [...s.rawErr.entries()].map(([p, m]) => ({ path: p, msg: m }));
    const errs = s.errors.concat(rawErrs);
    if (s.importIssues.length) {
      out += `<div class="alert he-errors" role="alert"><b>File chưa nạp được — ${s.importIssues.length} lỗi:</b><ul>`
        + s.importIssues.map(x => `<li>${esc(x)}</li>`).join('') + '</ul></div>';
    }
    if (errs.length) {
      out += `<div class="alert he-errors" role="alert"><b>${errs.length} lỗi cần sửa trước khi lưu:</b><ul>`
        + errs.map(e => `<li><button type="button" class="he-errlink" data-focus="${esc(e.path)}">${esc(humanPath(e.path))}</button>: ${esc(e.msg)}</li>`).join('') + '</ul></div>';
    }
    if (s.warnings.length) {
      out += `<div class="hint he-warns"><b>Lưu ý:</b><ul>` + s.warnings.map(w => `<li>${esc(w.sheet ? `Sheet "${w.sheet}" dòng ${w.row}` : humanPath(w.path))}: ${esc(w.msg)}</li>`).join('') + '</ul></div>';
    }
    return out;
  }

  function paint() {
    const s = st;
    if (!s) return;
    const y = window.scrollY;
    if (!s.loaded) {
      s.el.innerHTML = s.loadError
        ? `<div class="panel he-load-err"><p class="err">${esc(s.loadError)}</p><div class="btn-row"><button type="button" class="btn-ghost btn-sm" data-act="reload">${SVG.reload}<span>Thử lại</span></button></div></div>`
        : '<div class="loading-row"><span class="spinner"></span>Đang tải trang home…</div>';
      return;
    }
    const d = s.doc, n = d.sections.length;
    s.el.innerHTML = barHtml() + noticeHtml() + issuesHtml()
      + `<div class="he-top">`
      + `<section class="panel he-card"><div class="panel-head"><h2>Đầu trang</h2></div><div class="he-fields">${fieldsHtml('hero', d.hero, 'hero.')}</div></section>`
      + `<section class="panel he-card"><div class="panel-head"><h2>Nút &amp; chân trang</h2></div><div class="he-fields">${fieldsHtml('cta', d.cta, 'cta.')}${fieldsHtml('root', d, '')}${fieldsHtml('footer', d.footer, 'footer.')}</div></section>`
      + `</div><section class="he-secs"><div class="he-secs-head"><h2>Các mục <span class="he-count">${n}/${HS.MAX_SECTIONS}</span></h2>`
      + `<div class="he-add-sec"><select data-new-type aria-label="Loại mục mới">${Object.keys(HS.TYPES).map(t => `<option value="${t}">${TYPE_INFO[t].icon} ${TYPE_INFO[t].label}</option>`).join('')}</select>`
      + `<button type="button" class="btn-ghost btn-sm" data-act="addSection"${n >= HS.MAX_SECTIONS ? ' disabled' : ''}>${SVG.plus}<span>Thêm mục</span></button></div></div>`
      + (n ? d.sections.map((sec, i) => sectionHtml(sec, i, n)).join('')
        : `<div class="empty-state he-empty"><p>Chưa có mục nào.</p><button type="button" class="btn-pri btn-sm" data-act="starter">${SVG.plus}<span>Tạo khung mẫu 4 mục</span></button><p class="hint">…hoặc nạp file JSON / Excel.</p></div>`)
      + `</section>`;
    markErrors();
    updateBar();
    window.scrollTo(0, y);
    if (s.focus) {
      const el = s.el.querySelector(`[data-path^="${s.focus}"]:not(details)`);
      s.focus = '';
      if (el) { openAncestors(el); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center' }); }
    }
  }
  function openAncestors(el) {
    for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) {
      d.open = true;
      const obj = HS.getPath(st.doc, d.dataset.path);
      if (obj) st.open.add(obj);
    }
  }
  function markErrors() {
    for (const e of st.errors.concat([...st.rawErr.keys()].map(p => ({ path: p, msg: st.rawErr.get(p) })))) {
      const el = st.el.querySelector(`[data-path="${e.path}"]`) || st.el.querySelector(`[data-raw="${e.path}"]`);
      if (!el) continue;
      el.classList.add('is-invalid');
      el.setAttribute('aria-invalid', 'true');
      el.title = e.msg;
      openAncestors(el);
    }
  }

  // ── Trạng thái / dirty ──
  function setStatus(kind, text) { if (!st) return; st.status = { kind, text }; updateBar(); }
  function isDirty() { return !!(st && st.loaded && json(current()) !== st.savedJson); }
  function updateBar() {
    const s = st;
    if (!s || !s.loaded) return;
    const el = s.el.querySelector('.he-status');
    const dirty = isDirty();
    let kind = s.status.kind, text = s.status.text;
    // Thông báo vừa xảy ra (lỗi / "Đã nạp file…") ưu tiên hơn chỉ báo "chưa lưu" — touched() xoá nó ở lần sửa kế tiếp.
    if (!s.busy && kind !== 'err' && kind !== 'info' && dirty) { kind = 'dirty'; text = '● Có thay đổi chưa lưu'; }
    if (el) { el.dataset.kind = kind; el.textContent = text; }
    s.el.querySelectorAll('[data-act="save"]').forEach(b => { b.disabled = s.busy || s.readOnly; });
    s.el.querySelectorAll('.he-bar [data-act]').forEach(b => { if (b.dataset.act !== 'save') b.disabled = s.busy; });
  }
  let rafId = 0;
  function touched() {
    if (st && (st.status.kind === 'info' || (st.status.kind === 'err' && !st.errors.length && !st.rawErr.size))) st.status = { kind: 'ok', text: '' };
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateBar);
  }

  // ── Sự kiện DOM ──
  function onInput(e) {
    if (!st) return;
    const t = e.target;
    if (t.dataset.hexFor) {
      const p = t.dataset.hexFor, v = t.value.toUpperCase();
      HS.setPath(st.doc, p, v);
      const txt = st.el.querySelector(`[data-path="${p}"]`);
      if (txt) { txt.value = v; clearInvalid(txt); }
      return touched();
    }
    const p = t.dataset.path;
    if (!p || t.tagName === 'DETAILS') return;
    HS.setPath(st.doc, p, t.type === 'checkbox' ? t.checked : t.value);
    if (/\.hex$/.test(p) && HS.HEX_RE.test(t.value.trim())) {
      const c = st.el.querySelector(`[data-hex-for="${p}"]`);
      if (c) c.value = colorValue(t.value.trim());
    }
    clearInvalid(t);
    refreshSummary(p);
    touched();
  }
  function clearInvalid(el) {
    if (!el.classList.contains('is-invalid')) return;
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
    el.removeAttribute('title');
  }
  function refreshSummary(p) {
    const m = /^(.*\[\d+\])\.(\w+)$/.exec(p);
    if (!m) return;
    const owner = m[1], obj = HS.getPath(st.doc, owner);
    const sum = st.el.querySelector(`[data-sum="${owner}"]`);
    if (/^sections\[\d+\]$/.test(owner)) {
      if (sum && m[2] === 'title') sum.textContent = obj.title || '(chưa có tiêu đề)';
      const ic = st.el.querySelector(`[data-sum-ic="${owner}"]`);
      if (ic && m[2] === 'icon') ic.textContent = obj.icon || (TYPE_INFO[obj.type] || {}).icon || '';
      const an = st.el.querySelector(`[data-anchor="${owner}"]`);
      if (an && m[2] === 'id') an.textContent = '#sec-' + obj.id;
    } else if (sum) {
      sum.textContent = summaryOf(Array.isArray(obj.items) ? 'day' : 'dress', obj);
    }
  }
  function onChange(e) {
    if (!st) return;
    const t = e.target;
    if (t.dataset.raw) {
      const p = t.dataset.raw;
      try {
        const obj = JSON.parse(t.value);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('phải là object');
        HS.setPath(st.doc, p, obj);
        st.open.add(obj);
        st.rawErr.delete(p);
        clearInvalid(t);
      } catch (err) {
        st.rawErr.set(p, 'JSON không hợp lệ: ' + err.message);
        t.classList.add('is-invalid');
      }
      touched();
    } else if (t.dataset.file) {
      handleFile(t);
    }
  }
  function onToggle(e) {
    if (!st || e.target.tagName !== 'DETAILS' || !e.target.dataset.path) return;
    const obj = HS.getPath(st.doc, e.target.dataset.path);
    if (!obj) return;
    if (e.target.open) st.open.add(obj); else st.open.delete(obj);
  }
  function onClick(e) {
    if (!st) return;
    const f = e.target.closest('[data-focus]');
    if (f && st.el.contains(f)) {
      const el = st.el.querySelector(`[data-path="${f.dataset.focus}"]`) || st.el.querySelector(`[data-raw="${f.dataset.focus}"]`);
      if (el) { openAncestors(el); el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || !st.el.contains(b) || b.disabled) return;
    if (b.closest('summary')) e.preventDefault();   // nút trong <summary>: không đóng/mở thẻ
    const p = b.dataset.path;
    switch (b.dataset.act) {
      case 'add': return addRow(p, b.dataset.kind);
      case 'del': return delRow(p);
      case 'up': return moveRow(p, -1);
      case 'down': return moveRow(p, 1);
      case 'addSection': return addSection();
      case 'starter': return starter();
      case 'save': return save();
      case 'reload': return reload();
      case 'preview': return preview();
      case 'exportJson': return exportJson();
      case 'exportXlsx': return exportXlsx();
      case 'importJson': return pickFile('json');
      case 'importXlsx': return pickFile('xlsx');
    }
  }
  function onBeforeUnload(e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } }

  // ── Thao tác danh sách ──
  function addRow(listPath, kind) {
    const arr = HS.getPath(st.doc, listPath);
    if (!Array.isArray(arr) || !HS.SPEC[kind]) return;
    const obj = HS.blank(kind);
    arr.push(obj);
    st.open.add(obj);
    st.focus = `${listPath}[${arr.length - 1}].`;
    paint();
    touched();
  }
  async function delRow(p) {
    const [listPath, i] = splitIdx(p);
    const arr = listPath && HS.getPath(st.doc, listPath);
    if (!Array.isArray(arr) || !arr[i]) return;
    const it = arr[i];
    const isSec = listPath === 'sections';
    const hasChildren = Object.keys(it).some(k => Array.isArray(it[k]) && it[k].length);
    if (isSec || hasChildren) {
      const name = isSec ? `mục "${it.title || it.id}"` : `"${summaryOf(Array.isArray(it.items) ? 'day' : 'dress', it)}"`;
      const ok = await confirmBox({ title: 'Xoá ' + name + '?', message: 'Xoá cả nội dung bên trong. Chỉ mất thật khi bấm Lưu (bấm Tải lại để huỷ).', confirmText: 'Xoá', danger: true });
      if (!ok || !st) return;
    }
    arr.splice(i, 1);
    st.errors = [];
    paint();
    touched();
  }
  function moveRow(p, dir) {
    const [listPath, i] = splitIdx(p);
    const arr = listPath && HS.getPath(st.doc, listPath);
    const j = i + dir;
    if (!Array.isArray(arr) || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    st.errors = [];
    paint();
    touched();
  }
  function newSection(type) {
    const info = TYPE_INFO[type];
    return HS.blankSection(type, HS.uniqueId(type, st.doc.sections.map(s => s.id)), { title: info.title, icon: info.icon });
  }
  function addSection() {
    const sel = st.el.querySelector('[data-new-type]');
    const type = sel && HS.TYPES[sel.value] ? sel.value : 'text';
    if (st.doc.sections.length >= HS.MAX_SECTIONS) return;
    const sec = newSection(type);
    st.doc.sections.push(sec);
    st.open.add(sec);
    st.focus = `sections[${st.doc.sections.length - 1}].`;
    paint();
    touched();
  }
  // Khung mẫu cho sự kiện mới: 4 mục thường dùng, mỗi mục 1 dòng trống.
  function starter() {
    const d = st.doc;
    if (!d.hero.title && st.cfgTitle) d.hero.title = st.cfgTitle;
    const tl = newSection('timeline'); d.sections.push(tl);
    tl.days.push(Object.assign(HS.blank('day'), { label: 'NGÀY 01', items: [HS.blank('tlItem')] }));
    const no = newSection('notes'); d.sections.push(no); no.items.push(HS.blank('note'));
    const dr = newSection('dresscode'); d.sections.push(dr); dr.items.push(Object.assign(HS.blank('dress'), { colors: [HS.blank('color')] }));
    const tp = newSection('transport'); d.sections.push(tp); tp.info.push(HS.blank('info')); tp.contacts.push(HS.blank('contact'));
    [tl, no, dr, tp, tl.days[0], dr.items[0]].forEach(o => st.open.add(o));
    paint();
    touched();
  }

  // ── Đọc / ghi Firestore ──
  async function load() {
    const my = st;
    my.loaded = false;
    my.loadError = '';
    paint();
    try {
      const [homeSnap, cfgSnap] = await Promise.all([HS.homeRef(my.db, my.eventId).get(), HS.configRef(my.db, my.eventId).get()]);
      if (st !== my) return;                              // đã unmount / mount sự kiện khác trong lúc chờ
      my.cfgTitle = cfgSnap.exists ? String((cfgSnap.data() || {}).title || '') : '';
      my.exists = homeSnap.exists;
      const r = HS.validate(homeSnap.exists ? homeSnap.data() : {});
      my.doc = r.doc;
      my.savedJson = json(r.doc);
      my.errors = r.errors.filter(e => e.path !== 'v');
      my.warnings = r.warnings;
      my.readOnly = r.errors.some(e => e.path === 'v');
      my.rawErr = new Map();
      my.importIssues = [];
      my.open = new WeakSet();
      my.loaded = true;
      my.status = { kind: 'ok', text: homeSnap.exists ? 'Đã tải bản đang dùng' : 'Chưa có trang home — soạn rồi bấm Lưu' };
      paint();
    } catch (err) {
      if (st !== my) return;
      my.loadError = 'Không tải được dữ liệu: ' + errMsg(err);
      paint();
    }
  }
  function errMsg(err) {
    const c = (err && err.code) || '';
    if (c === 'permission-denied') return 'không có quyền (cần đăng nhập tài khoản admin)';
    if (c === 'unavailable' || c === 'deadline-exceeded') return 'lỗi mạng — kiểm tra kết nối rồi thử lại';
    return (err && err.message) || String(err);
  }
  async function save() {
    const my = st;
    if (!my || my.busy || my.readOnly) return;
    if (my.rawErr.size) { paint(); setStatus('err', 'Chưa lưu — JSON của mục chưa hợp lệ'); return; }
    const r = HS.validate(my.doc);
    my.errors = r.errors;
    my.warnings = r.warnings;
    my.importIssues = [];
    if (!r.ok) {
      paint();
      setStatus('err', `Chưa lưu — ${r.errors.length} lỗi cần sửa`);
      const first = my.el.querySelector('.is-invalid');
      if (first) { first.scrollIntoView({ block: 'center' }); first.focus({ preventScroll: true }); }
      return;
    }
    my.busy = true;
    setStatus('busy', 'Đang lưu…');
    try {
      await HS.homeRef(my.db, my.eventId).set(r.doc);     // TRỌN doc, không merge
      if (st !== my) return;
      my.doc = r.doc;
      my.savedJson = json(r.doc);
      my.exists = true;
      my.busy = false;
      paint();
      setStatus('ok', 'Đã lưu lúc ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      if (st !== my) return;
      my.busy = false;
      setStatus('err', 'Lưu thất bại: ' + errMsg(err));
    }
  }
  async function reload() {
    if (st.loaded && isDirty()) {
      const ok = await confirmBox({ title: 'Bỏ các thay đổi chưa lưu?', message: 'Nội dung sẽ được tải lại từ bản đang dùng.', confirmText: 'Tải lại', danger: true });
      if (!ok || !st) return;
    }
    await load();
  }
  function preview() {
    window.open(`${st.previewBase}${PREVIEW_PAGE}?e=${encodeURIComponent(st.eventId)}`, '_blank', 'noopener');
    if (isDirty()) setStatus('info', 'Trang xem trước hiển thị bản ĐÃ LƯU — bấm Lưu để thấy thay đổi');
  }

  // ── Nạp / xuất file ──
  function download(data, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  function exportJson() {
    download(JSON.stringify(current(), null, 2) + '\n', `${FILE_PREFIX}${st.eventId}.json`, 'application/json');
    setStatus('info', 'Đã xuất file JSON (nội dung đang soạn)');
  }
  function exportXlsx() {
    if (!root.XLSX) { setStatus('err', 'Thiếu thư viện Excel (XLSX)'); return; }
    root.XLSX.writeFile(SH.toWorkbook(root.XLSX, current()), `${FILE_PREFIX}${st.eventId}.xlsx`);
    setStatus('info', 'Đã xuất file Excel (nội dung đang soạn)');
  }
  function pickFile(kind) {
    const inp = st.el.querySelector(`[data-file="${kind}"]`);
    if (!inp) return;
    inp.value = '';
    inp.click();
  }
  async function handleFile(input) {
    const my = st;
    const f = input.files && input.files[0];
    if (!f) return;
    const kind = input.dataset.file;
    if (isDirty()) {
      const ok = await confirmBox({ title: 'Thay nội dung đang soạn?', message: 'Các thay đổi chưa lưu sẽ bị thay bằng nội dung của file.', confirmText: 'Nạp file' });
      if (!ok || st !== my) return;
    }
    try {
      let raw, sheetWarns = [];
      if (kind === 'json') {
        raw = JSON.parse(await f.text());
      } else {
        if (!root.XLSX) throw new Error('thiếu thư viện Excel (XLSX)');
        const res = SH.fromWorkbook(root.XLSX, root.XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' }));
        if (res.errors.length) {
          my.importIssues = res.errors.map(x => `Sheet "${x.sheet}"${x.row ? ' dòng ' + x.row : ''}: ${x.msg}`);
          paint();
          setStatus('err', `File ${f.name} có lỗi — chưa nạp`);
          return;
        }
        raw = res.doc;
        sheetWarns = res.warnings;
      }
      const r = HS.validate(raw);
      if (r.errors.some(e => e.path === 'v')) { setStatus('err', 'File dùng schema mới hơn bản trình soạn này — không nạp'); return; }
      my.doc = r.doc;
      my.errors = r.errors;
      my.warnings = r.warnings.concat(sheetWarns);
      my.rawErr = new Map();
      my.importIssues = [];
      my.open = new WeakSet();
      paint();
      setStatus(r.ok ? 'info' : 'err', r.ok ? `Đã nạp ${f.name} — kiểm tra rồi bấm Lưu` : `Đã nạp ${f.name} — còn ${r.errors.length} lỗi cần sửa trước khi lưu`);
    } catch (err) {
      setStatus('err', `Không đọc được ${f.name}: ${err.message}`);
    }
  }

  // Hộp xác nhận dùng class .cm-* của admin.css.
  function confirmBox({ title, message, confirmText = 'Đồng ý', cancelText = 'Huỷ', danger = false }) {
    return new Promise(resolve => {
      const bg = document.createElement('div');
      bg.className = 'cm-bg he-cm';
      bg.innerHTML = `<div class="cm-box" role="dialog" aria-modal="true"><h3 class="cm-title"></h3><p class="cm-msg"></p><div class="cm-row"><button type="button" class="cm-cancel"></button><button type="button" class="cm-confirm${danger ? ' danger' : ''}"></button></div></div>`;
      bg.querySelector('.cm-title').textContent = title;
      bg.querySelector('.cm-msg').textContent = message || '';
      const cancel = bg.querySelector('.cm-cancel'), ok = bg.querySelector('.cm-confirm');
      cancel.textContent = cancelText;
      ok.textContent = confirmText;
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
      function done(v) { document.removeEventListener('keydown', onKey, true); bg.remove(); resolve(v); }
      bg.addEventListener('click', e => { if (e.target === bg) done(false); });
      cancel.addEventListener('click', () => done(false));
      ok.addEventListener('click', () => done(true));
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(bg);
      ok.focus();
    });
  }

  // ── API ──
  async function mount(el, opts) {
    unmount();
    const o = opts || {};
    if (!HS || !SH) throw new Error('HomeEditor cần js/home/home-schema.js + js/home/home-sheets.js nạp trước');
    if (!el || !o.db || !HS.EVENT_ID_RE.test(String(o.eventId || ''))) throw new Error('HomeEditor.mount(el, { db, eventId }): thiếu el/db hoặc eventId không hợp lệ');
    st = {
      el, db: o.db, eventId: o.eventId, previewBase: typeof o.previewBase === 'string' ? o.previewBase : '',
      doc: HS.normalize({}), savedJson: '', exists: false, cfgTitle: '', loaded: false, loadError: '', readOnly: false, busy: false,
      errors: [], warnings: [], importIssues: [], rawErr: new Map(), open: new WeakSet(), focus: '', status: { kind: 'load', text: '' },
    };
    el.classList.add('he');
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    el.addEventListener('click', onClick);
    el.addEventListener('toggle', onToggle, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    await load();
  }
  function unmount() {
    if (!st) return;
    const s = st;
    st = null;
    cancelAnimationFrame(rafId);
    s.el.removeEventListener('input', onInput);
    s.el.removeEventListener('change', onChange);
    s.el.removeEventListener('click', onClick);
    s.el.removeEventListener('toggle', onToggle, true);
    window.removeEventListener('beforeunload', onBeforeUnload);
    s.el.classList.remove('he');
    s.el.innerHTML = '';
  }
  function getDoc() { return st && st.loaded ? JSON.parse(json(current())) : null; }
  function setDoc(doc) {
    if (!st || !st.loaded) return null;
    const r = HS.validate(doc);
    st.doc = r.doc;
    st.errors = r.errors;
    st.warnings = r.warnings;
    st.open = new WeakSet();
    paint();
    return { ok: r.ok, errors: r.errors };
  }

  root.HomeEditor = { mount, unmount, isDirty, getDoc, setDoc, get eventId() { return st ? st.eventId : ''; } };
})(typeof self !== 'undefined' ? self : this);
