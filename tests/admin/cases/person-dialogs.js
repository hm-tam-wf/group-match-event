'use strict';
// Hộp thao tác từng người (tab Đăng ký) với Firebase GIẢ: thẻ người, lưới chọn phòng (radio: phòng hiện tại khoá, "Đầy", nhãn giới),
// xem trước TRƯỚC → SAU, phòng đủ ⇒ cảnh báo nhưng vẫn cho chuyển, hồ sơ trùng mã ⇒ cảnh báo thay cho "đăng ký lại được",
// hộp xoá/gỡ focus sẵn nút Hủy + Enter = Hủy, chi tiết kỹ thuật thu gọn. Ghi dữ liệu thật (transaction) kiểm ở admin-e2e/40-person.
// Dữ liệu mock-firebase.js: s3 (Phòng 2) và s7 (Phòng 4) CÙNG Mã nhân viên 22011463; sức chứa 8; Phòng 1 + Phòng 3 đủ 8; Phòng 1–4 có giới.
const fs = require('fs');
const path = require('path');
const C = require('../../lib/config');

module.exports = {
  async run(t) {
    const { ev, waitFor, ok, sleep, page } = t;
    const shotDir = path.join(C.OUT, 'admin-shots');
    const shot = async (name, vp) => {
      if (!C.SHOTS) return;
      fs.mkdirSync(shotDir, { recursive: true });
      if (vp) await page.setViewport(vp);
      await sleep(400);
      await page.screenshot({ path: path.join(shotDir, 'nguoi-' + name + '.png') });
    };
    const open = async pid => { await ev(`document.querySelector('#tbody .row-act[data-pid="${pid}"]').click(), 1`); return waitFor(`!!document.querySelector('.cm-bg .act-list')`, 3000); };
    const pick = async act => {
      await ev(`document.querySelector('.cm-bg .act-btn[data-act="${act}"]').click(), 1`);
      const r = await waitFor(`!document.querySelector('.cm-bg .act-list') && !!document.querySelector('.cm-bg:not(.is-leaving) .cm-confirm')`, 3000);
      await sleep(120);                                    // hộp đặt focus sau 30ms
      return r;
    };
    const closeModal = async () => { await ev(`document.querySelector('.cm-bg:not(.is-leaving) .cm-cancel').click(), 1`); await waitFor(`!document.querySelector('.cm-bg')`, 3000); };

    await t.navigate(t.url('tab=signups'));
    await waitFor(`document.querySelectorAll('#tbody .row-act').length >= 12`, 10000);

    // P1 — hộp chọn thao tác: thẻ người (tên + phòng + mã), mỗi thao tác có icon
    await open('s3');
    const sheet = await ev(`(() => { const b = document.querySelector('.cm-bg .cm-box'); return { title: b.querySelector('.cm-title').textContent,
      name: b.querySelector('.cm-pname').textContent, meta: b.querySelector('.cm-pmeta').textContent, av: b.querySelector('.cm-av').textContent,
      acts: [...b.querySelectorAll('.act-btn')].map(x => x.dataset.act + ':' + !!x.querySelector('.act-ic svg')) }; })()`);
    ok('P1 hộp thao tác: thẻ người (chữ cái tên riêng, họ tên, phòng, mã), mỗi thao tác có icon',
      sheet.name === 'Lê Hoàng Cường' && sheet.av === 'C' && sheet.meta === 'Đang ở Phòng 2 · Mã nhân viên: 22011463'
      && JSON.stringify(sheet.acts) === JSON.stringify(['move:true', 'unjoin:true', 'unblock:true', 'delete:true']), sheet);
    await shot('1-thao-tac');

    // P2 — chuyển phòng: lưới 6 phòng; phòng hiện tại khoá; Phòng 1 + 3 "Đầy"; nhãn giới; chưa chọn ⇒ nút Chuyển khoá; focus vào lựa chọn đầu
    await pick('move');
    await waitFor(`!!document.querySelector('.cm-bg .pd-opt')`, 3000);
    const grid = await ev(`(() => { const b = document.querySelector('.cm-bg .cm-box');
      return { opts: [...b.querySelectorAll('.pd-opt')].map(o => o.dataset.icon + '|' + [...o.querySelectorAll('.pd-tag')].map(x => x.textContent).join(',') + '|' + (o.querySelector('input').disabled ? 'off' : 'on')),
        confirmOff: b.querySelector('.cm-confirm').disabled, hint: !!b.querySelector('.pd-hint'), focus: !!document.activeElement && document.activeElement.name === 'pdRoom',
        techClosed: !!b.querySelector('details.pd-tech:not([open])'), person: b.querySelector('.cm-pname').textContent }; })()`);
    ok('P2 lưới chọn phòng: phòng hiện tại khoá "Đang ở", phòng đủ gắn "Đầy", có nhãn giới; chưa chọn ⇒ nút Chuyển khoá, focus lựa chọn đầu, chi tiết kỹ thuật thu gọn',
      JSON.stringify(grid.opts) === JSON.stringify(['1|Nam,Đầy|on', '2|Nữ,Đang ở|off', '3|Nữ,Đầy|on', '4|Nam|on', '5||on', '6||on'])
      && grid.confirmOff && grid.hint && grid.focus && grid.techClosed && grid.person === 'Lê Hoàng Cường', grid);
    await shot('2-chon-phong');

    // P3 — chọn Phòng 4 ⇒ xem trước Từ Phòng 2 (7 → 6/8) Đến Phòng 4 (5 → 6/8), đánh dấu lựa chọn, nút Chuyển bật, không cảnh báo
    await ev(`document.querySelector('.cm-bg .pd-opt[data-icon="4"]').click(), 1`);
    await waitFor(`!!document.querySelector('.cm-bg .pd-transfer')`, 3000);
    const pv = await ev(`(() => { const b = document.querySelector('.cm-bg .cm-box');
      return { rooms: [...b.querySelectorAll('.pd-transfer .pd-room')].map(r => r.dataset.icon + ' ' + r.querySelector('.pd-count').textContent),
        sel: [...b.querySelectorAll('.pd-opt.is-sel')].map(o => o.dataset.icon), on: !b.querySelector('.cm-confirm').disabled, alerts: b.querySelectorAll('.pd-alert').length,
        h4: (b.querySelector('.pd-preview .pd-sec h4') || {}).textContent, items: [...b.querySelectorAll('.pd-preview .pd-items li')].map(li => li.textContent) }; })()`);
    ok('P3 chọn phòng ⇒ xem trước Từ/Đến đúng sĩ số, đánh dấu lựa chọn, bật nút Chuyển; còn chỗ ⇒ không cảnh báo; "Sau khi chuyển" bằng lời thường',
      JSON.stringify(pv.rooms) === JSON.stringify(['2 7 → 6 / 8 người', '4 5 → 6 / 8 người']) && JSON.stringify(pv.sel) === JSON.stringify(['4'])
      && pv.on && pv.alerts === 0 && pv.h4 === 'Sau khi chuyển' && pv.items.some(s => /tải lại trang/.test(s)), pv);
    await shot('3-xem-truoc');

    // P4 — chọn Phòng 1 (đủ 8) ⇒ cảnh báo "Phòng đã đủ người" + thẻ Đến báo vượt (8 → 9/8), nút Chuyển vẫn bật
    await ev(`document.querySelector('.cm-bg .pd-opt[data-icon="1"]').click(), 1`);
    await waitFor(`!!document.querySelector('.cm-bg .pd-alert')`, 3000);
    const full = await ev(`(() => { const b = document.querySelector('.cm-bg .cm-box'); const to = b.querySelector('.pd-room.to');
      return { alert: b.querySelector('.pd-alert').textContent, over: to.classList.contains('over'), cnt: to.querySelector('.pd-count').textContent,
        sub: to.querySelector('.pd-sub').textContent, on: !b.querySelector('.cm-confirm').disabled }; })()`);
    ok('P4 chọn phòng đã đủ ⇒ cảnh báo vượt chỗ, thẻ Đến 8 → 9/8 "vượt 1 chỗ", vẫn cho chuyển',
      /Phòng đã đủ người/.test(full.alert) && /9\/8/.test(full.alert) && full.over && full.cnt === '8 → 9 / 8 người' && full.sub === 'vượt 1 chỗ' && full.on, full);
    await shot('4-vuot-cho');
    await shot('4-vuot-cho-390', { width: 390, height: 844 });
    await page.setViewport({ width: 1440, height: 900 });
    await closeModal();

    // P5 — xoá s3 (cùng mã với s7): nhãn "Không hoàn tác", mục "Sẽ mất", cảnh báo hồ sơ trùng thay cho "đăng ký lại được"; focus sẵn nút Hủy
    await open('s3'); await pick('delete');
    const del = await ev(`(() => { const b = document.querySelector('.cm-bg .cm-box');
      return { badge: (b.querySelector('.cm-badge') || {}).textContent, lost: (b.querySelector('.pd-sec.danger h4') || {}).textContent,
        lostItems: [...b.querySelectorAll('.pd-sec.danger li')].map(li => li.textContent), alert: (b.querySelector('.pd-alert') || {}).textContent || '',
        txt: b.textContent, focusCancel: document.activeElement === b.querySelector('.cm-cancel'), tech: (b.querySelector('.pd-tech') || {}).textContent || '' }; })()`);
    ok('P5 xoá hồ sơ trùng mã: nhãn Không hoàn tác, "Sẽ mất" (hồ sơ + chỗ trong phòng), cảnh báo hồ sơ khác cùng mã, KHÔNG hứa "đăng ký lại được", focus sẵn nút Hủy',
      del.badge === 'Không hoàn tác' && del.lost === 'Sẽ mất' && del.lostItems.length === 2 && /Họ tên, Mã nhân viên, thời gian đăng ký/.test(del.lostItems[0])
      && /Phòng 2 — phòng còn 6\/8 người/.test(del.lostItems[1]) && /Có hồ sơ khác cùng mã nhân viên "22011463"/.test(del.alert)
      && !/đăng ký lại được từ đầu/.test(del.txt) && del.focusCancel && /Giữ giữ-chỗ khi điền form \(reg_keys\): còn hồ sơ khác cùng mã/.test(del.tech), del);
    await shot('5-xoa-trung-ma');

    // P6 — Enter khi đang ở nút Hủy = HỦY (trước đây keydown của hộp chạy trước ⇒ XÁC NHẬN xoá)
    await page.keyboard.press('Enter');
    await waitFor(`!document.querySelector('.cm-bg')`, 3000);
    const still = await ev(`(async () => !!(await firebase.firestore().collection('events').doc('tnt-mini-outing').collection('signups').doc('s3').get()).exists)()`);
    ok('P6 hộp xoá: Enter khi focus ở nút Hủy = Hủy, hồ sơ vẫn còn', still === true, still);

    // P7 — gỡ khỏi phòng s4 (không trùng): thẻ phòng 7 → 6/8, "Sau khi gỡ" (giữ hồ sơ trước), chi tiết kỹ thuật mở ra thấy tên collection
    await open('s4'); await pick('unjoin');
    const unj = await ev(`(() => { const b = document.querySelector('.cm-bg .cm-box'); const d = b.querySelector('details.pd-tech'); d.open = true;
      return { room: (b.querySelector('.pd-room.solo .pd-count') || {}).textContent, h4: [...b.querySelectorAll('.pd-sec h4')].map(h => h.textContent),
        kinds: [...b.querySelectorAll('.pd-items li')].map(li => li.className), techShown: b.innerText.includes('teams/2'),
        focusCancel: document.activeElement === b.querySelector('.cm-cancel') }; })()`);
    ok('P7 gỡ khỏi phòng: thẻ phòng 7 → 6/8, mục "Sau khi gỡ" mở đầu bằng giữ hồ sơ, chi tiết kỹ thuật mở được, focus sẵn nút Hủy',
      unj.room === '7 → 6 / 8 người' && JSON.stringify(unj.h4) === JSON.stringify(['Sau khi gỡ']) && unj.kinds[0] === 'keep' && unj.techShown && unj.focusCancel, unj);
    await shot('7-go-khoi-phong');
    await closeModal();

    ok('P8 không có exception JS', t.errs.length === 0, t.errs);
  },
};
