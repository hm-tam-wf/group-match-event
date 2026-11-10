'use strict';
// Layer B — A đã join (có bạn cùng phòng), các thiết bị B nhập tên đó ⇒ "Bạn đã đăng ký" (remote view):
// biến thể tên (S3/S4), dọn signup mồ côi (S10), "Không phải tôi" (S9a/S9c/S9b). Các kịch bản DÙNG CHUNG trạng thái nên ở 1 file.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, snap, makeDevice, claim, FAKE, NAMED, dedupKey, ev, sleep } = L;
    const { openDevice, load, until, enterName, ui, joinViaUI, waitJoined, firstJoin, settle, roomBase, seedFor, LSK } = B;

    await reset();
    const roomie = makeDevice('roomie'); await claim(roomie, '🌸', FAKE(1));
    const A = await openDevice(browser, 'A');
    await firstJoin(A, NAMED[0], '🌸'); await settle(A, 900);
    const baseSnap = await snap();
    const title = (await ui(A)).lookupTitle;

    // S3 — B fresh, biến thể tên
    const variants = [['khác hoa/thường', 'LÊ THỊ ALPHA'], ['thừa khoảng trắng', '  lê   thị   alpha  '], ['NFD', NAMED[0].normalize('NFD')]];
    let keepB = null;
    for (const [lab, v] of variants) {
      const Bd = await openDevice(browser, 'B3');
      await enterName(Bd, v);
      await until(Bd, () => remoteView === true, null, 25000); await sleep(500);
      const u = await ui(Bd); const s = await snap();
      const mine = u.mates.filter(m => m.me).map(m => m.t);
      const sameServer = J(s.teams) === J(baseSnap.teams) && J(Object.keys(s.members)) === J(Object.keys(baseSnap.members)) && J(Object.keys(s.dedup)) === J(Object.keys(baseSnap.dedup));
      const orphan = !!s.signups[u.pid] || !!s.members[u.pid];
      const pass = u.remoteView && u.myIcon === '🌸' && u.banner.includes(title) && u.roomName.trim() === roomBase('🌸') && u.badge.startsWith('2/')
        && u.mates.length === 2 && u.mates.some(m => m.t === FAKE(1)) && u.mates.some(m => m.t === NAMED[0]) && mine.length === 1 && mine[0] === NAMED[0]
        && u.sel === 0 && u.rvNotMe && u.claims === 0 && sameServer && !orphan;
      // reload => vẫn ở chế độ xem
      await load(Bd, true, true); await sleep(500); const u2 = await ui(Bd); const s2 = await snap();
      const pass2 = u2.remoteView && u2.myIcon === '🌸' && u2.sel === 0 && u2.claims === 0 && !s2.signups[u2.pid] && !s2.members[u2.pid];
      record(`S3[browser] ${lab}`, `B (context sạch) nhập "${v}" => màn "Bạn đã đăng ký" + reload vẫn giữ`,
        'remote view, phòng đúng (🌸 2/3), 2 bạn cùng phòng, is-me khớp A, 0 tile bật, apiClaim 0 lần, server không đổi, không signup/member mồ côi; reload giữ nguyên',
        J({ rv: u.remoteView, ic: u.myIcon, room: u.roomName.trim(), badge: u.badge, mates: u.mates, sel: u.sel, claims: u.claims, sameServer, orphan, reload: { rv: u2.remoteView, ic: u2.myIcon, sel: u2.sel, claims: u2.claims } }), pass && pass2);
      if (!keepB && lab === 'NFD') keepB = Bd; else await Bd.ctx.close();
    }

    // S4 — biến thể KHÔNG dấu "Le Thi Alpha" (+ "LE THI ALPHA", "  le  thi alpha ") nay là CÙNG người => remote view (allowlist BẬT như prod)
    for (const v of ['Le Thi Alpha', 'LE THI ALPHA', '  le   thi  alpha ']) {
      const Bd = await openDevice(browser, 'B4'); await enterName(Bd, v);
      await until(Bd, () => remoteView === true, null, 25000).catch(() => {}); await sleep(500);
      const u = await ui(Bd); const s = await snap();
      const mine = u.mates.filter(m => m.me).map(m => m.t);
      const sameServer = J(s.teams) === J(baseSnap.teams) && J(Object.keys(s.members)) === J(Object.keys(baseSnap.members)) && J(Object.keys(s.dedup)) === J(Object.keys(baseSnap.dedup));
      const orphan = !!s.signups[u.pid] || !!s.members[u.pid];
      record(`S4[browser] "${v}"`, `B (context sạch) nhập KHÔNG dấu "${v}" => remote view đúng phòng`,
        'remote view 🌸 2/3, is-me khớp "Lê Thị Alpha" (so theo khoá fold), 0 tile bật, apiClaim 0 lần, server không đổi, không signup/member mồ côi, không modal chặn',
        J({ remoteView: u.remoteView, ic: u.myIcon, badge: u.badge, mine, sel: u.sel, claims: u.claims, allowModal: u.allowModal, dupModal: u.dupModal, sameServer, orphan }),
        u.remoteView && u.myIcon === '🌸' && u.badge.startsWith('2/') && mine.length === 1 && mine[0] === NAMED[0] && u.sel === 0 && u.claims === 0 && !u.allowModal && !u.dupModal && sameServer && !orphan);
      await Bd.ctx.close();
    }

    // S10 — vào remote view phải dọn signup mồ côi của pid máy này (cổng init + popup lưu)
    for (const via of ['init gate', 'save popup']) {
      const pid = via === 'init gate' ? 'uOrphanInit1' : 'uOrphanPopup';
      await ev().collection('signups').doc(pid).set({ name: NAMED[0], playerId: pid });      // signup mồ côi (đã lỡ lưu ở phiên trước)
      const seed = via === 'init gate' ? seedFor(pid, NAMED[0].toLowerCase()) : { [LSK('me')]: J({ me: { id: pid, fields: {} }, myIcon: null }), [LSK('dataEpoch')]: String(L.EVENT_CFG.dataEpoch) };
      const Bd = await openDevice(browser, 'B10', { seed });
      if (via === 'save popup') await enterName(Bd, '  LÊ THỊ  ALPHA');
      await until(Bd, () => remoteView === true, null, 25000); await sleep(1200);
      const u = await ui(Bd); const s = await snap();
      record(`S10[${via}]`, 'vào remote view => dọn signup mồ côi của pid máy này', 'remote view; signups/{pid} đã bị xoá; không có members/{pid}; signup của A (người thật) còn nguyên',
        J({ rv: u.remoteView, orphanLeft: !!s.signups[pid], member: !!s.members[pid], aSignupKept: Object.values(s.signups).some(x => x.name === NAMED[0] && x.playerId !== pid) }),
        u.remoteView && !s.signups[pid] && !s.members[pid] && Object.values(s.signups).some(x => x.name === NAMED[0] && x.playerId !== pid));
      await Bd.ctx.close();
    }

    // S9 — "Không phải tôi"
    if (keepB) {
      // 9a: bấm "Không phải tôi" rồi Huỷ => KHÔNG được bật lại quyền chọn
      await keepB.page.evaluate(() => document.getElementById('rvNotMe').click()); await sleep(600);
      const u1 = await ui(keepB);
      let cancelClicked = false;
      if (u1.cancelBtn) { cancelClicked = true; await keepB.page.evaluate(() => document.getElementById('pmCancel').click()); await sleep(900); }
      const u2a = await ui(keepB);
      // Lưới có thể chỉ 'khoá giả' vì chưa render lại: gây 1 thay đổi realtime (người khác join) để buộc render theo state THẬT, rồi mới đo.
      await claim(makeDevice('nudge'), '🦈', FAKE(30)); await sleep(2000);
      const u2 = await ui(keepB); u2.selImmediately = u2a.sel;
      const joinEnabled = u2.sel > 0 || u2a.sel > 0;
      record('S9a', '"Không phải tôi" rồi Huỷ popup', 'sau Huỷ: 0 tile bật (không được chọn phòng lại bằng tên đã đăng ký) HOẶC không có nút Huỷ',
        J({ afterNotMe: { profileModal: u1.profileModal, cancelBtn: u1.cancelBtn, myIcon: u1.myIcon }, cancelClicked, afterCancel: { selImmediately: u2a.sel, selAfterRealtimeRender: u2.sel, profileModal: u2.profileModal, remoteView: u2.remoteView, myIcon: u2.myIcon } }), !joinEnabled);
      // 9c: sau "Không phải tôi" nhập lại ĐÚNG tên cũ => quay lại remote view
      if (!u2.profileModal) await keepB.page.evaluate(() => { editing = true; renderProfile(); });   // nếu Huỷ đã đóng popup, mở lại để tiếp tục kịch bản
      await sleep(400);
      await enterName(keepB, 'lê thị alpha'); await until(keepB, () => remoteView === true, null, 20000).catch(() => {}); await sleep(500);
      const u3 = await ui(keepB);
      record('S9c', '"Không phải tôi" => nhập lại tên đã đăng ký', 'quay lại remote view đúng phòng 🌸', J({ rv: u3.remoteView, ic: u3.myIcon, sel: u3.sel, claims: u3.claims }), u3.remoteView && u3.myIcon === '🌸' && u3.sel === 0 && u3.claims === 0);
      await keepB.ctx.close();
    }
    {
      // 9b: "Không phải tôi" => nhập tên khác chưa đăng ký => join bình thường
      const Bd = await openDevice(browser, 'B9b'); await enterName(Bd, NAMED[0].toUpperCase());
      await until(Bd, () => remoteView === true, null, 25000); await sleep(400);
      await Bd.page.evaluate(() => document.getElementById('rvNotMe').click()); await sleep(500);
      await enterName(Bd, FAKE(20));
      await until(Bd, () => !document.getElementById('profileModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000);
      const pre = await ui(Bd);
      await joinViaUI(Bd, '🐬'); await waitJoined(Bd, '🐬'); await settle(Bd, 900);
      const u = await ui(Bd); const s = await snap();
      const rec = s.members[u.pid];
      record('S9b', '"Không phải tôi" => nhập tên KHÁC chưa đăng ký => join bình thường', 'tile bật; join 🐬 thành công; members/{pid}.icon=🐬; remote view tắt',
        J({ selBeforeJoin: pre.sel, myIcon: u.myIcon, remoteView: u.remoteView, memberIcon: rec && rec.icon, dedup: !!s.dedup[dedupKey(FAKE(20))], dedupIcon: (s.dedup[dedupKey(FAKE(20))] || {}).icon }),
        pre.sel > 0 && u.myIcon === '🐬' && !u.remoteView && rec && rec.icon === '🐬' && (s.dedup[dedupKey(FAKE(20))] || {}).icon === '🐬');
      await Bd.ctx.close();
    }
  },
};
