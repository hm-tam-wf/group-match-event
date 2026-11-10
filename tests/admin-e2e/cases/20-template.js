'use strict';
// Mục 2 — nạp Nhân sự + Phòng từ 1 file mẫu: lỗi từng dòng, chặn mất đội đang có người, nạp thêm / thay an toàn (ghi mới xong mới xoá), xếp sẵn, tải file mẫu.
const H = require('../lib');
const { J, sleep, adb, FV, TS, evRef, seedEvent, getCfg, listCol, fresh, rec, openAdmin, until, clickTab, confirmYes, confirmNo, modalText,
  setVal, waitText, shot, waitDrawerClosed, baseCfg, same, openEdit, newEvent, typeCopy, xlsxFile, dk, fk, RH, upload, uploadTpl, recBatches, USERS } = H;

module.exports = {
  async run() {
    await fresh();
    const E = 'tnt-like';
    const nameField = [{ key: 'name', label: 'Tên công nhân', type: 'text', required: true, placeholder: '' }];
    await seedEvent(E, baseCfg('TNT giống', { fields: nameField, dedupField: 'name', allowlistMode: true, allowlistGenderCheck: true, capacity: 3, caps: { '🌊': 2 },
      icons: [{ icon: '🌊', name: 'Phòng 1 · Team 1', color: '#111111', gender: 'Nữ' }, { icon: '🌸', name: 'Phòng 2 · Team 2', color: '#222222', gender: 'Nữ' }] }), { active: true });
    await evRef(E).collection('allowlist').doc(dk('CŨ NGƯỜI A')).set({ name: 'CŨ NGƯỜI A', gender: 'Nữ', at: TS.now() });
    await evRef(E).collection('allowlist').doc(dk('TRẦN THỊ B')).set({ name: 'TRẦN THỊ B', gender: 'Nam', at: TS.now() });
    await evRef(E).collection('teams').doc('🌊').set({ icon: '🌊', count: 1, names: ['Người Cũ'] });
    const F1 = xlsxFile('f1-loi.xlsx', [['NAME', 'Gender', 'Phòng'], ['A B', 'Nam', ''], ['A  b', 'Nữ', ''], ['C D', 'Khác', ''], ['E F', 'Nam', '9'], ['G H', 'Nam', '1']],
      [RH, [1, 'Phòng 1', 2, 'Nữ', 'Team 1', ''], [3, 'Phòng 2', 'x', 'Nữ', '', '']]);
    const F2 = xlsxFile('f2-mat-doi.xlsx', [['NAME', 'Gender', 'Phòng'], ['NGUYỄN THỊ A', 'Nữ', '']], [RH, [1, 'Phòng Mới', 2, 'Nữ', '', '']]);
    const F3 = xlsxFile('f3-dung.xlsx', [['NAME', 'Gender', 'Phòng'], ['NGUYỄN THỊ A', 'Nữ', ''], ['TRẦN THỊ B', 'Nữ', '2'], ['LÊ THỊ C', '', '']],
      [RH, [1, 'Phòng 1', 2, 'Nữ', 'Team 1', ''], [2, 'Phòng 2', 3, 'Nữ', 'Team 2', ''], [3, 'Phòng 3', 3, '', '', '']]);
    const { page, ctx } = await openAdmin('root');
    await clickTab(page, 'tab-allowlist');
    await until(page, e => document.getElementById('alEvent').value === e && document.getElementById('alDedupField').textContent === 'name', E);
    await recBatches(page);

    // 2a — file lỗi: báo lỗi TỪNG DÒNG, nút nạp khoá
    await uploadTpl(page, F1);
    const p1 = await page.evaluate(() => ({ st: document.querySelector('#tplPreview .tpl-status').textContent, errs: [...document.querySelectorAll('#tplPreview .tpl-msgs.err li')].map(l => l.textContent),
      add: document.getElementById('tplAdd').disabled, rep: document.getElementById('tplReplace').disabled }));
    const want = [/dòng 3 .*trùng với dòng 2/, /"Khác" không hiểu/, /Phòng "9" không hợp lệ/, /là Nam nhưng xếp vào Phòng 1/, /STT phải liên tục/, /Số giường phải là số nguyên/];
    rec('2a', 'file lỗi: liệt kê lỗi từng dòng (trùng tên, giới sai, phòng sai, khác giới, STT, số giường), nút nạp bị khoá',
      want.every(re => p1.errs.some(t => re.test(t))) && p1.add && p1.rep && /lỗi/.test(p1.st), p1);
    await shot(page, 'm2-file-mau-loi-1440');

    // 2b — sheet Phòng làm mất đội đang có người (🌊) ⇒ chặn
    await uploadTpl(page, F2);
    await page.click('#tplAdd');
    await waitText(page, '#tplResult', /đội đang có người/).catch(() => {});
    const blocked = await page.$eval('#tplResult', e => e.textContent);
    const alAfterBlock = Object.keys(await listCol(E, 'allowlist')).length;
    rec('2b', 'nạp làm mất đội đang có người ⇒ chặn, không ghi gì', /đội đang có người sẽ bị mất \(🌊\)/.test(blocked) && alAfterBlock === 2 && !(await page.$('.cm-bg')), { blocked, alAfterBlock });

    // 2c — file đúng, "Nạp thêm": giữ người cũ, cập nhật giới, phòng thay theo sheet (giữ 🌊/🌸 theo tên, phòng mới tự đặt emoji)
    await uploadTpl(page, F3);
    const seedShown = await page.$eval('#tplSeedWrap', e => !e.hidden);
    await shot(page, 'm2-file-mau-xem-truoc-1440');
    await page.click('#tplAdd');
    const conf = await (async () => { await page.waitForSelector('.cm-bg .cm-list'); return modalText(page); })();
    await confirmYes(page);
    await waitText(page, '#tplResult', /Đã nạp/);
    let al = await listCol(E, 'allowlist'), cfg = await getCfg(E);
    const icons = cfg.icons.map(i => i.icon + '|' + i.name + '|' + (i.gender || '') + '|' + i.color);
    rec('2c', 'Nạp thêm: allowlist cũ giữ + 3 người mới (giới TRẦN THỊ B cập nhật Nữ); đội = 3 phòng, 🌊/🌸 giữ khoá+màu theo tên, phòng 3 tự đặt 🐬; capacity 3, caps {🌊:2}',
      seedShown && /thêm \/ cập nhật 3 người/.test(conf) && Object.keys(al).length === 4 && al[dk('TRẦN THỊ B')].gender === 'Nữ' && al[dk('LÊ THỊ C')] && !('gender' in al[dk('LÊ THỊ C')])
      && J(icons) === J(['🌊|Phòng 1 · Team 1|Nữ|#111111', '🌸|Phòng 2 · Team 2|Nữ|#222222', '🐬|Phòng 3||#38bdf8']) && cfg.capacity === 3 && J(cfg.caps) === J({ '🌊': 2 })
      && (await listCol(E, 'teams'))['🌊'].count === 1, { conf, al, icons, capacity: cfg.capacity, caps: cfg.caps });

    // 2d — "Xoá cũ & nạp mới": người không còn trong file bị xoá SAU khi ghi xong danh sách mới; dataEpoch +1
    const epoch0 = cfg.dataEpoch || 0;
    await page.evaluate(() => { window.__ops = []; });
    await uploadTpl(page, F3);
    await until(page, () => !document.getElementById('tplReplace').disabled);
    await page.click('#tplReplace'); await confirmYes(page);
    await waitText(page, '#tplResult', /Đã nạp/);
    al = await listCol(E, 'allowlist'); cfg = await getCfg(E);
    const ops = await page.evaluate(() => window.__ops.filter(o => /\/allowlist\//.test(o)));
    const lastSet = ops.map(o => o.startsWith('set')).lastIndexOf(true), firstDel = ops.findIndex(o => o.startsWith('del'));
    rec('2d', 'Xoá cũ & nạp mới: còn đúng 3 người trong file, "CŨ NGƯỜI A" bị xoá, mọi lệnh xoá chạy SAU mọi lệnh ghi, dataEpoch +1',
      J(Object.keys(al).sort()) === J([dk('LÊ THỊ C'), dk('NGUYỄN THỊ A'), dk('TRẦN THỊ B')].sort()) && firstDel > lastSet && lastSet >= 0 && (cfg.dataEpoch || 0) === epoch0 + 1,
      { keys: Object.keys(al), ops, epoch: cfg.dataEpoch });

    // 2e — xếp sẵn: bắt gõ ID, xoá đăng ký cũ, xếp TRẦN THỊ B vào Phòng 2 (🌸) đúng shape seed (k1 + m~fold {at,icon})
    await uploadTpl(page, F3);
    await until(page, () => !document.getElementById('tplReplace').disabled);
    await page.click('#tplSeed');
    const addDisabled = await page.$eval('#tplAdd', e => e.disabled);
    await page.click('#tplReplace');
    await page.waitForSelector('.cm-bg .cm-input');
    const confirmDisabled = await page.$eval('.cm-bg .cm-confirm', e => e.disabled);
    await confirmYes(page, { text: E });
    await waitText(page, '#tplResult', /xếp sẵn/, 20000);
    const teams = await listCol(E, 'teams'), dkeys = await listCol(E, 'dedup_keys'), sig = await listCol(E, 'signups'), mem = await listCol(E, 'members');
    const k = dk('TRẦN THỊ B');
    rec('2e', 'Xếp sẵn: bắt gõ ID, nút "Nạp thêm" khoá; đội cũ bị xoá; 🌸 = [TRẦN THỊ B]; members/signups seed_; dedup k1 + m~fold {at, icon:🌸}',
      addDisabled && confirmDisabled && !teams['🌊'] && J(teams['🌸']) === J({ icon: '🌸', count: 1, names: ['TRẦN THỊ B'] })
      && mem['seed_' + k] && mem['seed_' + k].icon === '🌸' && sig['seed_' + k] && sig['seed_' + k].icon === '🌸'
      && dkeys[k] && dkeys[k].icon === '🌸' && dkeys['m~' + fk('TRẦN THỊ B')] && dkeys['m~' + fk('TRẦN THỊ B')].icon === '🌸', { teams, dkeys: Object.keys(dkeys), mem, sig: Object.keys(sig) });

    // 2f — tải file mẫu: sinh tại chỗ, 3 sheet, cột theo ô kiểm tra trùng, sheet Phòng điền sẵn đội hiện có
    await page.evaluate(() => { window.__dl = null; XLSX.writeFile = (wb, n) => { window.__dl = { n, sheets: wb.SheetNames, people: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }), rooms: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { header: 1 }) }; }; });
    await page.click('#tplDownload');
    await until(page, () => !!window.__dl);
    const dl = await page.evaluate(() => window.__dl);
    rec('2f', 'Tải file mẫu: tên file theo sự kiện, sheet Nhân sự/Phòng/Hướng dẫn, header NAME|Gender|Phòng, Phòng điền sẵn 3 đội kèm emoji',
      dl.n === 'mau-nhan-su-phong-tnt-like.xlsx' && J(dl.sheets) === J(['Nhân sự', 'Phòng', 'Hướng dẫn']) && J(dl.people[0]) === J(['NAME', 'Gender', 'Phòng'])
      && dl.rooms.length === 4 && J(dl.rooms[1]) === J([1, 'Phòng 1', 2, 'Nữ', 'Team 1', '🌊']) && dl.rooms[3][5] === '🐬', dl);

    // 2g — nhập Excel đơn giản ("Xoá cũ & nạp mới" cũ) cũng ghi mới xong mới xoá
    await page.evaluate(() => { window.__ops = []; });
    const F5 = xlsxFile('f5-don-gian.xlsx', [['NAME', 'Gender'], ['PHẠM VĂN D', 'Nam']], null);
    await upload(page, '#alFile', F5);
    await until(page, () => !document.getElementById('alReplace').disabled);
    await page.click('#alReplace'); await confirmYes(page);
    await waitText(page, '#alResult', /Đã nhập/);
    al = await listCol(E, 'allowlist');
    const ops2 = await page.evaluate(() => window.__ops.filter(o => /\/allowlist\//.test(o)));
    rec('2g', 'Nhập Excel cũ — Xoá cũ & nạp mới: chỉ còn PHẠM VĂN D, xoá chạy sau ghi', J(Object.keys(al)) === J([dk('PHẠM VĂN D')]) && ops2[0].startsWith('set') && ops2.slice(1).every(o => o.startsWith('del')), { al: Object.keys(al), ops2 });

    await shot(page, 'm2-file-mau-390', { width: 390, height: 844 });
    await page.evaluate(() => document.getElementById('tplPanel').scrollIntoView());
    await shot(page, 'm2-file-mau-390-panel');
    await ctx.close();
  },
};
