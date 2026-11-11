'use strict';
// Mục 5 (tiếp) — Kết thúc sự kiện = đóng đăng ký THẬT: closeAt = giờ máy chủ ⇒ rules chặn join ở MỌI đường vào (kể cả link riêng ?e=
// và tab mở sẵn — ở đây là thiết bị giả gọi api.js thẳng vào sự kiện, cấu hình cũ chưa có giờ đóng); closeAt đã qua giữ nguyên;
// openAt còn ở tương lai bị bỏ; config/active chỉ gỡ khi còn trỏ vào sự kiện này; danh sách admin tải lại (Sửa → Lưu không ghi đè giờ đóng).
const H = require('../lib');
const { sleep, adb, TS, getCfg, seedEvent, fresh, rec, openAdmin, clickTab, confirmYes, modalText, baseCfg, openEdit } = H;

// Transaction + tải lại danh sách chạy sau khi bấm ⇒ chờ Firestore đổi thay vì sleep cố định.
const waitFor = async (fn, ms = 10000) => {
  const t = Date.now();
  for (;;) { const v = await fn(); if (v || Date.now() - t > ms) return v; await sleep(150); }
};
const msOf = ts => (ts && typeof ts.toMillis === 'function') ? ts.toMillis() : null;

module.exports = {
  async run() {
    await fresh();
    const E = H.L.EVENT;                                   // thiết bị giả (api.js thật + rules thật) ghi thẳng vào sự kiện này = link riêng ?e=
    const day = 864e5, fut = TS.fromMillis(Date.now() + 2 * day), past = TS.fromMillis(Date.now() - day);
    const PCFG = { title: 'Kết thúc thật', subtitle: '', fields: [{ key: 'name', label: 'Họ tên', type: 'text', required: true, placeholder: '' }],
      icons: [{ icon: '🌊', name: 'Phòng 1', color: '#2f80ed' }, { icon: '🌸', name: 'Phòng 2', color: '#e0479e' }],
      capacity: 5, caps: {}, openAt: null, closeAt: null, dedupField: 'name', blockDup: true, allowlistMode: false, allowlistNameCheck: false, allowlistGenderCheck: false };
    await seedEvent(E, PCFG, { active: true });
    await seedEvent('fut-ev', baseCfg('Giờ đóng còn ở tương lai', { closeAt: fut }));
    await seedEvent('past-ev', baseCfg('Giờ đóng đã qua', { closeAt: past }));
    await seedEvent('pre-ev', baseCfg('Chưa tới giờ mở', { openAt: fut }));
    await seedEvent('race-ev', baseCfg('Admin khác vừa đổi sự kiện đang mở'));
    await seedEvent('other-ev', baseCfg('Sự kiện khác'));

    const join = async (label, name, icon) => {
      try {
        const d = H.L.makeDevice(label, { cfg: PCFG });
        await d.call('apiRegReserve', name); await d.call('apiSaveProfile', { playerId: d.pid, fields: { name } });
        return await H.L.claim(d, icon, name);
      } catch (e) { return { ok: false, threw: String(e && (e.code || e.message) || e) }; }
    };
    const before = await join('A', 'Nguyễn Văn An', '🌊');

    const { page, ctx } = await openAdmin('root');
    await clickTab(page, 'tabEvents');
    const active = async () => (await adb.doc('config/active').get()).data().eventId;
    // Bấm Kết thúc trên thẻ sự kiện (nút chỉ có ở sự kiện đang mở) → trả chữ hộp xác nhận
    const endIt = async id => {
      await page.waitForSelector(`#evListWrap [data-action="end"][data-id="${id}"]`, { timeout: 10000 });
      await page.click(`#evListWrap [data-action="end"][data-id="${id}"]`);
      await page.waitForSelector('.cm-bg .cm-confirm'); await sleep(100);
      const txt = await modalText(page);
      await confirmYes(page);
      return txt;
    };
    // Đổi sự kiện đang mở bằng admin SDK rồi bấm Làm mới để thẻ của nó hiện nút Kết thúc
    const makeActive = async id => {
      await adb.doc('config/active').set({ eventId: id });
      await page.evaluate(() => document.getElementById('btnRefresh').click());
      await page.waitForSelector(`#evListWrap [data-action="end"][data-id="${id}"]`, { timeout: 10000 });
    };

    // 5e — sự kiện đang mở, chưa đặt giờ đóng
    const t0 = Date.now();
    const msg = await endIt(E);
    const cfgE = await waitFor(async () => { const c = await getCfg(E); return msOf(c.closeAt) != null ? c : null; });
    const closeE = msOf(cfgE && cfgE.closeAt), aE = await active();
    rec('5e', 'Kết thúc: closeAt = giờ máy chủ lúc bấm, config/active rỗng; hộp xác nhận nói rõ mọi link (kể cả ?e=) ngừng nhận',
      closeE != null && closeE >= t0 - 5000 && closeE <= Date.now() + 5000 && aE === '' && /link riêng \?e=/.test(msg) && /giờ đóng/.test(msg),
      { closeE, t0, aE, msg });

    // 5f — đường không đọc config/active (link riêng ?e=, tab mở sẵn) bị rules chặn
    const after = await join('B', 'Trần Thị Bình', '🌸');
    // api.js trả { ok:false, reason: ERROR, detail } khi rules từ chối ⇒ đòi đúng lỗi quyền, không nhận lỗi khác (tên, sĩ số…)
    const deniedByRules = !!after && after.ok !== true && /permission|insufficient/i.test(String(after.detail || after.threw || ''));
    rec('5f', 'trước Kết thúc đăng ký qua api.js (như link riêng ?e=) vào được; sau Kết thúc bị rules chặn (lỗi quyền)',
      !!before && before.ok === true && deniedByRules, { before, after });

    // 5g — danh sách admin đã tải lại: form Sửa hiện giờ đóng vừa đặt ⇒ Lưu không ghi đè bằng cache cũ (closeAt null)
    await openEdit(page, E);
    const fClose = await page.$eval('#fCloseAt', e => e.value);
    await page.click('#btnCancel'); await sleep(300);
    rec('5g', 'sau Kết thúc, form Sửa hiện giờ đóng mới (danh sách đã tải lại, không còn cache cũ)', !!fClose, { fClose });

    // 5h — giờ đóng còn ở tương lai ⇒ kéo về lúc bấm
    await makeActive('fut-ev');
    const t1 = Date.now();
    await endIt('fut-ev');
    const cfgF = await waitFor(async () => { const c = await getCfg('fut-ev'); return msOf(c.closeAt) < msOf(fut) ? c : null; });
    const closeF = msOf(cfgF && cfgF.closeAt), aF = await active();
    rec('5h', 'giờ đóng còn ở tương lai ⇒ kéo về giờ máy chủ lúc bấm', closeF != null && closeF >= t1 - 5000 && closeF <= Date.now() + 5000 && aF === '',
      { closeF, fut: msOf(fut), aF });

    // 5i — giờ đóng đã qua ⇒ giữ nguyên (không ghi gì vào cấu hình), chỉ gỡ khỏi link gốc
    await makeActive('past-ev');
    await endIt('past-ev');
    const aP = await waitFor(async () => ((await active()) === '' ? 'ok' : null));
    const cfgP = await getCfg('past-ev');
    rec('5i', 'giờ đóng đã qua ⇒ giữ nguyên, không ghi updatedAt; chỉ gỡ config/active',
      aP === 'ok' && msOf(cfgP.closeAt) === msOf(past) && cfgP.updatedAt === undefined, { closeP: msOf(cfgP.closeAt), past: msOf(past), updatedAt: cfgP.updatedAt });

    // 5j — chưa tới giờ mở ⇒ bỏ openAt (trang công khai xét "pre" trước "closed": không bỏ thì vẫn đếm ngược), closeAt = lúc bấm
    await makeActive('pre-ev');
    await endIt('pre-ev');
    const cfgR = await waitFor(async () => { const c = await getCfg('pre-ev'); return msOf(c.closeAt) != null ? c : null; });
    rec('5j', 'chưa tới giờ mở ⇒ openAt bỏ (null), closeAt = lúc bấm', !!cfgR && cfgR.openAt === null && msOf(cfgR.closeAt) != null,
      { openAt: cfgR && cfgR.openAt, closeAt: msOf(cfgR && cfgR.closeAt) });

    // 5k — admin khác vừa Mở sự kiện khác (config/active đã đổi, trang này chưa tải lại) ⇒ không gỡ nhầm, vẫn đóng sự kiện được bấm
    await makeActive('race-ev');
    await adb.doc('config/active').set({ eventId: 'other-ev' });
    await endIt('race-ev');
    const cfgK = await waitFor(async () => { const c = await getCfg('race-ev'); return msOf(c.closeAt) != null ? c : null; });
    const aK = await active();
    rec('5k', 'config/active đã trỏ sự kiện khác ⇒ giữ nguyên; sự kiện được bấm vẫn được đặt giờ đóng', !!cfgK && aK === 'other-ev',
      { aK, closeK: msOf(cfgK && cfgK.closeAt) });
    await ctx.close();
  },
};
