'use strict';
// Mục 3 — nhân bản như clone-event.js: chép mọi key cấu hình + profile + allowlist + meta/home, KHÔNG chép đăng ký, dataEpoch 1.
const H = require('../lib');
const { J, sleep, adb, FV, TS, evRef, seedEvent, getCfg, listCol, fresh, rec, openAdmin, until, clickTab, confirmYes, confirmNo, modalText,
  setVal, waitText, shot, waitDrawerClosed, baseCfg, same, openEdit, newEvent, typeCopy, xlsxFile, dk, fk, RH, upload, uploadTpl, recBatches, USERS } = H;

module.exports = {
  async run() {
    await fresh();
    const S = 'src-ev';
    const upd = TS.fromMillis(Date.now() - 3600e3);
    await seedEvent(S, baseCfg('Sự kiện gốc', { caps: { '🦊': 2 }, allowlistMode: true, eventId: S, futureKey: { a: 1 }, dataEpoch: 7, updatedAt: upd,
      profile: { variant: 'tnt', lang: 'vi', homeUrl: 'home.html?e=' + S, copy: { vi: { 'banner.sub': 'Phụ đề gốc' } } } }));
    for (const [k, n] of [['NV001', 'An'], ['NV002', 'Bình'], ['NV003', 'Chi']]) await evRef(S).collection('allowlist').doc(k).set({ name: n, gender: 'Nam', at: TS.now() });
    await evRef(S).collection('meta').doc('home').set({ hero: 'Xin chào', cta: 'Vào chọn phòng' });
    await evRef(S).collection('teams').doc('🦊').set({ icon: '🦊', count: 1, names: ['An'] });
    await evRef(S).collection('members').doc('u1').set({ icon: '🦊', at: TS.now() });
    await evRef(S).collection('signups').doc('u1').set({ name: 'An', employeeId: 'NV001', playerId: 'u1', icon: '🦊', at: TS.now() });
    await evRef(S).collection('dedup_keys').doc('NV001').set({ at: TS.now(), icon: '🦊' });
    await evRef(S).collection('reg_keys').doc('NV001').set({ at: TS.now(), profiled: true });
    const srcCfg = await getCfg(S);
    const { page, ctx } = await openAdmin('root');
    await clickTab(page, 'tabEvents');
    const openClone = async () => {
      await page.waitForSelector(`#evListWrap [data-action="clone"][data-id="${S}"]`);
      await page.click(`#evListWrap [data-action="clone"][data-id="${S}"]`);
      await page.waitForSelector('#createCard:not([hidden])');
      await until(page, () => /người/.test(document.getElementById('fCloneAllowN').textContent));
    };
    // 3a — nhân bản đủ: cấu hình + key lạ + profile (homeUrl trỏ ID mới) + allowlist + meta/home; KHÔNG dữ liệu đăng ký; dataEpoch 1
    await openClone();
    const ui = await page.evaluate(() => ({ n: fCloneAllowN.textContent, home: !fCloneHomeWrap.hidden, fs: !fsClone.hidden, btn: btnSave.textContent }));
    await shot(page, 'm3-nhan-ban-1440'); await shot(page, 'm3-nhan-ban-390', { width: 390, height: 844 }); await page.setViewport({ width: 1440, height: 900 }); await sleep(300);
    await setVal(page, '#fId', 'dst-ev');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    const dst = await getCfg('dst-ev');
    const list = (await adb.doc('config/eventList').get()).data().ids;
    const keysOk = J(Object.keys(dst).filter(k => k !== 'createdAt').sort()) === J(Object.keys(srcCfg).filter(k => k !== 'createdAt' && k !== 'updatedAt').sort());
    const al = await listCol('dst-ev', 'allowlist'), home = (await evRef('dst-ev').collection('meta').doc('home').get()).data();
    const regs = await Promise.all(['teams', 'members', 'signups', 'dedup_keys', 'reg_keys'].map(c => listCol('dst-ev', c).then(o => Object.keys(o).length)));
    rec('3a', 'nhân bản: mọi key cấu hình (kể cả key lạ) trừ createdAt/updatedAt, dataEpoch 1, profile giữ chữ + homeUrl trỏ ID mới, 3 người allowlist, meta/home; 0 dữ liệu đăng ký; vào eventList',
      ui.fs && ui.home && /3 người/.test(ui.n) && ui.btn === 'Tạo bản sao' && keysOk && dst.dataEpoch === 1 && J(dst.futureKey) === J({ a: 1 }) && dst.eventId === S && !('updatedAt' in dst)
      && J(dst.caps) === J({ '🦊': 2 }) && dst.allowlistMode === true && dst.profile.homeUrl === 'home.html?e=dst-ev' && dst.profile.copy.vi['banner.sub'] === 'Phụ đề gốc' && dst.profile.variant === 'tnt'
      && Object.keys(al).length === 3 && al.NV002.name === 'Bình' && home && home.hero === 'Xin chào' && regs.every(n => n === 0) && list.includes('dst-ev'),
      { ui, keys: Object.keys(dst), dataEpoch: dst.dataEpoch, profile: dst.profile, al: Object.keys(al), home, regs });
    // 3b — đổi ô kiểm tra trùng khi chép allowlist ⇒ hỏi lại; huỷ thì không tạo; bỏ chép allowlist thì tạo luôn, không có allowlist
    await openClone();
    await setVal(page, '#fId', 'dst-two');
    await page.evaluate(() => { const s = document.getElementById('fDedupField'); s.value = 'name'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.click('#btnSave');
    await page.waitForSelector('.cm-bg .cm-confirm');
    const warnTxt = await modalText(page);
    await confirmNo(page);
    const notCreated = !(await getCfg('dst-two'));
    await page.click('#fCloneAllow');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    const two = await getCfg('dst-two'), al2 = await listCol('dst-two', 'allowlist');
    rec('3b', 'đổi ô kiểm tra trùng + chép allowlist ⇒ hỏi lại (huỷ = không tạo); bỏ chép ⇒ tạo, allowlist rỗng, dedupField mới',
      /không khớp ai/.test(warnTxt) && notCreated && two && two.dedupField === 'name' && Object.keys(al2).length === 0, { warnTxt, notCreated, dedup: two && two.dedupField, al2 });
    await ctx.close();
  },
};
