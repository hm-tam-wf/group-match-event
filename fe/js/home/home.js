// ============================================================================
// home.js — controller trang home dùng chung (fe/home.html)
// ----------------------------------------------------------------------------
// 1. Chọn sự kiện (hợp đồng §3): ?e=<id> (sai định dạng ⇒ màn "không tìm thấy") → config/hosts.byHost[hostname]
//    → config/active.eventId.
// 2. Đọc events/{id}/meta/home + meta/config SONG SONG; áp profile.variant/lang/brand (thiếu key = như trang sự kiện).
// 3. Vẽ bằng HomeRender (loader che tới khi có dữ liệu ⇒ không FOUC), rồi gắn tương tác như travel.js:
//    cuộn mượt có bù mục lục bám dính, scrollspy, đổi ngày, nút lên đầu trang, hiệu ứng rời trang.
// Bọc IIFE, KHÔNG khai tên toàn cục nào: theme.js/config.js (bước 2) khai VARIANT_ID_RE, EVENT_ID_RE, VARIANT_PARAM,
// eventIdFromUrl, setActiveVariant, AVAILABLE_VARIANTS, DEFAULT_BRAND, DEFAULT_LANG… ⇒ chỉ đọc kiểu phòng thủ
// (typeof … !== "undefined"); chưa có (master trước bước 2) thì dùng FALLBACK_* bên dưới.
// ============================================================================
(function () {
  'use strict';

  const HS = window.HomeSchema, HR = window.HomeRender, STR = window.HomeStrings;
  const visit = window.HomeVisit || { KEY: '', returning: false };   // khai inline trong <head> của home.html

  // ── Hằng ──
  const EVENT_PAGE = 'index.html';                     // trang sự kiện; CTA mặc định = index.html?e=<id>
  const CFG_COL = 'config', CFG_HOSTS = 'hosts', CFG_ACTIVE = 'active';
  const CARRY_PARAMS = ['lang', 'variant'];            // giữ khi sang trang sự kiện (xem trước ?variant= / ?lang=)
  const LANGS = ['vi', 'en'];
  const FETCH_TIMEOUT_MS = 15000;
  const LOADER_MIN_MS = 600;                           // lần mở đầu: giữ loader tối thiểu để không chớp
  const LOADER_EASE_MS = 900;                          // thanh tiến trình chạy dần tới LOADER_CAP trong lúc chờ mạng
  const LOADER_CAP = 90;
  const LOADER_STEP_AT = [0, 35, 70];                  // % đổi dòng trạng thái (HomeStrings.*.loaderSteps)
  const LOADER_HIDE_MS = 150;
  const STICKY_GAP_PX = 16, SPY_OFFSET_PX = 140, BOTTOM_SLACK_PX = 50, BACK_TOP_AFTER_PX = 450;
  const EXIT_MS = 150;
  const MSG_ICON = { noEvent: '🔍', noHome: '🗓️', network: '📡' };
  // Dự phòng khi config.js/theme.js chưa có bản bước 2 (giá trị = hợp đồng §2). Có bản thật thì bản thật thắng.
  const FALLBACK_VARIANTS = [{ id: 'tnt', theme: 'tech', defaultLang: 'vi' }];
  const FALLBACK_BRAND = { name: 'FARADAY', logoUrl: 'themes/tech/img/LOGO.png', logoAlt: 'Faraday Icon' };
  const FALLBACK_LANG = 'en';
  const FALLBACK_VARIANT_RE = /^[a-z0-9-]{0,32}$/;

  const $ = id => document.getElementById(id);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const params = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
  const reduced = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  // ── Đọc global của theme.js/config.js kiểu phòng thủ ──
  const eventIdRe = () => (typeof EVENT_ID_RE !== 'undefined' && EVENT_ID_RE instanceof RegExp ? EVENT_ID_RE : HS.EVENT_ID_RE);
  const variantList = () => (typeof AVAILABLE_VARIANTS !== 'undefined' && Array.isArray(AVAILABLE_VARIANTS) ? AVAILABLE_VARIANTS : FALLBACK_VARIANTS);
  const defaultVariant = () => (typeof DEFAULT_VARIANT === 'string' ? DEFAULT_VARIANT : '');
  const findVariant = id => (id ? variantList().find(v => v && v.id === id) || null : null);

  function urlEvent() {
    if (typeof eventIdFromUrl === 'function') {
      try { const r = eventIdFromUrl(); if (isObj(r)) return { given: !!r.given, id: typeof r.id === 'string' ? r.id : '' }; } catch (e) {}
    }
    if (!params.has('e')) return { given: false, id: '' };
    const v = params.get('e') || '';
    return { given: true, id: eventIdRe().test(v) ? v : '' };
  }
  // null = URL không có ?variant= · "" = ép tắt biến thể · id
  function urlVariant() {
    if (typeof VARIANT_PARAM !== 'undefined') return VARIANT_PARAM;
    if (!params.has('variant')) return null;
    const re = typeof VARIANT_ID_RE !== 'undefined' && VARIANT_ID_RE instanceof RegExp ? VARIANT_ID_RE : FALLBACK_VARIANT_RE;
    const v = params.get('variant') || '';
    return re.test(v) ? v : null;
  }
  const urlLang = () => { const l = params.get('lang'); return LANGS.includes(l) ? l : ''; };
  function defaultLangFor(vdef) {
    if (vdef && LANGS.includes(vdef.defaultLang)) return vdef.defaultLang;
    return typeof DEFAULT_LANG === 'string' && LANGS.includes(DEFAULT_LANG) ? DEFAULT_LANG : FALLBACK_LANG;
  }
  // Ngôn ngữ tạm cho loader (chưa đọc hồ sơ): ?lang= → biến thể đang áp (URL/mặc định) → mặc định.
  function provisionalLang() {
    const uv = urlVariant();
    return urlLang() || defaultLangFor(findVariant(uv !== null ? uv : defaultVariant()));
  }

  // ── Áp giao diện + ngôn ngữ theo meta/config.profile (hợp đồng §2; key thiếu = như trang sự kiện) ──
  function applyLook(profile) {
    const p = isObj(profile) ? profile : {};
    const uv = urlVariant();
    let vid = uv !== null ? uv : hasOwn(p, 'variant') ? str(p.variant) : defaultVariant();
    const vdef = findVariant(vid);
    if (!vdef) vid = '';                                   // "" hoặc id lạ ⇒ theme gốc
    const rootEl = document.documentElement;
    if (vdef && str(vdef.theme)) rootEl.setAttribute('data-theme', vdef.theme);
    if (typeof setActiveVariant === 'function') setActiveVariant(vid);
    else if (vid) rootEl.setAttribute('data-variant', vid);
    else rootEl.removeAttribute('data-variant');
    const lang = urlLang() || (LANGS.includes(p.lang) ? p.lang : '') || defaultLangFor(vdef);
    rootEl.lang = lang;
    return { lang, variant: vid, brand: resolveBrand(p) };
  }
  function resolveBrand(p) {
    const def = typeof DEFAULT_BRAND !== 'undefined' && isObj(DEFAULT_BRAND) ? DEFAULT_BRAND : FALLBACK_BRAND;
    const b = hasOwn(p, 'brand') && isObj(p.brand) ? p.brand : def;
    const logoUrl = str(b.logoUrl);
    return { name: str(b.name), logoUrl: HS.isSafeUrl(logoUrl) ? logoUrl : '', logoAlt: str(b.logoAlt) };
  }
  function paintBrand(brand) {
    const box = $('homeBrand');
    if (!box) return;
    if (!brand.name && !brand.logoUrl) { box.hidden = true; return; }   // name:"" + logoUrl:"" ⇒ ẩn khối logo
    const img = box.querySelector('.logo-icon'), txt = box.querySelector('.logo-text');
    img.hidden = !brand.logoUrl;
    if (brand.logoUrl) { img.src = brand.logoUrl; img.alt = brand.logoAlt || brand.name; }
    txt.textContent = brand.name;
    txt.hidden = !brand.name;
    box.hidden = false;
  }

  function eventHref(eventId) {
    const q = new URLSearchParams();
    q.set('e', eventId);
    CARRY_PARAMS.forEach(k => { if (params.has(k)) q.set(k, params.get(k)); });
    return EVENT_PAGE + '?' + q.toString();
  }

  function withTimeout(promise, ms) {
    let t;
    const timer = new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms); });
    return Promise.race([promise, timer]).finally(() => clearTimeout(t));
  }

  async function resolveEventId() {
    const ue = urlEvent();
    if (ue.given) return ue.id;                          // ?e= sai định dạng ⇒ "" (KHÔNG rơi về hosts/active)
    const cfg = db.collection(CFG_COL);
    const [hostsSnap, activeSnap] = await Promise.all([cfg.doc(CFG_HOSTS).get(), cfg.doc(CFG_ACTIVE).get()]);
    const re = eventIdRe();
    const hosts = hostsSnap.exists ? hostsSnap.data() : null;
    const byHost = hosts && isObj(hosts.byHost) ? hosts.byHost : null;
    const h = byHost && hasOwn(byHost, location.hostname) ? str(byHost[location.hostname]) : '';
    if (h && re.test(h)) return h;
    const a = activeSnap.exists ? str((activeSnap.data() || {}).eventId) : '';
    return re.test(a) ? a : '';
  }

  // ── Loader ──
  const loader = { raf: 0, t0: 0, S: null };
  function paintPct(pct) {
    const bar = $('loaderBar'), pctEl = $('loaderPercent'), stEl = $('loaderStatus');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (stEl && loader.S) {
      let i = 0;
      LOADER_STEP_AT.forEach((at, k) => { if (pct >= at) i = k; });
      const t = pct >= 100 ? loader.S.loaderReady : loader.S.loaderSteps[i];
      if (stEl.textContent !== t) stEl.textContent = t;
    }
  }
  function startLoader(S) {
    loader.S = S;
    loader.t0 = performance.now();
    const brandEl = $('loaderBrand');
    if (brandEl) brandEl.textContent = S.loaderBrand;
    paintPct(0);
    if (reduced) return;
    const tick = now => {
      paintPct(Math.floor(LOADER_CAP * (1 - Math.exp(-(now - loader.t0) / LOADER_EASE_MS))));
      loader.raf = requestAnimationFrame(tick);
    };
    loader.raf = requestAnimationFrame(tick);
  }
  function hideLoader() {
    cancelAnimationFrame(loader.raf);
    const el = $('homeLoader');
    if (el) { el.classList.add('fade-out'); el.hidden = true; }
  }
  async function finishLoader() {
    cancelAnimationFrame(loader.raf);
    paintPct(100);
    const rest = visit.returning || reduced ? 0 : Math.max(0, LOADER_MIN_MS - (performance.now() - loader.t0)) + LOADER_HIDE_MS;
    if (rest) await sleep(rest);
    hideLoader();
  }

  // ── Màn thông báo (thiếu dữ liệu / lỗi mạng) — chữ qua textContent, không chèn HTML ──
  function showMsg(kind, S, eventId) {
    hideLoader();
    const m = S.msg;
    const conf = {
      noEvent: { title: m.noEventTitle, text: m.noEventText },
      noHome: { title: m.noHomeTitle, text: m.noHomeText, link: eventId ? { href: eventHref(eventId), label: m.noHomeCta } : null },
      network: { title: m.netTitle, text: m.netText, retry: m.retry },
    }[kind];
    const box = $('homeMsg');
    box.querySelector('.home-msg-ic').textContent = MSG_ICON[kind];
    box.querySelector('.home-msg-title').textContent = conf.title;
    box.querySelector('.home-msg-text').textContent = conf.text;
    const actions = box.querySelector('.home-msg-actions');
    actions.textContent = '';
    if (conf.link) {
      const a = document.createElement('a');
      a.className = 'cta-btn btn-rooms';
      a.id = 'msgCta';
      a.href = conf.link.href;
      a.textContent = conf.link.label;
      actions.appendChild(a);
    }
    if (conf.retry) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cta-btn btn-schedule';
      b.id = 'msgRetry';
      b.textContent = conf.retry;
      b.addEventListener('click', () => location.reload());
      actions.appendChild(b);
    }
    actions.hidden = !actions.childNodes.length;
    box.dataset.kind = kind;
    box.hidden = false;
    document.title = conf.title;
  }

  // ── Vẽ trang ──
  function render(home, ctx) {
    const out = HR.build(home, ctx);
    $('heroContainer').innerHTML = out.hero;
    const navList = $('scheduleNavList');
    navList.innerHTML = out.nav;
    navList.setAttribute('aria-label', ctx.S.navAria);
    $('schedule').hidden = !out.count;
    $('scheduleContent').innerHTML = out.sections;
    const footer = $('homeFooter');
    footer.innerHTML = out.footer;
    footer.hidden = !out.footer;
    const btt = $('backToTopBtn');
    btt.setAttribute('aria-label', ctx.S.backToTopAria);
    btt.querySelector('.btt-label').textContent = ctx.S.backToTop;
    const heroTitle = home.hero.title || ctx.cfgTitle;
    document.title = home.pageTitle || (heroTitle && ctx.cfgTitle && heroTitle !== ctx.cfgTitle ? `${heroTitle} — ${ctx.cfgTitle}` : heroTitle) || ctx.S.docTitle;
    const md = document.querySelector('meta[name="description"]');
    if (md && (home.hero.subtitle || heroTitle)) md.setAttribute('content', home.hero.subtitle || heroTitle);
  }

  // ── Tương tác (port từ travel.js) ──
  function bindDaySwitchers() {
    document.querySelectorAll('#scheduleContent .day-switcher').forEach(sw => {
      const body = sw.parentElement;
      const btns = sw.querySelectorAll('.day-pill-btn');
      btns.forEach(btn => btn.addEventListener('click', () => {
        btns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        body.querySelectorAll(':scope > .day-block').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const panel = document.getElementById(btn.dataset.dayTarget);
        if (panel) {
          panel.classList.add('active');
          panel.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
        }
      }));
    });
  }

  function setupScrollReveal() {
    const els = document.querySelectorAll('.reveal-on-scroll');
    if (reduced || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-visible'); obs.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
  }

  function scrollToHash(hash) {
    const el = hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (!el) return false;
    const nav = document.querySelector('.schedule-nav-wrapper');
    const navH = nav && !nav.hidden ? nav.offsetHeight : 0;
    const top = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - navH - STICKY_GAP_PX);
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    return true;
  }

  function setupClicks() {
    document.addEventListener('click', e => {
      const anchor = e.target.closest('#btnCtaSchedule, .nav-anchor-tab');
      if (anchor) {
        e.preventDefault();
        const h = anchor.getAttribute('href');
        if (scrollToHash(h)) history.replaceState(null, '', h);
        return;
      }
      // CTA sang trang sự kiện: mờ nhẹ rồi chuyển trang (bỏ qua khi mở tab mới / giảm chuyển động).
      const rooms = e.target.closest('#btnCtaRooms');
      if (rooms && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !reduced) {
        e.preventDefault();
        const href = rooms.getAttribute('href');
        const b = document.body.style;
        b.transition = `opacity ${EXIT_MS}ms ease-out, transform ${EXIT_MS}ms ease-out`;
        b.opacity = '0';
        b.transform = 'scale(0.995)';
        setTimeout(() => { location.href = href; }, EXIT_MS);
      }
    });
  }

  function setupScrollSpy() {
    const tabs = document.querySelectorAll('.nav-anchor-tab');
    const secs = document.querySelectorAll('#scheduleContent .travel-section');
    const btt = $('backToTopBtn');
    let ticking = false;
    function update() {
      if (btt) btt.classList.toggle('is-shown', window.pageYOffset > BACK_TOP_AFTER_PX);
      if (!tabs.length || !secs.length) return;
      const pos = window.pageYOffset + SPY_OFFSET_PX;
      let cur = '';
      secs.forEach(s => { if (pos >= s.offsetTop && pos < s.offsetTop + s.offsetHeight) cur = s.id; });
      if (window.innerHeight + window.pageYOffset >= document.body.offsetHeight - BOTTOM_SLACK_PX) cur = secs[secs.length - 1].id;
      if (!cur) return;
      tabs.forEach(tab => {
        if (tab.dataset.target !== cur || tab.classList.contains('active')) return;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const bar = tab.closest('.schedule-nav-container');   // chỉ cuộn thanh mục lục ngang, không đụng cuộn trang
        if (bar) bar.scrollTo({ left: tab.offsetLeft - bar.offsetWidth / 2 + tab.offsetWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
      });
    }
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    update();
    if (btt) btt.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', location.pathname + location.search);
    });
  }

  // Back/forward cache: trang được khôi phục NGUYÊN TRẠNG (kể cả opacity 0 của hiệu ứng rời trang) ⇒ trả lại.
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    const b = document.body.style;
    b.transition = '';
    b.opacity = '';
    b.transform = '';
    const l = $('homeLoader');
    if (l && !$('homePage').hidden) { l.classList.add('fade-out'); l.hidden = true; }
  });

  async function boot() {
    let S = STR[provisionalLang()] || STR[FALLBACK_LANG];
    startLoader(S);
    if (typeof FIREBASE_ON === 'undefined' || !FIREBASE_ON || typeof db === 'undefined' || !db) { showMsg('network', S); return; }
    try {
      const eventId = await withTimeout(resolveEventId(), FETCH_TIMEOUT_MS);
      if (!eventId) { S = STR[applyLook(null).lang]; showMsg('noEvent', S); return; }
      const [homeSnap, cfgSnap] = await withTimeout(Promise.all([HS.homeRef(db, eventId).get(), HS.configRef(db, eventId).get()]), FETCH_TIMEOUT_MS);
      const cfg = cfgSnap.exists ? cfgSnap.data() || {} : null;
      const look = applyLook(cfg && cfg.profile);
      S = STR[look.lang] || STR[FALLBACK_LANG];
      const home = homeSnap.exists ? HS.normalize(homeSnap.data()) : null;
      const cfgTitle = cfg ? str(cfg.title) : '';
      if (!home || (!home.hero.title && !cfgTitle && !home.sections.length)) {
        showMsg(cfg ? 'noHome' : 'noEvent', S, cfg ? eventId : '');
        return;
      }
      paintBrand(look.brand);
      render(home, { S, cfgTitle, ctaHref: home.cta.url || eventHref(eventId) });
      $('homePage').hidden = false;
      if (visit.returning) document.body.classList.add('return-visit');
      bindDaySwitchers();
      setupClicks();
      setupScrollSpy();
      await finishLoader();
      document.body.classList.add('loaded');
      setupScrollReveal();
      try { if (visit.KEY) sessionStorage.setItem(visit.KEY, '1'); } catch (e) {}
      if (location.hash) scrollToHash(location.hash);
    } catch (err) {
      console.error('[home] không tải được dữ liệu:', err);
      showMsg('network', S);
    }
  }

  boot();
})();
