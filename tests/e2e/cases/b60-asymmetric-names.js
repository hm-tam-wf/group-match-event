'use strict';
// Layer B — so BẤT ĐỐI XỨNG có dấu / không dấu trên UI thật (H1..H5), allowlist tắt.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, snap, FAKE, sleep } = L;
    const { openDevice, until, enterName, ui, firstJoin, settle, roomBase, OFF_CFG, NAMES, regOff } = B;
    const { HUNG, HUNG2 } = NAMES;
    const modalText = dev => dev.page.evaluate(() => (document.querySelector('#dupBlockedModal p') || {}).innerText || '');
    const hState = u => J({ rv: u.remoteView, ic: u.myIcon, dupBlocked: u.dupBlocked, dupModal: u.dupModal, sel: u.sel, claims: u.claims });

    // H1 — "Hùng" đã đăng ký; "Hưng" (người khác, chỉ khác dấu) KHÔNG bị chặn, join được
    await reset(OFF_CFG);
    {
      await regOff('h1a', '🌸', HUNG);
      const Bd = await openDevice(browser, 'H1'); await firstJoin(Bd, HUNG2, '🐬'); await settle(Bd, 800);
      const u = await ui(Bd); const s = await snap();
      record('H1', '"Hùng" đã đăng ký, "Hưng" (chỉ khác dấu) vẫn join được', 'tile bật, join 🐬 thành công, không remote view; teams có cả hai tên; 2 member',
        J({ ui: hState(u), members: Object.keys(s.members).length, names: [...(s.teams['🌸'] || {}).names || [], ...((s.teams['🐬'] || {}).names || [])] }),
        u.myIcon === '🐬' && !u.remoteView && Object.keys(s.members).length === 2 && (s.teams['🐬'].names || []).includes(HUNG2) && (s.teams['🌸'].names || []).includes(HUNG));
      await Bd.ctx.close();
    }

    // H2 — "Hùng" + "Hưng" đều đã đăng ký; gõ "Nguyen Van Hung" ⇒ thông báo mơ hồ, không chọn được, apiClaim cũng ra DUP
    await reset(OFF_CFG);
    {
      await regOff('h2a', '🌸', HUNG); await regOff('h2b', '🐬', HUNG2);
      const Bd = await openDevice(browser, 'H2'); await enterName(Bd, 'Nguyen Van Hung');
      await until(Bd, () => dupBlocked === true, null, 25000).catch(() => {}); await sleep(600);
      const u = await ui(Bd); const txt = await modalText(Bd);
      const direct = await Bd.page.evaluate(async () => { const r = await apiClaim({ icon: '🦈', playerId: me.id, fields: Object.assign({}, me.fields) }); return JSON.parse(JSON.stringify(r)); });
      record('H2', 'Hùng + Hưng đã đăng ký, gõ "Nguyen Van Hung"', 'dupBlocked + modal mơ hồ ("ĐẦY ĐỦ DẤU"/"WITH accents"); 0 tile; không remote view; apiClaim trực tiếp ra DUP',
        J({ ui: hState(u), text: txt.slice(0, 120), direct: direct.reason }),
        !u.remoteView && !u.myIcon && u.dupBlocked && u.dupModal && u.sel === 0 && u.claims === 0 && /ĐẦY ĐỦ DẤU|WITH accents/i.test(txt) && direct.reason === 'dup');
      await Bd.ctx.close();
    }

    // H3 — chỉ "Hùng" đã đăng ký; gõ "nguyen van hung" ⇒ remote view phòng Hùng, đúng tên được tô
    await reset(OFF_CFG);
    {
      await regOff('h3roomie', '🌸', FAKE(1)); await regOff('h3a', '🌸', HUNG);
      const Bd = await openDevice(browser, 'H3'); await enterName(Bd, 'nguyen van hung');
      await until(Bd, () => remoteView === true, null, 25000).catch(() => {}); await sleep(500);
      const u = await ui(Bd); const mine = u.mates.filter(m => m.me).map(m => m.t);
      record('H3', 'chỉ "Hùng" đã đăng ký, gõ "nguyen van hung"', 'remote view 🌸, is-me = "Nguyễn Văn Hùng", 0 tile, apiClaim 0',
        J({ ui: hState(u), mine }), u.remoteView && u.myIcon === '🌸' && mine.length === 1 && mine[0] === HUNG && u.sel === 0 && u.claims === 0 && /dưới tên/.test(u.banner) && u.banner.includes(HUNG));
      await Bd.ctx.close();
    }

    // H4 — "Le Van A" (không dấu) đã đăng ký; gõ "Lê Văn A" (có dấu) ⇒ chặn kèm thông báo tên không dấu + phòng; 0 tile
    await reset(OFF_CFG);
    {
      await regOff('h4a', '🌸', 'Le Van A');
      const Bd = await openDevice(browser, 'H4'); await enterName(Bd, 'Lê Văn A');
      await until(Bd, () => dupBlocked === true, null, 25000).catch(() => {}); await sleep(600);
      const u = await ui(Bd); const txt = await modalText(Bd);
      record('H4', '"Le Van A" đã đăng ký, gõ "Lê Văn A"', 'dupBlocked + modal nêu tên không dấu "Le Van A" và phòng; 0 tile; KHÔNG remote view',
        J({ ui: hState(u), text: txt.slice(0, 160) }),
        !u.remoteView && !u.myIcon && u.dupBlocked && u.dupModal && u.sel === 0 && u.claims === 0 && txt.includes('Le Van A') && txt.includes(roomBase('🌸')));
      await Bd.ctx.close();
    }

    // H5 — "Lê Văn A" đã đăng ký; "Lệ Vân A" (người khác) KHÔNG bị chặn
    await reset(OFF_CFG);
    {
      await regOff('h5a', '🌸', 'Lê Văn A');
      const Bd = await openDevice(browser, 'H5'); await firstJoin(Bd, 'Lệ Vân A', '🐬'); await settle(Bd, 800);
      const u = await ui(Bd); const s = await snap();
      record('H5', '"Lê Văn A" đã đăng ký, "Lệ Vân A" vẫn join được', 'tile bật; join 🐬 thành công; 2 member', J({ ui: hState(u), members: Object.keys(s.members).length }),
        u.myIcon === '🐬' && !u.remoteView && Object.keys(s.members).length === 2);
      await Bd.ctx.close();
    }
  },
};
