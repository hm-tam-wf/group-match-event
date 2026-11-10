'use strict';
// Tab Đăng ký: tên file Xuất = sự kiện của DỮ LIỆU đang hiển thị, dropdown tự tải, "Bỏ chặn" mở rộng, signups.icon sai kiểu.
// Dữ liệu: mock-firebase.js (sự kiện tnt-mini-outing / faraday-2026 / q2-team-building). ?delay=300 giả lập mạng chậm.
module.exports = {
  async run(t) {
    const { ev, waitFor, ok, sleep } = t;
    await t.navigate(t.url('tab=signups&delay=300'));
    const rows = `document.querySelectorAll('#tbody tr').length`;
    // hook ?tab=signups của build bấm Tải ở ~500ms — với delay=300 dropdown còn rỗng ⇒ tự chọn + tải khi dropdown đã có sự kiện
    await waitFor(`!!document.querySelector('#sigSelect option[value="tnt-mini-outing"]')`, 10000);
    await ev(`(() => { document.getElementById('sigSelect').value = 'tnt-mini-outing'; document.getElementById('btnLoad').click(); })()`);
    ok('tải bảng Đăng ký của sự kiện đang mở', await waitFor(`${rows} >= 12 && !document.querySelector('#tbody .skel, #tbody .skeleton')`, 10000), await ev(rows));
    await ev(`window.__exp = []; window.XLSX = { utils: { json_to_sheet: () => ({}), book_new: () => ({}), book_append_sheet() {} }, writeFile: (wb, n) => window.__exp.push(n) }; 1`);

    // ── Xuất file = sự kiện của dữ liệu đang hiển thị ──
    await ev(`document.getElementById('btnExcel').click()`);
    ok('Xuất: tên file = sự kiện đang hiển thị', (await ev(`window.__exp[0]`)) === 'tnt-mini-outing.xlsx', await ev(`window.__exp`));
    // kịch bản lỗi cũ: đổi dropdown rồi bấm Xuất NGAY khi bảng mới chưa tải xong (mạng chậm 300ms)
    await ev(`(() => { const s = document.getElementById('sigSelect'); s.value = 'faraday-2026'; s.dispatchEvent(new Event('change')); document.getElementById('btnExcel').click(); })()`);
    ok('đổi dropdown + Xuất ngay: file vẫn mang tên sự kiện của DỮ LIỆU (không lệch tên)', (await ev(`window.__exp[1]`)) === 'tnt-mini-outing.xlsx', await ev(`window.__exp`));
    await sleep(1200);
    await ev(`document.getElementById('loadErr').textContent = ''; document.getElementById('btnExcel').click()`);
    ok('dropdown tự tải sự kiện mới (0 đăng ký ⇒ Xuất báo không có dữ liệu)', (await ev(`window.__exp.length`)) === 2 && /Chưa có dữ liệu/.test(await ev(`document.getElementById('loadErr').textContent`)),
      { exp: await ev(`window.__exp`), err: await ev(`document.getElementById('loadErr').textContent`) });
    // đổi nhanh 2 lần liên tiếp ⇒ chỉ lần mới nhất được vẽ
    await ev(`(() => { const s = document.getElementById('sigSelect'); s.value = 'q2-team-building'; s.dispatchEvent(new Event('change')); s.value = 'tnt-mini-outing'; s.dispatchEvent(new Event('change')); })()`);
    await sleep(1500);
    ok('đổi nhanh 2 lần: bảng là sự kiện chọn SAU CÙNG', (await ev(rows)) >= 12, await ev(rows));

    // ── Bỏ chặn: đã ở đội ⇒ giữ dedup; khoá mồ côi ⇒ gỡ; không có khoá ⇒ chỉ mở cổng ──
    const E = `firebase.firestore().collection('events').doc('tnt-mini-outing')`;
    await ev(`(async () => { const e = ${E};
      await e.collection('dedup_keys').doc('22011463').set({ at: 1, icon: '2' }); await e.collection('reg_keys').doc('22011463').set({ at: 1, profiled: true });
      await e.collection('dedup_keys').doc('ORPHAN9').set({ at: 1 }); await e.collection('reg_keys').doc('ORPHAN9').set({ at: 1, profiled: true }); return 1; })()`);
    const unblock = async code => {
      await ev(`document.getElementById('unblockMsg').textContent = ''; document.getElementById('unblockCode').value = ${JSON.stringify(code)}; document.getElementById('btnUnblock').click()`);
      await waitFor(`!!document.querySelector('.cm-confirm')`, 3000); await ev(`document.querySelector('.cm-confirm').click()`);
      await waitFor(`document.getElementById('unblockMsg').textContent.length > 0`, 4000);
      const key = code.trim().toUpperCase().replace(/\s+/g, '');
      return JSON.parse(await ev(`(async () => { const e = ${E}; const [d, r] = await Promise.all([e.collection('dedup_keys').doc(${JSON.stringify(key)}).get(), e.collection('reg_keys').doc(${JSON.stringify(key)}).get()]);
        return JSON.stringify({ dedup: d.exists, reg: r.exists, msg: document.getElementById('unblockMsg').textContent }); })()`));
    };
    const a = await unblock('22011463');
    ok('Bỏ chặn người ĐÃ ở đội: gỡ reg_keys, GIỮ dedup_keys, báo đang ở phòng', a.reg === false && a.dedup === true && /đang ở Phòng 2/.test(a.msg), a);
    await sleep(400);
    const b = await unblock('  orphan9 ');
    ok('Bỏ chặn khoá MỒ CÔI: gỡ cả reg_keys lẫn dedup_keys', b.reg === false && b.dedup === false && /cả khóa chống trùng/.test(b.msg), b);
    await sleep(400);
    const c = await unblock('NOPE1');
    ok('Bỏ chặn mã không có khoá: chỉ báo mở cổng, không lỗi', /Đã mở cổng/.test(c.msg) && !/Lỗi/.test(c.msg), c);

    // ── signups.icon sai kiểu (số / object) không làm bảng trống ──
    await ev(`(async () => { const e = ${E}; await e.collection('signups').doc('s98').set({ name: 'Số Năm', employeeId: '99998', icon: 5 });
      await e.collection('signups').doc('s99').set({ name: 'Object', employeeId: '99999', icon: { x: 1 } }); document.getElementById('btnLoad').click(); return 1; })()`);
    await sleep(1500);
    ok('icon sai kiểu: bảng vẫn hiện đủ (≥14 dòng), không lỗi tải', (await ev(rows)) >= 14 && !(await ev(`document.getElementById('loadErr').textContent`)),
      { rows: await ev(rows), err: await ev(`document.getElementById('loadErr').textContent`) });
    ok('không có exception JS trong suốt bài test', t.errs.length === 0, t.errs);
  },
};
