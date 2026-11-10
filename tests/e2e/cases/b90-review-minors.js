'use strict';
// Layer B — các lỗi minor đã sửa (R1..R5): count về 0 khi đang remote view, icon giả, seed shape mới, lỗi mạng membership, admin un-join.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, snap, makeDevice, claim, FAKE, NAMED, dedupKey, ev, sleep } = L;
    const { srv, openDevice, load, until, enterName, ui, LSK, seedFor } = B;
    const reasonOf = u => J({ rv: u.remoteView, ic: u.myIcon, dupBlocked: u.dupBlocked, dupModal: u.dupModal, sel: u.sel, claims: u.claims });

    // R1 — count về 0 khi ĐANG remote view ⇒ KHÔNG mở lại lưới, KHÔNG lặp join→DUP→remote view; reload vẫn chặn
    await reset();
    {
      await claim(makeDevice('r1roomie'), '🌸', FAKE(1));
      await claim(makeDevice('r1a'), '🌸', NAMED[0]);
      const Bd = await openDevice(browser, 'R1'); await enterName(Bd, NAMED[0]);
      await until(Bd, () => remoteView === true, null, 25000); await sleep(400);
      const before = await ui(Bd);
      await ev().collection('teams').doc('🌸').set({ icon: '🌸', count: 0, names: [] });      // admin un-join hết phòng 🌸 (count 0)
      await sleep(2500);
      const u = await ui(Bd);
      await load(Bd, true, true); await sleep(900); const u2 = await ui(Bd);
      record('R1', 'count phòng về 0 khi đang remote view', 'thoát remote view và CHẶN (dup modal); 0 tile bật; apiClaim 0 lần (không lặp); reload vẫn chặn',
        J({ before: { rv: before.remoteView }, after: reasonOf(u), reload: reasonOf(u2) }),
        before.remoteView && !u.remoteView && !u.myIcon && u.dupBlocked && u.dupModal && u.sel === 0 && u.claims === 0 && !u2.remoteView && !u2.myIcon && u2.dupBlocked && u2.sel === 0 && u2.claims === 0);
      await Bd.ctx.close();
    }

    // R2 — dedup_keys có icon GIẢ (tên không nằm trong teams[icon].names): popup + init gate ⇒ không vào remote view, bị chặn
    await reset();
    {
      await claim(makeDevice('r2roomie'), '🌸', FAKE(1));
      const at = new Date();
      for (const k of [dedupKey(NAMED[4]), L.foldKey(NAMED[4])]) await ev().collection('dedup_keys').doc(k).set({ at, icon: '🌸' });   // forged: tên NAMED[4] chưa hề vào phòng
      const P = await openDevice(browser, 'R2p'); await enterName(P, 'dang epsilon test');
      await until(P, () => dupBlocked === true, null, 25000).catch(() => {}); await sleep(600);
      const up = await ui(P);
      const G = await openDevice(browser, 'R2g', { seed: seedFor('uR2gate1', NAMED[4]) });
      await until(G, () => dupBlocked === true, null, 25000).catch(() => {}); await sleep(600);
      const ug = await ui(G); const s = await snap();
      record('R2', 'dedup_keys icon giả (tên không có trong teams.names)', 'cả popup lẫn init gate: KHÔNG remote view; dupBlocked + modal chặn; 0 tile; apiClaim 0 lần; teams không đổi',
        J({ popup: reasonOf(up), gate: reasonOf(ug), names: (s.teams['🌸'] || {}).names }),
        !up.remoteView && !up.myIcon && up.dupBlocked && up.dupModal && up.sel === 0 && up.claims === 0 && !ug.remoteView && !ug.myIcon && ug.dupBlocked && ug.dupModal && ug.sel === 0 && ug.claims === 0 && (s.teams['🌸'].names || []).length === 1);
      await P.ctx.close(); await G.ctx.close();
    }

    // R3 — seed bằng admin SDK theo shape MỚI ({at,icon} cho khoá gốc + khoá M; như admin seedTeams / tnt-import) ⇒ máy mới thấy phòng
    await reset();
    {
      const at = new Date(), nm = NAMED[2], pid = 'seed_' + dedupKey(nm);
      await ev().collection('teams').doc('🌸').set({ icon: '🌸', count: 2, names: [FAKE(1), nm] });
      await ev().collection('members').doc(pid).set({ icon: '🌸', at });
      for (const k of [dedupKey(nm), L.mKey(nm)]) await ev().collection('dedup_keys').doc(k).set({ at, icon: '🌸' });   // shape mới: k1 + M (m~fold)
      await ev().collection('signups').doc(pid).set({ name: nm, playerId: pid, icon: '🌸', at });
      const res = [];
      for (const v of ['Pham Gamma Test', nm.toUpperCase(), 'phạm gamma test']) {
        const Bd = await openDevice(browser, 'R3'); await enterName(Bd, v);
        await until(Bd, () => remoteView === true, null, 25000).catch(() => {}); await sleep(500);
        const u = await ui(Bd); const mine = u.mates.filter(m => m.me).map(m => m.t);
        res.push({ v, rv: u.remoteView, ic: u.myIcon, badge: u.badge, mine, sel: u.sel, claims: u.claims });
        await Bd.ctx.close();
      }
      record('R3', 'seed admin SDK shape mới {at,icon} (khoá gốc + fold)', 'cả 3 cách gõ (không dấu / HOA / thường có dấu): remote view 🌸 2/3, is-me = tên seed, 0 tile, apiClaim 0',
        J(res), res.every(r => r.rv && r.ic === '🌸' && r.badge.startsWith('2/') && r.mine.length === 1 && r.mine[0] === NAMED[2] && r.sel === 0 && r.claims === 0));
    }

    // R4 — máy LÀ member thật, apiMyMembership lỗi mạng (undefined): KHÔNG vào remote view; lần sau (mạng ổn) tự khôi phục; nếu đã kẹt remote view thì thoát
    await reset();
    try {
      const m = makeDevice('r4m'); await claim(m, '🌸', NAMED[1]);   // member thật: members/{m.pid}, signups/{m.pid}
      const seedMember = { [LSK('me')]: J({ me: { id: m.pid, fields: { name: NAMED[1] } }, myIcon: null }), [LSK('dataEpoch')]: String(L.EVENT_CFG.dataEpoch) };
      srv.failMem = true;
      const Bd = await openDevice(browser, 'R4', { seed: seedMember }); await sleep(1500);
      const u1 = await ui(Bd); const s1 = await snap();
      srv.failMem = false;
      await load(Bd, true, true); await sleep(1200); const u2 = await ui(Bd); const s2 = await snap();
      record('R4a', 'member thật + apiMyMembership lỗi mạng', 'lần 1 (lỗi mạng): KHÔNG remote view (chặn như cũ), signup còn nguyên; lần 2 (mạng ổn): self-heal khôi phục member (myIcon=🌸, không remote view, không chặn)',
        J({ failMem: reasonOf(u1), signupKept1: !!s1.signups[m.pid], afterReload: reasonOf(u2), signupKept2: !!s2.signups[m.pid] }),
        !u1.remoteView && !u1.myIcon && !!s1.signups[m.pid] && u2.myIcon === '🌸' && !u2.remoteView && !u2.dupBlocked && !!s2.signups[m.pid] && u2.sel === 0);
      await Bd.ctx.close();
      // đã KẸT remote view từ trước (localStorage remoteView:true) ⇒ vào lại với mạng ổn phải THOÁT khỏi remote view
      const seedStuck = { [LSK('me')]: J({ me: { id: m.pid, fields: { name: NAMED[1] } }, myIcon: '🌸', remoteView: true }), [LSK('dataEpoch')]: String(L.EVENT_CFG.dataEpoch) };
      const Cd = await openDevice(browser, 'R4b', { seed: seedStuck }); await sleep(1200);
      const u3 = await ui(Cd); const s3 = await snap();
      record('R4b', 'đã kẹt remote view (localStorage) nhưng máy là member thật', 'thoát remote view, khôi phục member: myIcon=🌸, remoteView=false, banner "Bạn đã chốt…" (không phải remote view), signup còn',
        J({ ui: reasonOf(u3), rvNotMe: u3.rvNotMe, banner: u3.banner.slice(0, 40), signupKept: !!s3.signups[m.pid] }),
        u3.myIcon === '🌸' && !u3.remoteView && !u3.rvNotMe && !!s3.signups[m.pid]);
      await Cd.ctx.close();
    } finally { srv.failMem = false; }

    // R5 — admin un-join (gỡ tên khỏi teams.names + xoá members) nhưng GIỮ dedup_keys: remote view KHÔNG hiện phòng cũ
    await reset();
    {
      await claim(makeDevice('r5roomie'), '🌸', FAKE(1));
      const a = makeDevice('r5a'); await claim(a, '🌸', NAMED[0]);
      // (a) B đang ở remote view rồi admin un-join
      const Bd = await openDevice(browser, 'R5a'); await enterName(Bd, NAMED[0]);
      await until(Bd, () => remoteView === true, null, 25000); await sleep(400);
      await ev().collection('teams').doc('🌸').set({ icon: '🌸', count: 1, names: [FAKE(1)] });
      await ev().collection('members').doc(a.pid).delete();
      await sleep(2500);
      const ua = await ui(Bd);
      // (b) máy mới nhập tên đó sau khi đã un-join (dedup_keys còn)
      const Cd = await openDevice(browser, 'R5b'); await enterName(Cd, 'Le Thi Alpha');
      await until(Cd, () => dupBlocked === true, null, 25000).catch(() => {}); await sleep(600);
      const ub = await ui(Cd); const s = await snap();
      record('R5', 'admin un-join (names + members) nhưng giữ dedup_keys', '(a) máy đang xem: thoát remote view + chặn; (b) máy mới: không hiện phòng cũ, bị chặn; 0 tile; apiClaim 0; dedup_keys còn',
        J({ watching: reasonOf(ua), fresh: reasonOf(ub), dedupLeft: Object.keys(s.dedup).length }),
        !ua.remoteView && !ua.myIcon && ua.dupBlocked && ua.sel === 0 && ua.claims === 0 && !ub.remoteView && !ub.myIcon && ub.dupBlocked && ub.dupModal && ub.sel === 0 && ub.claims === 0 && Object.keys(s.dedup).length >= 3);
      await Bd.ctx.close(); await Cd.ctx.close();
    }
  },
};
