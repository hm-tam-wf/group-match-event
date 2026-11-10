'use strict';
// Layer P — bước 2: hồ sơ sự kiện (meta/config.profile) + chọn sự kiện (?e= > config/hosts > config/active), trình duyệt thật.
// Sự kiện fixture (L.EVENT, KHÔNG có profile) phải chạy y như trước; 2 sự kiện phụ mang hồ sơ riêng.
const J = x => JSON.stringify(x);
const P_EVENT = 'su-kien-p';        // theme gốc, EN, logo ACME, không có trang home
const P2_EVENT = 'su-kien-p2';      // như trên + bật danh sách cho phép (để mở popup chặn)
const PROFILE_A = { variant: '', lang: 'en', brand: { name: 'ACME', logoUrl: '' }, homeUrl: '', introMs: 6000,
  copy: { en: { 'profile.greeting': 'Hello ACME team!' } } };

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const fs = require('fs'), path = require('path');
    if (!fs.existsSync(path.join(L.REPO, 'fe/js/config/profile.js'))) { record('P-skip', 'bước 2 chưa có trong repo này', 'bỏ qua', '-', true); return; }
    const { reset, adb, revive, EVENT, EVENT_CFG, sleep, dedupKey } = L;
    const errs = [];
    const contexts = [];
    const newCtx = async label => {
      const ctx = await browser.createBrowserContext(); contexts.push(ctx);
      const page = await ctx.newPage();
      await page.setViewport(B.VIEWPORT);
      await page.setCacheEnabled(false);
      page.on('pageerror', e => errs.push(`[${label}] pageerror: ${String(e).slice(0, 200)}`));
      page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_|net::|Failed to load resource/i.test(m.text())) errs.push(`[${label}] console.error: ${m.text().slice(0, 200)}`); });
      return { ctx, page };
    };
    // Mở index.html + query; đợi boot ra kết quả (vào lưới / không có sự kiện / lỗi / đếm ngược / kết thúc).
    const open = async (page, query) => {
      await page.goto(B.baseUrl() + 'index.html' + (query || ''), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        try {
          const vis = id => { const el = document.getElementById(id); return !!el && !el.hidden; };
          return (vis('appContent') && stateLoaded === true) || vis('noEvent') || vis('appError') || vis('preOpen') || vis('eventClosed');
        } catch (e) { return false; }
      }, { timeout: 30000, polling: 100 });
      await sleep(300);
    };
    const state = page => page.evaluate(() => {
      const vis = id => { const el = document.getElementById(id); return !!el && !el.hidden; };
      const root = document.documentElement;
      return {
        eid: typeof EVENT_ID !== 'undefined' ? EVENT_ID : null, content: vis('appContent'), noEvent: vis('noEvent'), appError: vis('appError'),
        variant: root.getAttribute('data-variant'), brand: root.getAttribute('data-brand'), lang: root.lang,
        h1: (document.querySelector('#appContent h1') || {}).textContent || '',
        brandHtml: (document.getElementById('brandSlot') || {}).innerHTML || '',
        bootHold: getComputedStyle(root).getPropertyValue('--boot-hold-ms').trim(),
        homeUrl: typeof HOME_URL !== 'undefined' ? HOME_URL : '(n/a)', hasHome: typeof hasHome === 'function' ? hasHome() : null,
      };
    });
    const until = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg);
    const enterName = async (page, name) => {
      await until(page, () => !!document.getElementById('pmSave'));
      await page.evaluate(n => { document.getElementById('f_name').value = n; document.getElementById('pmSave').click(); }, name);
    };
    const eventCfg = extra => Object.assign(revive(EVENT_CFG), { allowlistMode: false, allowlistGenderCheck: false }, extra);
    const recordDcl = page => page.evaluateOnNewDocument(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const r = document.documentElement;
        window.__dcl = { variant: r.getAttribute('data-variant'), brand: r.getAttribute('data-brand'), lang: r.lang };
      });
    });

    try {
      await reset();
      await adb.doc(`events/${P_EVENT}/meta/config`).set(eventCfg({ title: 'Sự kiện P', profile: PROFILE_A }));
      await adb.doc(`events/${P2_EVENT}/meta/config`).set(eventCfg({ title: 'Sự kiện P2', allowlistMode: true, profile: PROFILE_A }));
      await adb.doc(`events/${P2_EVENT}/allowlist/${dedupKey('Người Khác')}`).set({ name: 'Người Khác' });

      // P1 — ?e= chọn sự kiện + áp TRỌN hồ sơ; P8 — lần tải sau vẽ đầu đúng skin nhờ cache
      {
        const { page } = await newCtx('P1');
        await open(page, `?e=${P_EVENT}`);
        const s = await state(page);
        await until(page, () => !!document.querySelector('#profileModal h3'));
        const greet = await page.evaluate(() => document.querySelector('#profileModal h3').textContent.trim());
        record('P1 ?e= + hồ sơ', `?e=${P_EVENT} ⇒ đúng sự kiện + theme gốc, EN, logo ACME, intro 6000, không có home, copy ghi đè`,
          'eid=su-kien-p, không data-variant, data-brand=custom, lang=en, brand ACME (không ảnh), --boot-hold-ms=6000, HOME_URL="", greeting ghi đè',
          J({ ...s, brandHtml: s.brandHtml.slice(0, 120), greet }),
          s.eid === P_EVENT && s.content && s.h1 === 'Sự kiện P' && s.variant === null && s.brand === 'custom' && s.lang === 'en'
            && /ACME/.test(s.brandHtml) && !/<img/.test(s.brandHtml) && s.bootHold === '6000' && s.homeUrl === '' && s.hasHome === false
            && greet === 'Hello ACME team!');
        await recordDcl(page);
        await open(page, `?e=${P_EVENT}`);
        const dcl = await page.evaluate(() => window.__dcl || null);
        const fresh = await newCtx('P8-fresh');
        await recordDcl(fresh.page);
        await open(fresh.page, `?e=${P_EVENT}`);
        const dclFresh = await fresh.page.evaluate(() => window.__dcl || null);
        record('P8 cache vẽ đầu', 'tải lại sự kiện có hồ sơ ⇒ ngay DOMContentLoaded đã đúng skin/ngôn ngữ (trình duyệt mới thì mặc định tnt)',
          'lần 2: variant null, brand custom, lang en; trình duyệt mới: variant tnt', J({ dcl, dclFresh }),
          !!dcl && dcl.variant === null && dcl.brand === 'custom' && dcl.lang === 'en' && !!dclFresh && dclFresh.variant === 'tnt');
      }

      // P2 — popup chặn (ngoài danh sách): homeUrl "" ⇒ không có nút rời trang; sự kiện không có hồ sơ ⇒ vẫn có
      {
        const a = await newCtx('P2-nohome');
        await open(a.page, `?e=${P2_EVENT}`);
        await enterName(a.page, 'Ngoài Danh Sách');
        await until(a.page, () => !!document.getElementById('allowBlockedModal'), null, 25000);
        const r1 = await a.page.evaluate(() => ({ cancel: !!document.getElementById('allowCancel'), back: !!document.getElementById('allowBack') }));
        const b = await newCtx('P2-legacy');
        await open(b.page, '');
        await enterName(b.page, 'Ngoài Danh Sách');
        await until(b.page, () => !!document.getElementById('allowBlockedModal'), null, 25000);
        const r2 = await b.page.evaluate(() => ({ cancel: !!document.getElementById('allowCancel'), back: !!document.getElementById('allowBack') }));
        record('P2 nút rời trang theo homeUrl', 'popup "không có trong danh sách": homeUrl "" ⇒ ẩn "Quay lại"; sự kiện không có hồ sơ ⇒ giữ nguyên',
          'không home: cancel=false, back=true; cũ: cancel=true, back=true', J({ noHome: r1, legacy: r2 }),
          !r1.cancel && r1.back && r2.cancel && r2.back);
      }

      // P3 — ?e= sai định dạng / không tồn tại ⇒ "không có sự kiện" (không rơi về sự kiện đang mở)
      {
        const { page } = await newCtx('P3');
        await open(page, '?e=Bad_ID');
        const s1 = await state(page);
        await open(page, '?e=khong-ton-tai');
        const s2 = await state(page);
        record('P3 ?e= sai/không tồn tại', '?e=Bad_ID và ?e=khong-ton-tai ⇒ màn không có sự kiện', 'noEvent=true, content=false (cả 2)',
          J({ bad: { noEvent: s1.noEvent, content: s1.content }, missing: { noEvent: s2.noEvent, content: s2.content } }),
          s1.noEvent && !s1.content && s2.noEvent && !s2.content);
      }

      // P5/P7 — config/hosts: map domain ⇒ sự kiện của domain; map hỏng ⇒ chặn; không map ⇒ sự kiện đang mở (y như cũ)
      {
        const { page } = await newCtx('P5');
        const host = new URL(B.baseUrl()).hostname;
        await adb.doc('config/hosts').set({ byHost: { [host]: P_EVENT } });
        await open(page, '');
        const s1 = await state(page);
        await adb.doc('config/hosts').set({ byHost: { [host]: 'Bad ID' } });
        await open(page, '');
        const s2 = await state(page);
        await adb.doc('config/hosts').delete();
        await open(page, '');
        const s3 = await state(page);
        record('P5 config/hosts', 'domain có map ⇒ sự kiện của domain; map hỏng ⇒ chặn; bỏ map ⇒ config/active',
          `map: eid=${P_EVENT}; hỏng: noEvent; bỏ: eid=${EVENT}`, J({ map: s1.eid, broken: { noEvent: s2.noEvent, content: s2.content }, none: s3.eid }),
          s1.eid === P_EVENT && s1.content && s2.noEvent && !s2.content && s3.eid === EVENT && s3.content);
        record('P7 sự kiện không có hồ sơ = y như trước', `${EVENT} (không profile) ⇒ tnt, tiếng Việt, logo mặc định, home cũ`,
          'variant=tnt, lang=vi, brand=null, brandHtml có FARADAY (bị CSS tnt che), HOME_URL=null, hasHome=true, --boot-hold-ms=5000 (tnt.css)',
          J({ variant: s3.variant, lang: s3.lang, brand: s3.brand, homeUrl: s3.homeUrl, hasHome: s3.hasHome, bootHold: s3.bootHold, faraday: /FARADAY/.test(s3.brandHtml) }),
          s3.variant === 'tnt' && s3.lang === 'vi' && s3.brand === null && /FARADAY/.test(s3.brandHtml) && s3.homeUrl === null && s3.hasHome === true && s3.bootHold === '5000');
      }

      // P9 — homeUrl tường minh: _travelSmoothBack() đưa về đúng link home của sự kiện
      {
        await adb.doc(`events/${P_EVENT}/meta/config`).update({ profile: Object.assign({}, PROFILE_A, { homeUrl: 'travel.html?from=p' }) });
        const { page } = await newCtx('P9');
        await open(page, `?e=${P_EVENT}`);
        const before = await state(page);
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), page.evaluate(() => _travelSmoothBack())]);
        const url = page.url();
        record('P9 homeUrl tường minh', 'profile.homeUrl="travel.html?from=p" ⇒ Huỷ/Quay lại đưa về đúng link đó', 'HOME_URL đúng, hasHome=true, URL sau = travel.html?from=p',
          J({ homeUrl: before.homeUrl, hasHome: before.hasHome, url }), before.homeUrl === 'travel.html?from=p' && before.hasHome === true && /\/travel\.html\?from=p$/.test(url));
      }

      record('P0 không có lỗi JS', 'toàn bộ layer P', '0 pageerror / console.error', J(errs.slice(0, 5)), errs.length === 0);
    } finally {
      for (const c of contexts) await c.close().catch(() => {});
    }
  },
};
