// ============================================================================
// home-render.js — dựng HTML trang home từ doc meta/home ĐÃ normalize (HomeSchema.normalize).
// Markup giữ đúng class của travel.html/travel.js ⇒ dùng lại nguyên travel/travel.css (+ theme tech / biến thể tnt).
// QUY TẮC AN TOÀN: mọi chuỗi đi qua esc(); URL qua HomeSchema.isSafeUrl; màu qua HEX_RE; chỉ field *Html
// mới vẽ HTML và phải qua sanitizeHtml(). Hàm thuần (trừ sanitizeHtml cần DOM) ⇒ test được trong Node.
// Chỉ lộ 1 tên toàn cục: HomeRender.
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./home-schema.js'));
  else root.HomeRender = factory(root.HomeSchema);
})(typeof self !== 'undefined' ? self : this, function (HS) {
  'use strict';

  // Icon: mặc định khi field icon để trống lấy từ HomeSchema.DEFAULT_ICON (dùng chung với trình soạn);
  // phần còn lại là icon trang trí cố định của template.
  const ICON = Object.assign({}, HS.DEFAULT_ICON, { time: '⏰', tip: '💡', infoCard: '🚍', contacts: '📞', call: '📞', lead: '👤' });
  // Đoán màu nhãn hoạt động khi tone = "" (giữ nguyên luật của travel.js, thêm vài từ tiếng Anh).
  const TONE_WORDS = [
    ['food', ['ăn', 'ẩm thực', 'tiệc', 'food', 'meal', 'lunch', 'dinner', 'breakfast', 'party']],
    ['gala', ['gala', 'đêm', 'night']],
    ['game', ['team', 'game', 'khám phá', 'explore']],
    ['move', ['xe', 'chuyển', 'tập trung', 'bus', 'transfer', 'move', 'gather']],
  ];
  // Thẻ được giữ trong field *Html (mọi thuộc tính bị bỏ, trừ href an toàn của <a>).
  const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SMALL', 'MARK', 'BR', 'P', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN', 'HR', 'A']);
  // Thẻ bị xoá CẢ nội dung (thẻ lạ khác chỉ bị bóc vỏ, giữ chữ bên trong).
  const DROP_TAGS = /^(script|style|iframe|frame|frameset|object|embed|template|noscript|textarea|select|option|button|input|form|svg|math|link|meta|base|img|video|audio|source|canvas|title|head)$/i;
  const LIGHT_LUMA = 0.8;   // màu sáng hơn ngưỡng này luôn có viền (chấm trắng trên nền sáng)

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  // Escape + giữ xuống dòng của văn bản nhiều dòng.
  const escBr = v => esc(v).replace(/\n/g, '<br>');

  function toneOf(item) {
    if (item.tone && HS.TONES.includes(item.tone)) return item.tone;
    const t = String(item.tag || '').toLowerCase();
    if (!t) return '';
    for (const [tone, words] of TONE_WORDS) if (words.some(w => t.includes(w))) return tone;
    return '';
  }
  const toneClass = item => { const t = toneOf(item); return t ? 'tag-' + t : ''; };

  // Số điện thoại → phần dùng cho tel: (chỉ chữ số và +).
  const telOf = phone => String(phone || '').replace(/[^0-9+]/g, '');

  function isLight(hex) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const lin = i => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4) > LIGHT_LUMA;
  }

  // Lọc HTML theo danh sách trắng (cần DOM: <template> không chạy script/không tải ảnh khi parse).
  function sanitizeHtml(html) {
    if (typeof document === 'undefined') return escBr(html);
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html == null ? '' : html);
    (function clean(node) {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1 || DROP_TAGS.test(ch.nodeName)) { ch.remove(); return; }
        if (!ALLOWED_TAGS.has(ch.nodeName)) { clean(ch); ch.replaceWith(...Array.from(ch.childNodes)); return; }
        Array.from(ch.attributes).forEach(a => {
          const keep = ch.nodeName === 'A' && a.name.toLowerCase() === 'href'
            && (HS.isSafeUrl(a.value.trim()) || /^(mailto|tel):[^\s"'<>]+$/i.test(a.value.trim()));
          if (!keep) ch.removeAttribute(a.name);
        });
        if (ch.nodeName === 'A' && ch.hasAttribute('href')) { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
        clean(ch);
      });
    })(tpl.content);
    return tpl.innerHTML;
  }

  // ── Hero ── ctx: { S, ctaHref, cfgTitle, hasNav }
  function hero(home, ctx) {
    const h = home.hero, c = home.cta, S = ctx.S;
    const dateText = h.date && h.duration ? `${h.date} (${h.duration})` : (h.date || h.duration);
    const chips = [[h.dateIcon || ICON.date, dateText], [h.locationIcon || ICON.location, h.location], [h.venueIcon || ICON.venue, h.venue]]
      .filter(x => x[1]);
    let out = '';
    if (h.badge) out += `<div class="hero-anim-1"><span class="hero-pill-badge">${esc(h.badge)}</span></div>`;
    out += `<div class="hero-anim-2"><h1>${esc(h.title || ctx.cfgTitle || '')}</h1></div>`;
    if (h.subtitle) out += `<div class="hero-anim-3"><p class="hero-tagline">${esc(h.subtitle)}</p></div>`;
    if (h.imageUrl && HS.isSafeUrl(h.imageUrl)) {
      out += `<div class="hero-anim-3"><img class="home-hero-img" src="${esc(h.imageUrl)}" alt="${esc(h.imageAlt)}" decoding="async"></div>`;
    }
    if (chips.length) {
      out += `<div class="hero-meta-grid hero-anim-4">${chips.map(([ic, t]) =>
        `<div class="meta-chip"><span class="chip-icon">${esc(ic)}</span><span>${esc(t)}</span></div>`).join('')}</div>`;
    }
    const btns = [];
    if (ctx.hasNav) {
      btns.push(`<a href="#schedule" class="cta-btn btn-schedule" id="btnCtaSchedule"><span class="btn-ic">${esc(c.scheduleIcon || ICON.schedule)}</span><span>${esc(c.scheduleLabel || S.scheduleCta)}</span></a>`);
    }
    btns.push(`<a href="${esc(ctx.ctaHref)}" class="cta-btn btn-rooms" id="btnCtaRooms">${c.icon ? `<span class="btn-ic">${esc(c.icon)}</span>` : ''}<span>${esc(c.label || S.roomsCta)}</span></a>`);
    out += `<div class="hero-cta-group hero-anim-5">${btns.join('')}</div>`;
    return out;
  }

  // ── Thân từng type (trả '' khi không có nội dung ⇒ mục bị ẩn) ──
  const BODY = {
    timeline(sec, S, domId) {
      const days = sec.days;
      if (!days.length) return '';
      const pill = d => d.label && d.date ? `${d.label} (${d.date})` : (d.label || d.date || d.title);
      const head = d => [d.label, d.date].filter(Boolean).join(' • ');
      const switcher = `<div class="day-switcher" role="tablist">${days.map((d, i) =>
        `<button type="button" class="day-pill-btn${i === 0 ? ' active' : ''}" role="tab" aria-selected="${i === 0}" data-day-target="${esc(domId)}-d${i + 1}">${esc(pill(d))}</button>`).join('')}</div>`;
      const blocks = days.map((d, i) => `<div class="day-block${i === 0 ? ' active' : ''}" id="${esc(domId)}-d${i + 1}">
          <div class="day-header-card reveal-on-scroll"><div class="dh-top"><span class="dh-label">${esc(head(d))}</span><span class="dh-title">${esc(d.title)}</span></div>${d.summary ? `<p class="dh-summary">${escBr(d.summary)}</p>` : ''}</div>
          <div class="timeline-list">${d.items.map(it => `<div class="timeline-item reveal-on-scroll"><div class="timeline-card">
            <div class="tl-meta">${it.time ? `<span class="tl-time-badge">${ICON.time} ${esc(it.time)}</span>` : ''}${it.tag ? `<span class="tl-tag ${toneClass(it)}">${esc(it.tag)}</span>` : ''}</div>
            <h3 class="tl-title">${esc(it.icon || ICON.item)} ${esc(it.title)}</h3>${it.desc ? `<p class="tl-desc">${escBr(it.desc)}</p>` : ''}
          </div></div>`).join('')}</div>
        </div>`).join('');
      return switcher + blocks;
    },

    notes(sec) {
      if (!sec.items.length) return '';
      return `<div class="notes-grid">${sec.items.map(n => `<div class="note-card reveal-on-scroll">
          <div class="note-top"><span class="note-ic">${esc(n.icon || ICON.note)}</span>${n.badge ? `<span class="note-badge">${esc(n.badge)}</span>` : ''}</div>
          <h3 class="note-title">${esc(n.title)}</h3>${n.desc ? `<p class="note-desc">${escBr(n.desc)}</p>` : ''}
        </div>`).join('')}</div>`;
    },

    dresscode(sec, S) {
      if (!sec.items.length) return '';
      const chip = c => {
        const hex = HS.HEX_RE.test(c.hex) ? c.hex : '';
        const border = c.border || (hex && isLight(hex));
        return `<div class="color-chip" title="${esc(c.name)}${hex ? ` (${esc(hex)})` : ''}"><span class="color-dot${border ? ' has-border' : ''}"${hex ? ` style="background-color: ${hex}"` : ''}></span><span>${esc(c.name)}</span></div>`;
      };
      return `<div class="dresscode-grid">${sec.items.map(d => `<div class="dress-card reveal-on-scroll${d.featured ? ' highlight-gala' : ''}">
          ${d.day ? `<div class="dress-day-badge">${esc(d.day)}</div>` : ''}${d.time ? `<div class="dress-time">${ICON.time} ${esc(d.time)}</div>` : ''}
          <h3 class="dress-highlight">${esc(d.highlight)}</h3>${d.desc ? `<p class="dress-desc">${escBr(d.desc)}</p>` : ''}
          ${d.colors.length ? `<div class="color-swatches-wrap"><div class="color-swatches-label">${esc(S.colorsLabel)}</div><div class="color-chips">${d.colors.map(chip).join('')}</div></div>` : ''}
          ${d.tip ? `<div class="dress-tip">${ICON.tip} <strong>${esc(S.tipLabel)}</strong> ${escBr(d.tip)}</div>` : ''}
        </div>`).join('')}</div>`;
    },

    transport(sec, S) {
      const hasLeft = sec.info.length || sec.vehicles.length;
      const left = !hasLeft ? '' : `<div class="info-card reveal-on-scroll">
          <h3 class="info-card-title"><span>${ICON.infoCard}</span><span>${esc(sec.infoTitle || S.infoTitle)}</span></h3>
          ${sec.info.length ? `<div class="info-list">${sec.info.map(r => `<div class="info-row"><span class="info-icon">${esc(r.icon || ICON.infoRow)}</span><div class="info-text">${r.label ? `<strong>${esc(r.label)}</strong>` : ''}<p>${escBr(r.text)}</p></div></div>`).join('')}</div>` : ''}
          ${sec.vehicles.length ? `<div class="bus-cards-wrap">${sec.vehicles.map(b => `<div class="bus-chip">
            <div>${b.name ? `<span class="bus-num">${esc(b.name)}:</span> ` : ''}<span class="bus-detail">${esc(b.label)}</span>${b.lead ? `<span class="bus-lead">${ICON.lead} ${esc(b.lead)}</span>` : ''}</div>
            ${b.plate ? `<div class="home-bus-right"><span class="bus-plate">${esc(b.plate)}</span></div>` : ''}
          </div>`).join('')}</div>` : ''}
        </div>`;
      const right = !sec.contacts.length ? '' : `<div class="info-card reveal-on-scroll">
          <h3 class="info-card-title"><span>${ICON.contacts}</span><span>${esc(sec.contactsTitle || S.contactsTitle)}</span>${sec.contactsBadge ? `<span class="live-badge"><span class="live-dot"></span><span>${esc(sec.contactsBadge)}</span></span>` : ''}</h3>
          ${sec.contactsNote ? `<p class="home-contacts-note">${escBr(sec.contactsNote)}</p>` : ''}
          <div class="hotline-grid">${sec.contacts.map(hl => {
            const tel = telOf(hl.phone);
            return `<div class="hotline-card"><div class="hotline-info">${hl.role ? `<span class="hl-role">${esc(hl.role)}</span>` : ''}<span class="hl-name">${esc(hl.name)}</span>${hl.duty ? `<span class="hl-duty">${esc(hl.duty)}</span>` : ''}</div>
              ${tel ? `<a href="tel:${esc(tel)}" class="hl-call-btn" title="${esc(S.callTitle(hl.name))}"><span class="call-ic">${ICON.call}</span><span>${esc(hl.phone)}</span></a>` : ''}</div>`;
          }).join('')}</div>
        </div>`;
      if (!left && !right) return '';
      return `<div class="transport-layout${left && right ? '' : ' is-single'}">${left}${right}</div>`;
    },

    text(sec) {
      if (sec.bodyHtml) return `<div class="info-card home-text reveal-on-scroll">${sanitizeHtml(sec.bodyHtml)}</div>`;
      if (!sec.body) return '';
      return `<div class="info-card home-text reveal-on-scroll">${sec.body.split(/\n{2,}/).map(p => `<p>${escBr(p)}</p>`).join('')}</div>`;
    },
  };

  // Dựng cả trang. Trả các khối HTML + số mục thực sự hiện (để ẩn mục lục/nút "Xem lịch trình" khi 0).
  // ctx: { S, ctaHref, cfgTitle }
  function build(home, ctx) {
    const shown = [];
    for (const sec of home.sections) {
      const fn = BODY[sec.type];
      if (!fn) continue;                                  // type lạ: bỏ qua (dữ liệu vẫn giữ trong Firestore)
      const domId = 'sec-' + sec.id;
      const body = fn(sec, ctx.S, domId);
      if (body) shown.push({ sec, domId, body });
    }
    const nav = shown.map((x, i) => `<a href="#${esc(x.domId)}" class="nav-anchor-tab${i === 0 ? ' active' : ''}" data-target="${esc(x.domId)}"><span>${esc(x.sec.icon || ICON.section)}</span><span>${esc(x.sec.navLabel || x.sec.title)}</span></a>`).join('');
    const sections = shown.map(x => `<section class="travel-section home-sec-${esc(x.sec.type)}" id="${esc(x.domId)}">
        <div class="sec-head"><div class="sec-icon-wrap">${esc(x.sec.icon || ICON.section)}</div><h2>${esc(x.sec.title)}</h2><div class="sec-divider"></div></div>
        <div class="sec-body">${x.body}</div>
      </section>`).join('');
    const f = home.footer;
    const footer = (f.text ? `<p class="footer-copy">${esc(f.text)}</p>` : '') + (f.subtext ? `<p class="footer-sub">${esc(f.subtext)}</p>` : '');
    return { hero: hero(home, Object.assign({ hasNav: shown.length > 0 }, ctx)), nav, sections, footer, count: shown.length };
  }

  return { ICON, esc, escBr, toneOf, telOf, isLight, sanitizeHtml, hero, build, BODY };
});
