'use strict';
// Layer B — HỘP XÁC NHẬN cho tên gần giống (Q1..Q7), allowlist tắt.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, snap, FAKE, sleep } = L;
    const { openDevice, load, until, enterName, ui, joinViaUI, waitJoined, settle, seedFor, OFF_CFG, NAMES, regOff, waitSoft, softInfo, clickSoft, noSoftModal, qState } = B;
    const { HUNG, HUNG2, HUNG_PART, THANH, THANH2 } = NAMES;

    // Q1 — Thành đã đăng ký; Thanh gõ ĐÚNG tên mình ⇒ modal hỏi ⇒ "Không" ⇒ đi tiếp (lưới mở); reload KHÔNG hỏi lại; join thành công
    await reset(OFF_CFG);
    {
      await regOff('q1a', '🌸', THANH2);
      const Bd = await openDevice(browser, 'Q1'); await enterName(Bd, THANH);
      await waitSoft(Bd); const info = await softInfo(Bd);
      await clickSoft(Bd, '#softNo');
      await until(Bd, () => !document.getElementById('profileModal') && !document.getElementById('softConfirmModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000);
      const u1 = await ui(Bd);
      await load(Bd, true, true); await sleep(1500);
      const u2 = await ui(Bd); const gone = await noSoftModal(Bd);
      await joinViaUI(Bd, '🐬'); await waitJoined(Bd, '🐬'); await settle(Bd, 800);
      const u3 = await ui(Bd); const s = await snap();
      record('Q1', 'Thành đã đăng ký, Thanh gõ đúng => modal => "Không" => join được; reload không hỏi lại', 'modal có 1 ứng viên "Thành" + nút "Không, tôi là Nguyễn Văn Thanh"; sau "Không" lưới mở; reload KHÔNG hiện modal, lưới vẫn mở; join 🐬 ok; 2 member',
        J({ cands: info && info.cands, no: info && info.no, afterNo: qState(u1), reload: qState(u2), noModalAfterReload: gone, joined: qState(u3), members: Object.keys(s.members).length }),
        info && info.cands.length === 1 && info.cands[0].includes(THANH2) && info.no.includes(THANH) && u1.sel > 0 && !u1.remoteView && gone && u2.sel > 0 && u2.claims === 0 && u3.myIcon === '🐬' && Object.keys(s.members).length === 2);
      await Bd.ctx.close();
    }

    // Q2 — Hùng đã đăng ký; máy mới gõ thiếu dấu (3 kiểu) ⇒ modal ⇒ chọn Hùng ⇒ remote view, me.fields chuẩn hoá, KHÔNG claim/reserve/signup mồ côi
    await reset(OFF_CFG);
    {
      await regOff('q2roomie', '🌸', FAKE(1)); await regOff('q2a', '🌸', HUNG);
      const res = [];
      for (const v of ['Nguyen Văn Hùng', HUNG_PART, 'Nguyễn Van Hùng']) {
        const Bd = await openDevice(browser, 'Q2'); await enterName(Bd, v);
        await waitSoft(Bd); const info = await softInfo(Bd);
        await clickSoft(Bd, 'button[data-i="0"]');
        await until(Bd, () => remoteView === true, null, 25000).catch(() => {}); await sleep(500);
        const u = await ui(Bd); const s = await snap();
        res.push({ v, cands: info && info.cands.length, rv: u.remoteView, ic: u.myIcon, name: u.name, claims: u.claims, sel: u.sel, orphan: !!s.signups[u.pid] || !!s.members[u.pid], reg: Object.keys(s.reg).length });
        await Bd.ctx.close();
      }
      record('Q2', 'Hùng đã đăng ký; gõ "Nguyen Văn Hùng" / "Nguyễn Văn Hung" / "Nguyễn Van Hùng" => modal => chọn Hùng', 'cả 3: modal 1 ứng viên; sau chọn: remote view 🌸, me.fields.name = "Nguyễn Văn Hùng"; apiClaim 0; 0 tile; không reg_keys/signup/member mồ côi',
        J(res), res.every(r => r.cands === 1 && r.rv && r.ic === '🌸' && r.name === HUNG && r.claims === 0 && r.sel === 0 && !r.orphan && r.reg === 0));
      // init gate: hồ sơ lưu sẵn, tải lại trang
      const G = await openDevice(browser, 'Q2g', { seed: seedFor('uQ2gate1', HUNG_PART), wait: false });
      await waitSoft(G); await clickSoft(G, 'button[data-i="0"]');
      await until(G, () => remoteView === true, null, 25000).catch(() => {}); await sleep(500);
      const ug = await ui(G);
      record('Q2g', 'init gate: hồ sơ lưu sẵn "Nguyễn Văn Hung" (Hùng đã đăng ký) => modal => chọn Hùng', 'remote view 🌸, name chuẩn hoá = Hùng; apiClaim 0; 0 tile', qState(ug),
        ug.remoteView && ug.myIcon === '🌸' && ug.name === HUNG && ug.claims === 0 && ug.sel === 0);
      await G.ctx.close();
    }

    // Q3 — THỨ TỰ NGƯỢC: "Nguyễn Văn Hung" (thiếu dấu) đăng ký trước; máy mới gõ ĐÚNG "Nguyễn Văn Hùng" ⇒ modal ⇒ chọn ⇒ remote view
    await reset(OFF_CFG);
    {
      await regOff('q3a', '🌸', HUNG_PART);
      const Bd = await openDevice(browser, 'Q3'); await enterName(Bd, HUNG);
      await waitSoft(Bd); const info = await softInfo(Bd);
      await clickSoft(Bd, 'button[data-i="0"]');
      await until(Bd, () => remoteView === true, null, 25000).catch(() => {}); await sleep(500);
      const u = await ui(Bd); const s = await snap();
      record('Q3', 'thứ tự ngược: "Nguyễn Văn Hung" đã đăng ký, máy mới gõ "Nguyễn Văn Hùng"', 'modal 1 ứng viên "Nguyễn Văn Hung"; chọn => remote view 🌸, name chuẩn hoá = "Nguyễn Văn Hung"; apiClaim 0; chỉ 1 member',
        J({ cands: info && info.cands, ui: qState(u), members: Object.keys(s.members).length }),
        info && info.cands.length === 1 && info.cands[0].includes(HUNG_PART) && u.remoteView && u.myIcon === '🌸' && u.name === HUNG_PART && u.claims === 0 && Object.keys(s.members).length === 1);
      await Bd.ctx.close();
    }

    // Q4 — Hùng + Hưng đã đăng ký; gõ "Nguyễn Văn Hung" ⇒ modal liệt kê 2 người (kèm phòng); chọn Hưng ⇒ remote view phòng Hưng
    await reset(OFF_CFG);
    {
      await regOff('q4a', '🌸', HUNG); await regOff('q4b', '🐬', HUNG2);
      const Bd = await openDevice(browser, 'Q4'); await enterName(Bd, HUNG_PART);
      await waitSoft(Bd); const info = await softInfo(Bd);
      const idx = info.cands.findIndex(t => t.includes(HUNG2));
      await clickSoft(Bd, `button[data-i="${idx}"]`);
      await until(Bd, () => remoteView === true, null, 25000).catch(() => {}); await sleep(500);
      const u = await ui(Bd);
      record('Q4', 'Hùng + Hưng đã đăng ký, gõ "Nguyễn Văn Hung"', 'modal liệt kê đủ 2 người kèm phòng + nút "Không"; chọn Hưng => remote view 🐬, name = Hưng; apiClaim 0',
        J({ cands: info.cands, no: info.no, ui: qState(u) }),
        info.cands.length === 2 && info.cands.some(t => t.includes(HUNG)) && info.cands.every(t => /Phòng|Room/.test(t)) && u.remoteView && u.myIcon === '🐬' && u.name === HUNG2 && u.claims === 0);
      await Bd.ctx.close();
    }

    // Q6 — đã chọn "Không" nhưng TẬP ỨNG VIÊN đổi (Hưng đăng ký thêm) ⇒ reload hỏi lại, lần này liệt kê 2 người
    await reset(OFF_CFG);
    {
      await regOff('q6a', '🌸', HUNG);
      const Bd = await openDevice(browser, 'Q6'); await enterName(Bd, HUNG_PART);
      await waitSoft(Bd); const i1 = await softInfo(Bd); await clickSoft(Bd, '#softNo');
      await until(Bd, () => !document.getElementById('profileModal') && !document.getElementById('softConfirmModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000);
      await regOff('q6b', '🐬', HUNG2);                                         // người mới khớp ⇒ tập ứng viên [Hùng] -> [Hùng, Hưng]
      await load(Bd, false, true); await waitSoft(Bd); const i2 = await softInfo(Bd);
      record('Q6', '"Không" với tập ứng viên cũ; có người mới khớp => hỏi lại', 'lần 1: 1 ứng viên; sau khi Hưng đăng ký và reload: modal hiện lại với 2 ứng viên',
        J({ first: i1 && i1.cands, again: i2 && i2.cands }), i1 && i1.cands.length === 1 && i2 && i2.cands.length === 2);
      await Bd.ctx.close();
    }

    // Q7 — cổng mềm ngay trước apiClaim (doClaim): B vào lưới khi CHƯA ai đăng ký; Hùng đăng ký sau; B bấm chọn phòng bằng tên thiếu dấu ⇒ modal; chọn Hùng ⇒ remote view, KHÔNG gọi claim
    await reset(OFF_CFG);
    {
      const Bd = await openDevice(browser, 'Q7'); await enterName(Bd, 'Nguyen Văn Hùng');
      await until(Bd, () => !document.getElementById('profileModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000);
      await regOff('q7a', '🌸', HUNG); await sleep(800);
      await joinViaUI(Bd, '🐬'); await waitSoft(Bd); const info = await softInfo(Bd);
      await clickSoft(Bd, 'button[data-i="0"]');
      await until(Bd, () => remoteView === true, null, 25000).catch(() => {}); await sleep(600);
      const u = await ui(Bd); const s = await snap();
      record('Q7', 'cổng mềm ngay trước apiClaim (doClaim)', 'bấm chọn phòng 🐬 => modal (toast "Đang ghi nhận…" đã được dẹp); chọn Hùng => remote view 🌸, name = Hùng; apiClaim 0 lần; members chỉ có Hùng; signup của B đã dọn',
        J({ cands: info && info.cands, ui: qState(u), members: Object.keys(s.members).length, signupB: !!s.signups[u.pid] }),
        info && !info.toast && info.cands.length === 1 && u.remoteView && u.myIcon === '🌸' && u.name === HUNG && u.claims === 0 && Object.keys(s.members).length === 1 && !s.signups[u.pid]);
      await Bd.ctx.close();
    }
  },
};
