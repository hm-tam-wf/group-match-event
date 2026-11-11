'use strict';
// Mục 4 — thao tác từng người ở tab Đăng ký (đăng ký thật qua api.js): chuyển / gỡ / bỏ chặn / xoá giữ đồng bộ teams, members, signups, dedup_keys k1 + m~, reg_keys.
const H = require('../lib');
const { J, sleep, adb, FV, TS, evRef, seedEvent, getCfg, listCol, fresh, rec, openAdmin, until, clickTab, confirmYes, confirmNo, modalText,
  setVal, waitText, shot, waitDrawerClosed, baseCfg, same, openEdit, newEvent, typeCopy, xlsxFile, dk, fk, RH, upload, uploadTpl, recBatches, USERS } = H;

module.exports = {
  async run() {
    await fresh();
    const E = H.L.EVENT;                                   // thiết bị giả của harness (makeDevice) cố định sự kiện này
    const PCFG = { title: 'Thao tác từng người', subtitle: '', fields: [{ key: 'name', label: 'Họ tên', type: 'text', required: true, placeholder: '' }],
      icons: [{ icon: '🌊', name: 'Phòng 1', color: '#2f80ed' }, { icon: '🌸', name: 'Phòng 2', color: '#e0479e' }, { icon: '🐬', name: 'Phòng 3', color: '#38bdf8' }],
      capacity: 3, caps: {}, openAt: null, closeAt: null, dedupField: 'name', blockDup: true, allowlistMode: false, allowlistNameCheck: false, allowlistGenderCheck: false };
    await seedEvent(E, PCFG, { active: true });
    const dev = {}, join = async (label, name, icon) => {
      const d = H.L.makeDevice(label, { cfg: PCFG }); dev[label] = d;
      await d.call('apiRegReserve', name); await d.call('apiSaveProfile', { playerId: d.pid, fields: { name } });
      if (icon) { const r = await H.L.claim(d, icon, name); if (!r.ok) throw new Error('claim ' + name + ' lỗi: ' + J(r)); }
      return d;
    };
    await join('A', 'Lê Thị Hùng', '🌊'); await join('B', 'Lê Thị Hưng', '🌊'); await join('C', 'Tran Van C', '🌸'); await join('D', 'Phạm Văn Dũng', '🐬');
    await join('E', 'Võ Thị Én', null);
    await evRef(E).collection('dedup_keys').doc(dk('Võ Thị Én')).set({ at: TS.now(), icon: '🌸' });   // khoá mồ côi (un-join cũ quên gỡ)
    const s0 = { dk: await listCol(E, 'dedup_keys'), reg: await listCol(E, 'reg_keys') };
    const M = 'm~' + fk('Lê Thị Hùng'), MD = 'm~' + fk('Phạm Văn Dũng');
    rec('4-seed', 'dữ liệu đầu: 5 hồ sơ (4 đã vào phòng) qua api.js thật; m~ của Hùng/Hưng tạo 1 lần', !!s0.dk[M] && !!s0.dk[MD] && Object.keys(s0.reg).length === 5, { dk: Object.keys(s0.dk), reg: Object.keys(s0.reg) });

    const { page, ctx } = await openAdmin('root');
    await clickTab(page, 'tabSignups');
    await page.select('#sigSelect', E).catch(() => {});
    await until(page, () => document.querySelectorAll('#tbody .row-act').length === 5, null, 15000);
    const openMenu = async (label) => {
      await page.click(`#tbody .row-act[data-pid="${dev[label].pid}"]`);
      await page.waitForSelector('.cm-bg .act-list');
    };
    const pick = async (act) => { await page.click(`.cm-bg .act-btn[data-act="${act}"]`); await until(page, () => !document.querySelector('.cm-bg .act-list'), null, 5000); };
    const waitToast = async re => waitText(page, '#toast', re, 15000);
    // "Chi tiết kỹ thuật" thu gọn ⇒ innerText (modalText) không có; đọc textContent riêng
    const techText = () => page.evaluate(() => { const d = document.querySelector('.cm-bg:not(.is-leaving) .pd-tech'); return d ? d.textContent : ''; });

    // 4a — quyền từng thao tác theo trạng thái (đã vào phòng / chưa); thẻ người ghi đúng tên
    await openMenu('B');
    const st = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.cm-bg .act-btn')].map(b => [b.dataset.act, b.disabled ? 'off:' + b.querySelector('small').textContent : 'on'])));
    const who = await page.evaluate(() => { const b = document.querySelector('.cm-bg .cm-box'); return [b.querySelector('.cm-pname').textContent, b.querySelector('.cm-pmeta').textContent]; });
    await shot(page, 'm4-thao-tac-1440');
    await page.click('.cm-bg .cm-cancel'); await sleep(250);
    await openMenu('E');
    const stE = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.cm-bg .act-btn')].map(b => [b.dataset.act, b.disabled ? 'off' : 'on'])));
    await page.click('.cm-bg .cm-cancel'); await sleep(250);
    rec('4a', 'người ĐÃ vào phòng: chuyển/gỡ/xoá bật, Bỏ chặn khoá kèm lý do; người CHƯA vào phòng: chỉ Bỏ chặn + Xoá; thẻ người = tên + phòng',
      st.move === 'on' && st.unjoin === 'on' && st.delete === 'on' && /gỡ khỏi phòng trước/.test(st.unblock) && J(stE) === J({ move: 'off', unjoin: 'off', unblock: 'on', delete: 'on' })
      && who[0] === 'Lê Thị Hưng' && who[1] === 'Đang ở 🌊 Phòng 1', { st, stE, who });

    // 4b — chuyển B (Hưng) 🌊 → 🐬: count/names 2 đội, members/signups/k1 đổi icon (giữ at), m~ GIỮ (Hùng còn giữ); client join tiếp được
    const k1B0 = s0.dk[dk('Lê Thị Hưng')];
    await openMenu('B'); await pick('move');
    await page.waitForSelector('.cm-bg .pd-opt');
    const pk = await page.evaluate(() => { const b = document.querySelector('.cm-bg .cm-box'); return { confirmOff: b.querySelector('.cm-confirm').disabled,
      opts: [...b.querySelectorAll('.pd-opt')].map(o => o.dataset.icon + (o.querySelector('input').disabled ? ':off' : ':on')) }; });
    await page.click('.cm-bg .pd-opt[data-icon="🐬"]');
    await until(page, () => !document.querySelector('.cm-bg .cm-confirm').disabled && !!document.querySelector('.cm-bg .pd-transfer'), null, 5000);
    const moveTxt = await modalText(page), moveTech = await techText();
    const tr = await page.evaluate(() => [...document.querySelectorAll('.cm-bg .pd-transfer .pd-room')].map(r => r.dataset.icon + ' ' + r.querySelector('.pd-count').textContent));
    await shot(page, 'm4-chuyen-phong-1440');
    await confirmYes(page);
    await waitToast(/Đã chuyển/);
    let T = await listCol(E, 'teams'), Mem = await listCol(E, 'members'), Sig = await listCol(E, 'signups'), DK = await listCol(E, 'dedup_keys');
    const pB = dev.B.pid;
    const okMove = J(T['🌊'].names) === J(['Lê Thị Hùng']) && T['🌊'].count === 1 && J(T['🐬'].names) === J(['Phạm Văn Dũng', 'Lê Thị Hưng']) && T['🐬'].count === 2
      && Mem[pB].icon === '🐬' && Sig[pB].icon === '🐬' && DK[dk('Lê Thị Hưng')].icon === '🐬' && DK[dk('Lê Thị Hưng')].at.toMillis() === k1B0.at.toMillis() && DK[M].icon === '🌊';
    const cJoin = await H.L.claim(H.L.makeDevice('F', { cfg: PCFG }), '🐬', 'Người Mới F');
    rec('4b', 'chuyển phòng: lưới chọn (phòng hiện tại khoá, chưa chọn ⇒ nút khoá), xem trước Từ/Đến đúng sĩ số; teams 2 đội đúng count/names, members/signups/k1 sang 🐬 (giữ at), m~ giữ; client join 🐬 vẫn qua rules',
      okMove && cJoin.ok && pk.confirmOff && J(pk.opts) === J(['🌊:off', '🌸:on', '🐬:on']) && J(tr) === J(['🌊 2 → 1 / 3 người', '🐬 1 → 2 / 3 người'])
      && /trả 1 chỗ/.test(moveTxt) && /Vẫn tính là đã đăng ký/.test(moveTxt) && /chuyển theo/.test(moveTech),
      { T, mem: Mem[pB], sig: Sig[pB], k1: DK[dk('Lê Thị Hưng')], M: DK[M], cJoin, pk, tr, moveTxt, moveTech });

    // 4c — gỡ A (Hùng) khỏi 🌊: trả chỗ, xoá members + k1, signup còn (không icon), m~ GIỮ (Hưng còn giữ), reg_keys giữ; A chọn lại được; "Le Thi Hung" vẫn bị chặn
    await openMenu('A'); await pick('unjoin');
    const unjTxt = await modalText(page), unjTech = await techText();
    await confirmYes(page); await waitToast(/Đã gỡ/);
    T = await listCol(E, 'teams'); Mem = await listCol(E, 'members'); Sig = await listCol(E, 'signups'); DK = await listCol(E, 'dedup_keys'); let REG = await listCol(E, 'reg_keys');
    const pA = dev.A.pid;
    const okUnj = !T['🌊'] && !Mem[pA] && Sig[pA] && !('icon' in Sig[pA]) && !DK[dk('Lê Thị Hùng')] && !!DK[M] && !!REG[dk('Lê Thị Hùng')];
    const reA = await H.L.claim(dev.A, '🌸', 'Lê Thị Hùng');
    const asciiBlocked = await H.L.claim(H.L.makeDevice('G', { cfg: PCFG }), '🌸', 'Le Thi Hung');
    rec('4c', 'gỡ khỏi phòng: 🌊 về 0 người ⇒ xoá doc đội, members/k1 xoá, hồ sơ còn (không icon), m~ giữ vì Hưng còn, reg_keys giữ; máy A chọn lại phòng được; "Le Thi Hung" vẫn bị chặn (m~)',
      okUnj && reA.ok && asciiBlocked.reason === 'dup' && /1 → 0 \/ 3 người/.test(unjTxt) && /chọn lại phòng được/.test(unjTxt) && /Giữ khoá tên không dấu/.test(unjTech),
      { T, mem: Mem[pA], sig: Sig[pA], dk: Object.keys(DK), reA, asciiBlocked, unjTxt, unjTech });

    // 4d — xoá D (Dũng) ở 🐬: đội bớt tên, members/signups/k1/m~/reg_keys của D xoá hết; máy mới đăng ký lại "Phạm Văn Dũng" được.
    // Trước đó: hộp xoá focus sẵn nút Hủy ⇒ Enter = Hủy, không xoá gì.
    await openMenu('D'); await pick('delete');
    await page.waitForSelector('.cm-bg .cm-confirm'); await sleep(120);
    const focusCancel = await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('cm-cancel'));
    await page.keyboard.press('Enter');
    await until(page, () => !document.querySelector('.cm-bg'), null, 5000);
    const enterKept = !!(await listCol(E, 'signups'))[dev.D.pid];
    await openMenu('D'); await pick('delete');
    const delTxt = await modalText(page), delTech = await techText();
    await confirmYes(page); await waitToast(/Đã xoá/);
    T = await listCol(E, 'teams'); Mem = await listCol(E, 'members'); Sig = await listCol(E, 'signups'); DK = await listCol(E, 'dedup_keys'); REG = await listCol(E, 'reg_keys');
    const pD = dev.D.pid;
    const okDel = J(T['🐬'].names) === J(['Lê Thị Hưng', 'Người Mới F']) && T['🐬'].count === 2 && !Mem[pD] && !Sig[pD] && !DK[dk('Phạm Văn Dũng')] && !DK[MD] && !REG[dk('Phạm Văn Dũng')];
    const reD = await H.L.claim(H.L.makeDevice('H', { cfg: PCFG }), '🌸', 'Phạm Văn Dũng');
    rec('4d', 'xoá đăng ký: Enter ở hộp xoá (focus nút Hủy) không xoá; đội bớt đúng tên, members/signups/k1/m~/reg_keys của người đó xoá hết; máy mới đăng ký lại được',
      focusCancel && enterKept && okDel && reD.ok && /Không hoàn tác/.test(delTxt) && /đăng ký lại được từ đầu/.test(delTxt)
      && /Gỡ khoá tên không dấu/.test(delTech) && /Gỡ giữ-chỗ/.test(delTech),
      { focusCancel, enterKept, T: T['🐬'], dk: Object.keys(DK), reg: Object.keys(REG), reD, delTxt, delTech });

    // 4e — bỏ chặn E (chưa vào phòng, có khoá mồ côi): reg_keys + k1 xoá, hồ sơ còn; máy KHÁC đăng ký tên đó được
    await openMenu('E'); await pick('unblock');
    await confirmYes(page); await waitToast(/Đã bỏ chặn/);
    DK = await listCol(E, 'dedup_keys'); REG = await listCol(E, 'reg_keys'); Sig = await listCol(E, 'signups');
    const other = H.L.makeDevice('I', { cfg: PCFG });
    const taken = await other.call('apiRegTaken', 'Võ Thị Én');
    const reE = await H.L.claim(other, '🌊', 'Võ Thị Én');   // 🌸 đã đủ 3 người
    rec('4e', 'bỏ chặn (kèm khoá lúc join): reg_keys + k1 mồ côi xoá, hồ sơ giữ; máy khác không bị chặn và chọn phòng được',
      !REG[dk('Võ Thị Én')] && Sig[dev.E.pid] && taken === false && reE.ok, { dk: Object.keys(DK), reg: Object.keys(REG), taken, reE });

    // 4f — dữ liệu đổi giữa lúc xem và lúc bấm xác nhận ⇒ huỷ cả lượt (transaction), không ghi gì
    await page.click('#btnLoad'); await until(page, () => document.querySelectorAll('#tbody .row-act').length >= 7, null, 15000);
    await openMenu('C'); await pick('unjoin');
    await page.waitForSelector('.cm-bg .cm-confirm');
    const before = await listCol(E, 'teams');
    await evRef(E).collection('signups').doc(dev.C.pid).update({ icon: '🐬' });          // đổi icon sau khi admin đã lập kế hoạch
    await confirmYes(page);
    await waitToast(/Dữ liệu vừa thay đổi/);
    const after = await listCol(E, 'teams');
    rec('4f', 'đổi dữ liệu giữa chừng ⇒ báo "Dữ liệu vừa thay đổi", teams không đổi', J(before) === J(after), { before, after });

    // 4g — lưới chọn phòng: 🌸 đủ 3/3 gắn "Đầy"; chọn vào ⇒ cảnh báo vượt chỗ (3 → 4/3) nhưng nút Chuyển vẫn bật
    await openMenu('B'); await pick('move'); await page.waitForSelector('.cm-bg .pd-opt');
    const fullTags = await page.evaluate(() => [...document.querySelectorAll('.cm-bg .pd-opt[data-icon="🌸"] .pd-tag')].map(x => x.textContent));
    await page.click('.cm-bg .pd-opt[data-icon="🌸"]');
    await until(page, () => !!document.querySelector('.cm-bg .pd-alert'), null, 5000);
    const overTxt = await modalText(page);
    const overOn = await page.evaluate(() => !document.querySelector('.cm-bg .cm-confirm').disabled);
    rec('4g', 'lưới chọn phòng: phòng đủ người gắn "Đầy"; chọn vào ⇒ cảnh báo vượt chỗ, thẻ Đến 3 → 4/3, admin vẫn chuyển được',
      J(fullTags) === J(['Đầy']) && /Phòng đã đủ người/.test(overTxt) && /3 → 4 \/ 3 người/.test(overTxt) && /vượt 1 chỗ/.test(overTxt) && overOn, { fullTags, overTxt, overOn });
    await page.click('.cm-bg .pd-opt[data-icon="🌊"]');
    await shot(page, 'm4-chuyen-phong-390', { width: 390, height: 844 });
    await page.click('.cm-bg .cm-cancel'); await sleep(250);
    await shot(page, 'm4-dang-ky-390');
    await page.setViewport({ width: 1440, height: 900 });
    await ctx.close();
  },
};
