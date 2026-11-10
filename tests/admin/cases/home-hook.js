'use strict';
// HOOK trình soạn trang home trong admin.html (documentation/HOME-TEMPLATE.md §7): tab "Trang thông tin", dropdown sự kiện
// lấy từ #sigSelect, mount HomeEditor, Lưu ghi events/<id>/meta/home (store giả), thanh tab đáy mobile đủ 5 tab 1 hàng,
// đổi sự kiện khi còn thay đổi chưa lưu (Huỷ ⇒ ở lại, Đồng ý ⇒ chuyển). admin.html CHƯA chèn HOOK ⇒ tự bỏ qua.
const fs = require('fs'), path = require('path');

module.exports = {
  async run(t) {
    const { ok } = t;
    const html = fs.readFileSync(path.join(t.buildDir, 'admin.html'), 'utf8');
    if (!html.includes('data-tab="tabHome"')) { ok('home-hook: admin.html chưa có HOOK trang home — bỏ qua', true); return; }

    await t.navigate(t.url(''));
    ok('home-hook: admin tải xong danh sách sự kiện', await t.waitFor(`!document.getElementById('adminView').hidden && !!document.querySelector('#sigSelect option[value="tnt-mini-outing"]')`, 15000));
    await t.ev(`document.querySelector('.tab[data-tab="tabHome"]').click(), 1`);
    // admin đổi tab bằng View Transition ⇒ trạng thái tab/tiêu đề áp trễ (tối đa ~150ms) — chờ cả hai.
    ok('home-hook: bấm tab ⇒ trình soạn mount', await t.waitFor(`!!document.querySelector('#homeEditorMount .he-bar') && document.getElementById('tabHome').classList.contains('active')`, 15000));
    const r1 = await t.ev(`({ sel: document.getElementById('homeEvent').value, opts: document.getElementById('homeEvent').options.length, ev: HomeEditor.eventId,
      title: document.getElementById('pageTitle').textContent, active: document.getElementById('tabHome').classList.contains('active') })`);
    ok('home-hook: mặc định sự kiện đang mở; dropdown = danh sách của trang Đăng ký; tiêu đề trang đúng', r1 && r1.sel === 'tnt-mini-outing' && r1.ev === 'tnt-mini-outing'
      && r1.opts === 4 && r1.title === 'Trang thông tin' && r1.active, r1);

    const setVal = (p, v) => t.ev(`(() => { const el = document.querySelector('[data-path="${p}"]'); if (!el) return 'missing'; el.value = ${JSON.stringify(v)};
      el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()`);
    await t.ev(`document.querySelector('#homeEditorMount [data-act="starter"]').click(), 1`);
    await setVal('hero.subtitle', 'Từ admin');
    await t.ev(`document.querySelector('#homeEditorMount [data-act="save"]').click(), 1`);
    ok('home-hook: Lưu ⇒ trạng thái "Đã lưu"', await t.waitFor(`/Đã lưu/.test((document.querySelector('.he-status') || {}).textContent || '')`, 10000),
      await t.ev(`(document.querySelector('.he-status') || {}).textContent`));
    const saved = await t.ev(`firebase.firestore().collection('events').doc('tnt-mini-outing').collection('meta').doc('home').get()
      .then(s => s.exists ? JSON.parse(JSON.stringify(s.data())) : null)`);
    ok('home-hook: ghi events/tnt-mini-outing/meta/home (trọn doc)', saved && saved.hero && saved.hero.subtitle === 'Từ admin' && saved.sections.length === 4, saved && saved.hero);

    await t.page.setViewport({ width: 390, height: 844 });   // không bật isMobile (puppeteer sẽ reload trang)
    await t.sleep(400);
    const row = await t.ev(`(() => { const tabs = [...document.querySelectorAll('.nav .tab')]; return { n: tabs.length, tops: [...new Set(tabs.map(x => Math.round(x.getBoundingClientRect().top)))].length }; })()`);
    // admin có thể có thêm tab (vd Quản trị của 3A) ⇒ kiểm MỌI tab nằm trên 1 hàng, không đếm cứng
    ok('home-hook: mobile 390px — mọi tab của thanh đáy (gồm Trang thông tin) nằm trên 1 hàng', row && row.n >= 5 && row.tops === 1, row);
    await t.page.setViewport({ width: 1440, height: 900 });

    // Đổi sự kiện khi còn thay đổi chưa lưu: confirm lần 1 = Huỷ, lần 2 = Đồng ý.
    await t.ev(`window.__confirms = []; window.confirm = m => { window.__confirms.push(m); return window.__confirms.length > 1; }, 1`);
    await setVal('hero.subtitle', 'chưa lưu');
    const pick = id => t.ev(`(() => { const s = document.getElementById('homeEvent'); s.value = '${id}'; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
    await pick('faraday-2026');
    const r2 = await t.ev(`({ sel: document.getElementById('homeEvent').value, ev: HomeEditor.eventId })`);
    await pick('faraday-2026');
    const switched = await t.waitFor(`HomeEditor.eventId === 'faraday-2026' && !!document.querySelector('#homeEditorMount .he-bar')`, 10000);
    const r3 = await t.ev(`({ n: window.__confirms.length, txt: (document.querySelector('.he-ev') || {}).textContent || '' })`);
    ok('home-hook: đổi sự kiện khi chưa lưu — Huỷ ⇒ ở lại, Đồng ý ⇒ mở sự kiện mới', r2 && r2.sel === 'tnt-mini-outing' && r2.ev === 'tnt-mini-outing' && switched
      && r3.n === 2 && /Faraday Pick Your Squad/.test(r3.txt), { r2, r3 });
    ok('home-hook: không exception JS', t.errs.length === 0, t.errs);
  },
};
