'use strict';
// Trang home dùng chung fe/home.html (nội dung từ events/{id}/meta/home — schema documentation/HOME-TEMPLATE.md):
// render đủ seed TNT, CTA index.html?e=<id>, màn thông báo (?e= sai / thiếu doc / lỗi mạng), chọn sự kiện ?e= → config/hosts
// (domain có mục mà id hỏng ⇒ CHẶN) → config/active, hồ sơ (biến thể/ngôn ngữ/logo qua profile.js), XSS, link sâu, Back,
// và màn đầu giống travel.html (so ảnh). Chỉ tính lỗi console của chính home.html.
const fs = require('fs'), path = require('path');

const DESK = { width: 1440, height: 900 }, MOB = { width: 390, height: 844 };   // không bật isMobile: puppeteer reload trang khi đổi cờ đó
const FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.reveal-on-scroll{opacity:1!important;transform:none!important}';
const DIFF_CHANNEL = 40, DIFF_MAX_PCT = 2;

module.exports = {
  browser: true,
  async run({ L, B, browser, ok }) {
    if (!fs.existsSync(path.join(L.REPO, 'fe/home.html'))) { ok('home.html chưa có trong repo này — bỏ qua', true); return; }
    const SEED = JSON.parse(fs.readFileSync(path.join(L.REPO, 'backend/seed/home-tnt.json'), 'utf8'));
    const errs = [];
    const ctxs = [];
    const meta = id => L.adb.collection('events').doc(id).collection('meta');
    await L.reset();
    await L.adb.doc('config/hosts').set({ byHost: { localhost: 'test-plain' } });
    await meta('test-home').doc('config').set({ title: 'TNT Mini Outing 2026', capacity: 8 });            // không có profile ⇒ mặc định (tnt, vi)
    await meta('test-home').doc('home').set(SEED);
    await meta('test-plain').doc('config').set({ title: 'Faraday Pick Your Squad', profile: { variant: '', lang: 'en' } });
    await meta('test-plain').doc('home').set(SEED);
    await meta('test-brand').doc('config').set({ title: 'Brand test', profile: { variant: 'khong-co', brand: { name: '', logoUrl: '' } } });
    await meta('test-brand').doc('home').set({ v: 1, hero: { title: '' }, sections: [{ id: 'info', type: 'text', title: 'Giới thiệu', body: 'Dòng 1\nDòng 2\n\nĐoạn 2' }] });
    await meta('test-nohome').doc('config').set({ title: 'Chưa có home', profile: { variant: 'tnt' } });
    await meta('test-xss').doc('config').set({ title: 'XSS', profile: { variant: 'tnt', brand: { name: '<b>X</b>', logoUrl: 'javascript:alert(1)' } } });
    await meta('test-xss').doc('home').set({
      v: 1, pageTitle: '</title><script>window.__xss=9</script>',
      hero: { title: '<img src=x onerror="window.__xss=1">', badge: '"><svg onload=window.__xss=7>', imageUrl: 'javascript:window.__xss=8' },
      cta: { url: 'javascript:alert(1)', label: '<i>CTA</i>' },
      sections: [
        { id: 'n', type: 'notes', title: '<script>window.__xss=2</script>', items: [{ icon: '<img src=x onerror=window.__xss=10>', title: 'T', desc: '<script>window.__xss=2</script>' }] },
        { id: 'd', type: 'dresscode', title: 'D', items: [{ highlight: 'H', colors: [{ name: 'bad', hex: 'red;background:url(//evil.test/x)' }, { name: 'ok', hex: '#FFFFFF' }] }] },
        { id: 't', type: 'text', title: 'Text', bodyHtml: '<p>ok <b>bold</b><img src=x onerror="window.__xss=3"><a href="javascript:window.__xss=4">bad</a> <a href="https://example.com" onclick="window.__xss=5">good</a><script>window.__xss=6</script><iframe src="https://evil.test"></iframe><span style="color:red" class="x">span</span></p><svg><circle onload="window.__xss=11"/></svg>' },
        { id: 'tp', type: 'transport', title: 'TP', contacts: [{ name: 'A', phone: '0901 "onmouseover=x 123' }] },
        { id: 'g', type: 'gallery', title: 'Type lạ', photos: [1, 2] },
      ],
    });

    const base = host => (host ? B.baseUrl().replace('127.0.0.1', host) : B.baseUrl());
    async function open(q, vp, label, { host, offline = false, timeout = 25000 } = {}) {
      const ctx = await browser.createBrowserContext();
      ctxs.push(ctx);
      const page = await ctx.newPage();
      await page.setViewport(vp || B.VIEWPORT);
      await page.setCacheEnabled(false);
      const mine = () => /\/home\.html/.test(page.url());
      page.on('pageerror', e => { if (mine()) errs.push(`[${label}] pageerror: ${String(e).slice(0, 200)}`); });
      page.on('console', m => { if (mine() && m.type() === 'error' && !/favicon|fonts\.g|Failed to load resource|net::/i.test(m.text())) errs.push(`[${label}] console.error: ${m.text().slice(0, 200)}`); });
      if (offline) {   // lỗi mạng: chặn mọi request tới Firestore Emulator
        await page.setRequestInterception(true);
        page.on('request', r => (r.url().includes(':' + L.EMU_PORT) ? r.abort() : r.continue()));
      }
      await page.goto(base(host) + 'home.html' + q, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const l = document.getElementById('homeLoader'), m = document.getElementById('homeMsg');
        return (l && l.hidden && document.body.classList.contains('loaded')) || (m && !m.hidden);
      }, { timeout, polling: 100 });
      return page;
    }
    const msgKind = page => page.evaluate(() => { const m = document.getElementById('homeMsg'); return m && !m.hidden ? m.dataset.kind : ''; });
    const freeze = async page => { await page.addStyleTag({ content: FREEZE_CSS }); await page.evaluate(() => document.fonts && document.fonts.ready); await L.sleep(150); };

    try {
      // ── render đầy đủ (profile thiếu key ⇒ tnt + vi) ──
      let page = await open('?e=test-home', DESK, 'H1');
      const info = await page.evaluate(() => {
        const q = s => document.querySelector(s), qa = s => document.querySelectorAll(s);
        const flat = el => el.textContent.replace(/\s+/g, '');
        return {
          variant: document.documentElement.getAttribute('data-variant'), lang: document.documentElement.lang, title: document.title,
          h1: q('#heroContainer h1').textContent, badge: q('.hero-pill-badge').textContent, chips: [...qa('.meta-chip')].map(flat),
          cta: q('#btnCtaRooms').getAttribute('href'), ctaText: flat(q('#btnCtaRooms')), tabs: [...qa('.nav-anchor-tab')].map(flat),
          secIds: [...qa('#scheduleContent .travel-section')].map(s => s.id), pills: qa('.day-pill-btn').length, items: qa('.timeline-item').length,
          tags: [...qa('#sec-timeline-d1 .tl-tag')].map(t => t.className), notes: qa('.note-card').length, dress: qa('.dress-card').length,
          dressTime: qa('.dress-time').length, bordered: qa('.color-dot.has-border').length, info: qa('.info-row').length, leads: qa('.bus-lead').length,
          tel: [...qa('.hl-call-btn')].map(a => a.getAttribute('href')), footer: q('#homeFooter').textContent.trim().replace(/\s+/g, ' '),
          logo: getComputedStyle(q('#homeBrand .logo-wrap'), '::before').backgroundImage, colors: q('.color-swatches-label').textContent,
        };
      });
      ok('home: biến thể mặc định tnt + lang vi khi hồ sơ thiếu key; title = pageTitle', info.variant === 'tnt' && info.lang === 'vi' && info.title === SEED.pageTitle, info);
      ok('home: hero đúng seed (H1, badge, chip ngày/nơi ở)', info.h1 === SEED.hero.title && info.badge === SEED.hero.badge
        && info.chips[0] === '📅15.04–17.04.2026(3Ngày2Đêm)' && info.chips[2] === '🏖️CentaraMirageResortMuiNe', info.chips);
      ok('home: CTA = index.html?e=test-home, nhãn "🛏️ Chọn phòng"', info.cta === 'index.html?e=test-home' && info.ctaText === '🛏️Chọnphòng', info);
      ok('home: mục lục 4 tab + 4 mục đúng thứ tự (neo sec-*)', JSON.stringify(info.secIds) === '["sec-timeline","sec-notes","sec-dresscode","sec-transport"]' && info.tabs[0] === '🗓️Lịchtrìnhtổng', info);
      ok('home: lịch trình 3 ngày / 21 hoạt động, màu nhãn đoán như travel.js', info.pills === 3 && info.items === 21 && info.tags[0] === 'tl-tag tag-move' && info.tags[3] === 'tl-tag tag-food', info);
      ok('home: lưu ý 6, trang phục 4 (có dòng giờ), chấm trắng có viền, di chuyển 5 dòng + trưởng xe, tel chỉ số', info.notes === 6 && info.dress === 4
        && info.dressTime === 4 && info.bordered === 3 && info.info === 5 && info.leads === 3 && info.tel[0] === 'tel:0908123456', info);
      ok('home: footer + logo TNT do biến thể vẽ + chữ tĩnh VI', info.footer.startsWith('© 2026 TNT Company Trip') && /tnt-logo/.test(info.logo) && info.colors === 'Tone màu gợi ý:', info);
      await page.click('.day-pill-btn:nth-child(2)');
      ok('home: bấm "NGÀY 02" ⇒ hiện khối ngày 2', (await page.evaluate(() => document.querySelector('.day-block.active').id)) === 'sec-timeline-d2');
      await page.click('.nav-anchor-tab[data-target="sec-transport"]');
      await L.sleep(1500);
      const spy = await page.evaluate(() => ({ y: window.scrollY, active: document.querySelector('.nav-anchor-tab.active').dataset.target, hash: location.hash,
        btt: document.getElementById('backToTopBtn').classList.contains('is-shown') }));
      ok('home: tab mục lục ⇒ cuộn tới mục, tab active, hash cập nhật, hiện nút lên đầu', spy.y > 500 && spy.active === 'sec-transport' && spy.hash === '#sec-transport' && spy.btt, spy);

      // ── màn đầu giống travel.html (cùng CSS) ──
      if (fs.existsSync(path.join(L.REPO, 'fe/travel.html'))) {
        for (const [vp, tag] of [[DESK, '1440'], [MOB, '390']]) {
          const hp = await open('?e=test-home', vp, 'V' + tag);
          await freeze(hp);
          const a = Buffer.from(await hp.screenshot());
          const tctx = await browser.createBrowserContext(); ctxs.push(tctx);
          const tp = await tctx.newPage();
          await tp.setViewport(vp);
          await tp.goto(B.baseUrl() + 'travel.html', { waitUntil: 'domcontentloaded' });
          await tp.waitForFunction(() => { const l = document.getElementById('travelLoader'); return l && l.hidden; }, { timeout: 15000 });
          await freeze(tp);
          const b = Buffer.from(await tp.screenshot());
          const d = await tp.evaluate(async (A, Bb, th) => {
            const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
            const [ia, ib] = await Promise.all([load(A), load(Bb)]);
            const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
            const px = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
            const da = px(ia), db = px(ib);
            let bad = 0;
            for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > th) bad++;
            return +(100 * bad / (w * h)).toFixed(3);
          }, a.toString('base64'), b.toString('base64'), DIFF_CHANNEL);
          ok(`home: màn đầu giống travel.html @${tag} (pixel lệch ${d}%)`, d < DIFF_MAX_PCT, d);
          await tctx.close();
        }
      } else ok('home: travel.html không còn — bỏ qua so ảnh', true);

      // ── màn thông báo ──
      for (const [q, kind] of [['?e=BAD_ID!', 'noEvent'], ['?e=', 'noEvent'], ['?e=-abc', 'noEvent'], ['?e=khong-ton-tai', 'noEvent'], ['?e=test-nohome', 'noHome']]) {
        page = await open(q, null, 'M' + q);
        const r = await page.evaluate(() => ({ cta: (document.getElementById('msgCta') || {}).href || '', pg: document.getElementById('homePage').hidden, ld: document.getElementById('homeLoader').hidden }));
        const k = await msgKind(page);
        ok(`home: home.html${q} ⇒ màn ${kind}`, k === kind && r.pg && r.ld && (kind === 'noHome' ? /\/index\.html\?e=test-nohome$/.test(r.cta) : !r.cta), Object.assign({ k }, r));
      }

      // ── chọn sự kiện khi không có ?e= ──
      page = await open('', null, 'H4a');
      const k4 = await msgKind(page), cta4 = await page.evaluate(() => (document.getElementById('msgCta') || {}).href || '');
      ok('home: 127.0.0.1 không có mục config/hosts ⇒ config/active (sự kiện fixture chưa có home ⇒ màn "chưa có trang" + link đúng sự kiện)',
        k4 === 'noHome' && cta4.endsWith(`/index.html?e=${L.EVENT}`), { k4, cta4 });
      let r;
      await L.adb.doc('config/active').set({ eventId: 'test-home' });
      page = await open('', null, 'H4b');
      r = await page.evaluate(() => ({ cta: document.getElementById('btnCtaRooms').getAttribute('href') }));
      ok('home: config/active = test-home ⇒ vẽ test-home', r.cta === 'index.html?e=test-home', r);
      page = await open('', null, 'H4c', { host: 'localhost' });
      r = await page.evaluate(() => ({ cta: document.getElementById('btnCtaRooms').getAttribute('href'), v: document.documentElement.getAttribute('data-variant'),
        lang: document.documentElement.lang, colors: document.querySelector('.color-swatches-label').textContent, logoTxt: document.querySelector('#homeBrand .logo-text').textContent }));
      ok('home: localhost có mục config/hosts ⇒ test-plain: theme gốc, lang en, logo FARADAY', r.cta === 'index.html?e=test-plain' && r.v === null && r.lang === 'en'
        && r.colors === 'Suggested colors:' && r.logoTxt === 'FARADAY', r);
      await L.adb.doc('config/hosts').set({ byHost: { localhost: 'BAD ID!' } });
      page = await open('', null, 'H4d', { host: 'localhost' });
      ok('home: domain CÓ mục config/hosts nhưng id hỏng ⇒ màn không tìm thấy (KHÔNG rơi về config/active)', (await msgKind(page)) === 'noEvent', await msgKind(page));

      // ── ?variant= / ?lang= thắng hồ sơ; CTA giữ tham số xem trước ──
      page = await open('?e=test-home&variant=&lang=en', null, 'H5');
      r = await page.evaluate(() => ({ v: document.documentElement.getAttribute('data-variant'), lang: document.documentElement.lang, cta: document.getElementById('btnCtaRooms').getAttribute('href') }));
      ok('home: ?variant= ép tắt biến thể, ?lang=en thắng, CTA giữ lang/variant', r.v === null && r.lang === 'en' && r.cta === 'index.html?e=test-home&lang=en&variant=', r);

      // ── biến thể lạ ⇒ theme gốc; brand rỗng ⇒ ẩn logo; H1 = meta/config.title; mục text ──
      page = await open('?e=test-brand', null, 'H6');
      r = await page.evaluate(() => ({ v: document.documentElement.getAttribute('data-variant'), brand: document.getElementById('homeBrand').hidden,
        h1: document.querySelector('#heroContainer h1').textContent, text: document.querySelector('.home-text').innerHTML, footer: document.getElementById('homeFooter').hidden,
        cta: document.getElementById('btnCtaRooms').textContent.trim() }));
      ok('home: variant lạ ⇒ theme gốc + en; brand rỗng ⇒ ẩn logo; H1 lấy meta/config.title; footer ẩn', r.v === null && r.brand && r.h1 === 'Brand test' && r.cta === 'Go to sign-up' && r.footer, r);
      ok('home: mục text — dòng trống = đoạn mới, xuống dòng = <br>', r.text === '<p>Dòng 1<br>Dòng 2</p><p>Đoạn 2</p>', r.text);

      // ── XSS ──
      page = await open('?e=test-xss', DESK, 'H7');
      await L.sleep(500);
      r = await page.evaluate(() => ({
        xss: window.__xss, bad: document.querySelectorAll('#homePage script, #homePage iframe, #homePage svg, #homePage img:not(.logo-icon), .home-hero-img').length,
        h1: document.querySelector('#heroContainer h1').textContent, cta: document.getElementById('btnCtaRooms').getAttribute('href'),
        jsLinks: document.querySelectorAll('#homePage a[href^="javascript"]').length, logoSrc: document.querySelector('#homeBrand .logo-icon').getAttribute('src'),
        good: (() => { const a = document.querySelector('.home-text a[href="https://example.com"]'); return a ? [a.target, a.rel, a.getAttribute('onclick')] : null; })(),
        span: (() => { const s = document.querySelector('.home-text span'); return s ? s.attributes.length : -1; })(),
        dots: [...document.querySelectorAll('.color-dot')].map(d => d.getAttribute('style')), tel: (document.querySelector('.hl-call-btn') || {}).outerHTML || '',
        secs: [...document.querySelectorAll('#scheduleContent .travel-section')].map(s => s.id),
      }));
      ok('home: XSS — không script nào chạy, không thẻ nguy hiểm lọt, chuỗi hiện nguyên văn', r.xss === undefined && !r.bad && r.h1 === '<img src=x onerror="window.__xss=1">', r);
      ok('home: URL javascript: (CTA/logo/link) bị bỏ, link https giữ + target/rel, thuộc tính lạ bị gỡ', r.cta === 'index.html?e=test-xss' && r.logoSrc === null && !r.jsLinks
        && r.good && r.good[0] === '_blank' && r.good[1] === 'noopener noreferrer' && r.good[2] === null && r.span === 0, r);
      ok('home: hex xấu không vào style, tel chỉ số, type lạ bỏ qua', r.dots[0] === null && r.dots[1] === 'background-color: #FFFFFF' && /href="tel:0901123"/.test(r.tel)
        && JSON.stringify(r.secs) === '["sec-n","sec-d","sec-t","sec-tp"]', r);

      // ── link sâu ──
      page = await open('?e=test-home#sec-notes', DESK, 'H8');
      await L.sleep(1500);
      r = await page.evaluate(() => ({ top: Math.round(document.getElementById('sec-notes').getBoundingClientRect().top), y: window.scrollY }));
      ok('home: home.html?e=…#sec-notes ⇒ cuộn tới mục Lưu ý', r.y > 300 && r.top >= 0 && r.top < 200, r);

      // ── CTA rồi Back ⇒ trang home hiện lại (không trắng) ──
      page = await open('?e=test-home', null, 'H9');
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#btnCtaRooms')]);
      const at = page.url();
      await L.sleep(800);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => { const p = document.getElementById('homePage'); return p && !p.hidden && document.getElementById('homeLoader').hidden; }, { timeout: 20000 });
      await L.sleep(300);
      ok('home: CTA → index.html?e=test-home; Back ⇒ home hiện lại (opacity 1)', /\/index\.html\?e=test-home$/.test(at)
        && (await page.evaluate(() => getComputedStyle(document.body).opacity)) === '1', at);

      // ── lỗi mạng ──
      page = await open('?e=test-home', null, 'NET', { offline: true, timeout: 40000 });
      ok('home: không tới được Firestore ⇒ màn lỗi mạng có nút Thử lại', (await msgKind(page)) === 'network' && (await page.evaluate(() => !!document.getElementById('msgRetry'))), await msgKind(page));
      for (let i = errs.length - 1; i >= 0; i--) if (errs[i].startsWith('[NET]')) errs.splice(i, 1);   // lỗi offline là cố ý

      ok('home: không exception / console.error trên home.html', errs.length === 0, errs);
    } finally {
      for (const c of ctxs) await c.close().catch(() => {});
    }
  },
};
