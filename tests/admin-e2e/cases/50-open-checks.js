'use strict';
// Mục 5 — kiểm tra cấu hình trước khi Mở sự kiện + cảnh báo đổi ô kiểm tra trùng làm tắt / lệch danh sách cho phép.
const H = require('../lib');
const { J, sleep, adb, FV, TS, evRef, seedEvent, getCfg, listCol, fresh, rec, openAdmin, until, clickTab, confirmYes, confirmNo, modalText,
  setVal, waitText, shot, waitDrawerClosed, baseCfg, same, openEdit, newEvent, typeCopy, xlsxFile, dk, fk, RH, upload, uploadTpl, recBatches, USERS } = H;

module.exports = {
  async run() {
    await fresh();
    const day = 864e5, fut = TS.fromMillis(Date.now() + 2 * day), past = TS.fromMillis(Date.now() - day);
    await seedEvent('ok-ev', baseCfg('Hợp lệ', { closeAt: fut }));
    await seedEvent('past-ev', baseCfg('Đã quá giờ đóng', { closeAt: past }));
    await seedEvent('empty-al', baseCfg('Danh sách trống', { closeAt: fut, allowlistMode: true }));
    await seedEvent('noclose', baseCfg('Chưa đặt giờ đóng', { openAt: fut }));
    await seedEvent('noname', baseCfg('Thiếu ô name', { closeAt: fut, fields: [{ key: 'employeeId', label: 'Mã', type: 'text', required: true, placeholder: '' }] }));
    await seedEvent('baddedup', baseCfg('dedupField sai', { closeAt: fut, dedupField: 'msnv' }));
    await seedEvent('al-ev', baseCfg('Có danh sách', { closeAt: fut, allowlistMode: true }));
    await evRef('al-ev').collection('allowlist').doc('NV001').set({ name: 'A', at: TS.now() });
    const { page, ctx } = await openAdmin('root');
    await clickTab(page, 'tabEvents');
    const active = async () => (await adb.doc('config/active').get()).data().eventId;
    const tryOpen = async id => {
      await page.waitForSelector(`#evListWrap [data-action="open"][data-id="${id}"]`);
      await page.click(`#evListWrap [data-action="open"][data-id="${id}"]`);
      await page.waitForSelector('.cm-bg .cm-confirm'); await sleep(100);
      return page.evaluate(() => ({ title: document.querySelector('.cm-bg .cm-title').textContent, btn: document.querySelector('.cm-bg .cm-confirm').textContent,
        items: [...document.querySelectorAll('.cm-bg .cm-list li')].map(li => (li.className || '-') + ': ' + li.textContent) }));
    };
    const r = {};
    for (const id of ['past-ev', 'empty-al', 'noname', 'baddedup']) { r[id] = await tryOpen(id); if (id === 'past-ev') { await shot(page, 'm5-kiem-tra-mo-1440'); await shot(page, 'm5-kiem-tra-mo-390', { width: 390, height: 844 }); await page.setViewport({ width: 1440, height: 900 }); await sleep(300); } await confirmNo(page); }
    const stillNone = (await active()) === '';
    const errOk = /Chưa mở được/.test(r['past-ev'].title) && r['past-ev'].btn === 'Sửa sự kiện' && r['past-ev'].items.some(t => /^err: Giờ đóng .*đã qua/.test(t))
      && r['empty-al'].items.some(t => /^err: .*danh sách đang TRỐNG/.test(t)) && r['noname'].items.some(t => /^err: Thiếu ô nhập có key "name"/.test(t))
      && r['baddedup'].items.some(t => /^err: Ô kiểm tra trùng "msnv"/.test(t));
    rec('5a', 'lỗi chặn mở: closeAt đã qua, allowlist bật mà rỗng, thiếu key name, dedupField không có ⇒ không mở, config/active giữ nguyên', errOk && stillNone, r);
    // "Sửa sự kiện" trong hộp lỗi mở form của đúng sự kiện
    await tryOpen('past-ev'); await confirmYes(page);
    await page.waitForSelector('#createCard:not([hidden])');
    const editing = await page.$eval('#fId', e => e.value);
    await page.click('#btnCancel'); await sleep(300);
    rec('5b', 'nút "Sửa sự kiện" ở hộp lỗi mở form sửa đúng sự kiện', editing === 'past-ev', editing);
    // cảnh báo (vẫn mở được) + không lỗi
    const w = await tryOpen('noclose'); await confirmYes(page);
    await until(page, () => true); await sleep(400);
    const a1 = await active();
    const k = await tryOpen('ok-ev'); await confirmYes(page); await sleep(400);
    const a2 = await active();
    rec('5c', 'chỉ cảnh báo (chưa đặt giờ đóng, chưa tới giờ mở) ⇒ nút "Vẫn mở sự kiện", mở được; hợp lệ ⇒ "không có lỗi", mở được',
      w.btn === 'Vẫn mở sự kiện' && w.items.some(t => /^warn: Chưa đặt giờ đóng/.test(t)) && w.items.some(t => /^warn: Chưa tới giờ mở/.test(t)) && a1 === 'noclose'
      && k.btn === 'Mở sự kiện' && k.items.some(t => /^ok: .*không có lỗi/.test(t)) && a2 === 'ok-ev', { w, k, a1, a2 });
    // 5d — form: bỏ ô kiểm tra trùng làm TẮT danh sách cho phép ⇒ báo ngay + hộp xác nhận lúc lưu nêu rõ; đổi sang ô khác ⇒ báo lệch danh sách
    await openEdit(page, 'al-ev');
    await page.select('#fDedupField', '');
    const warnOff = await page.$eval('#fAllowWarn', e => e.hidden ? '' : e.textContent);
    await page.click('#btnSave');
    await page.waitForSelector('.cm-bg .cm-list');
    const saveTxt = await modalText(page);
    await confirmNo(page);
    await page.click('#btnCancel'); await sleep(300);
    await openEdit(page, 'al-ev');
    await page.select('#fDedupField', 'name');
    const warnMis = await page.$eval('#fAllowWarn', e => e.hidden ? '' : e.textContent);
    await shot(page, 'm5-canh-bao-doi-o-1440');
    await page.click('#btnCancel'); await sleep(300);
    const cfgAl = await getCfg('al-ev');
    rec('5d', 'bỏ ô kiểm tra trùng ⇒ báo "Đã TẮT" ngay + hộp xác nhận nêu "sẽ bị TẮT"; đổi sang ô khác ⇒ báo danh sách lệch; huỷ thì không lưu',
      /Đã TẮT/.test(warnOff) && /sẽ bị TẮT/.test(saveTxt) && /đối chiếu theo “employeeId”/.test(warnMis) && cfgAl.allowlistMode === true && cfgAl.dedupField === 'employeeId',
      { warnOff, saveTxt, warnMis });
    await ctx.close();
  },
};
