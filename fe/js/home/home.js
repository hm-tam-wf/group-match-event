// ============================================================================
// home.js — controller trang home dùng chung (fe/home.html)
// ----------------------------------------------------------------------------
// 1. Chọn sự kiện — CÙNG quy tắc index.html (app.js): ?e=<id> (sai định dạng ⇒ màn "không tìm thấy")
//    → config/hosts.byHost[hostname] (domain CÓ mục mà id hỏng ⇒ CHẶN, không rơi về sự kiện đang mở) → config/active.
// 2. Đọc events/{id}/meta/home + meta/config SONG SONG; hồ sơ meta/config.profile áp bằng applyEventProfile() của
//    js/config/profile.js ⇒ biến thể / ngôn ngữ / logo theo ĐÚNG một nguồn với trang sự kiện.
// 3. Vẽ bằng HomeRender (loader che tới khi có dữ liệu ⇒ không FOUC), rồi gắn tương tác như travel.js:
//    cuộn mượt có bù mục lục bám dính, scrollspy, đổi ngày, nút lên đầu trang, hiệu ứng rời trang.
// Dùng global của các file nạp trước (thứ tự cố định trong home.html): theme.js (eventIdFromUrl, EVENT_ID_RE),
// config.js (LANG, DEFAULT_LANG), profile.js (applyEventProfile, cacheEventProfile), firebase-config.js (db, FIREBASE_ON).
// Bọc IIFE, KHÔNG khai tên toàn cục nào (tránh "already been declared" với các file trên).
// ============================================================================
(function () {
  'use strict';

  const HS = window.HomeSchema, HR = window.HomeRender, STR = window.HomeStrings;
  const visit = window.HomeVisit || { KEY: '', returning: false };   // khai inline trong <head> của home.html

  // ── Hằng ──
  const EVENT_PAGE = 'index.html';                     // trang sự kiện; CTA mặc định = index.html?e=<id>
  const CFG_COL = 'config', CFG_HOSTS = 'hosts', CFG_ACTIVE = 'active';
  const CARRY_PARAMS = ['lang', 'variant'];            // giữ khi sang trang sự kiện (xem trước ?variant= / ?lang=)
  const FETCH_TIMEOUT_MS = 15000;
  const LOADER_MIN_MS = 600;                           // lần mở đầu: giữ loader tối thiểu để không chớp
  const LOADER_EASE_MS = 900;                          // thanh tiến trình chạy dần tới LOADER_CAP trong lúc chờ mạng
  const LOADER_CAP = 90;
  const LOADER_STEP_AT = [0, 35, 70];                  // % đổi dòng trạng thái (HomeStrings.*.loaderSteps)
  const LOADER_HIDE_MS = 150;
  const STICKY_GAP_PX = 16, SPY_OFFSET_PX = 140, BOTTOM_SLACK_PX = 50, BACK_TOP_AFTER_PX = 450;
  const EXIT_MS = 150;
  const MSG_ICON = { noEvent: '🔍', noHome: '🗓️', network: '📡' };

  const $ = id => document.getElementById(id);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const params = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } })();
  const reduced = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  // Bảng chữ tĩnh của trang theo ngôn ngữ hiệu lực (LANG / kết quả applyEventProfile — profile.js quyết định).
  const strings = lang => STR[lang] || STR[DEFAULT_LANG];

  // Khối logo = brand do applyEventProfile() trả về (profile.brand hoặc DEFAULT_BRAND; biến thể tnt tự vẽ logo
  // bằng CSS trừ khi profile.js đặt <html data-brand="custom">).
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
    const fromUrl = eventIdFromUrl();                    // theme.js
    if (fromUrl.given) return fromUrl.id;                // ?e= sai định dạng ⇒ "" (KHÔNG rơi về hosts/active)
    const cfg = db.collection(CFG_COL);
    const [hostsSnap, activeSnap] = await Promise.all([cfg.doc(CFG_HOSTS).get(), cfg.doc(CFG_ACTIVE).get()]);
    const hosts = hostsSnap.exists ? hostsSnap.data() : null;
    const byHost = hosts && isObj(hosts.byHost) ? hosts.byHost : null;
    if (byHost && hasOwn(byHost, location.hostname)) {   // domain CÓ mục ⇒ đúng mục đó; id hỏng ⇒ CHẶN (như app.js)
      const id = str(byHost[location.hostname]);
      return EVENT_ID_RE.test(id) ? id : '';
    }
    const a = activeSnap.exists ? str((activeSnap.data() || {}).eventId) : '';
    return EVENT_ID_RE.test(a) ? a : '';
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
    let S = strings(LANG);                               // ngôn ngữ của hồ sơ lưu lần trước / mặc định (profile.js áp lúc nạp)
    startLoader(S);
    if (typeof FIREBASE_ON === 'undefined' || !FIREBASE_ON || typeof db === 'undefined' || !db) { showMsg('network', S); return; }
    try {
      const eventId = await withTimeout(resolveEventId(), FETCH_TIMEOUT_MS);
      if (!eventId) { showMsg('noEvent', S); return; }
      const [homeSnap, cfgSnap] = await withTimeout(Promise.all([HS.homeRef(db, eventId).get(), HS.configRef(db, eventId).get()]), FETCH_TIMEOUT_MS);
      const cfg = cfgSnap.exists ? cfgSnap.data() || {} : null;
      const look = applyEventProfile(cfg ? cfg.profile : null);   // profile.js: biến thể, ngôn ngữ, logo (+ data-brand)
      if (cfg) cacheEventProfile(cfg.profile);                    // lần mở sau (kể cả trang sự kiện) vẽ đầu đúng skin
      S = strings(look.lang);
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
