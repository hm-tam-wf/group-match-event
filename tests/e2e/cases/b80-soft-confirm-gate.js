'use strict';
// Layer B — hộp xác nhận ở cổng init: loader không được che modal (W1), reg_keys (W2), đổi dataEpoch (W3). Allowlist tắt.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, dedupKey, ev, sleep } = L;
    const { openDevice, load, until, enterName, ui, seedFor, LSK, OFF_CFG, NAMES, regOff, waitSoft, softInfo, clickSoft, noSoftModal, qState } = B;
    const { HUNG, HUNG_PART, THANH, THANH2 } = NAMES;
    const loaderHidden = dev => dev.page.evaluate(() => { const l = document.getElementById('appLoading'); if (!l) return true; const cs = getComputedStyle(l); return l.hidden || cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none'; });

    // W1 — hồ sơ "Thanh" đã lưu, softNo trống, chưa join; "Thành" đăng ký ở máy khác; RELOAD máy Thanh ⇒ modal PHẢI bấm được thật (không bị loader che)
    await reset(OFF_CFG);
    {
      const Bd = await openDevice(browser, 'W1'); await enterName(Bd, THANH);
      await until(Bd, () => !document.getElementById('profileModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000);   // chưa ai khớp ⇒ không hỏi, hồ sơ đã lưu
      const noModalYet = await noSoftModal(Bd);
      await regOff('w1a', '🌸', THANH2);                                          // Thành đăng ký SAU
      await load(Bd, false, true); await waitSoft(Bd);
      const info = await softInfo(Bd);
      await clickSoft(Bd, '#softNo');                                               // click chuột thật + assert elementFromPoint (ném lỗi nếu bị che)
      await until(Bd, () => !document.getElementById('softConfirmModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000);
      await sleep(900);
      const u1 = await ui(Bd); const lh = await loaderHidden(Bd);
      await load(Bd, true, true); await sleep(1200); const u2 = await ui(Bd); const gone = await noSoftModal(Bd);
      record('W1', 'reload khi hồ sơ "Thanh" đã lưu, "Thành" đăng ký sau: modal ở init gate bấm được THẬT', 'modal hiện, click chuột thật vào "Không" thành công (không bị loader che); sau đó lưới mở, loader ẩn; reload lần nữa không hỏi lại',
        J({ noModalYet, cands: info && info.cands, afterNo: qState(u1), loaderHidden: lh, reload: qState(u2), noModalAfterReload: gone }),
        noModalYet && info && info.cands.length === 1 && u1.sel > 0 && !u1.remoteView && lh && gone && u2.sel > 0 && u2.claims === 0);
      await Bd.ctx.close();
    }

    // W2 — chọn ứng viên khi RESERVED_KEY = khoá của tên vừa gõ ⇒ reg_keys của tên đó bị xoá + RESERVED_KEY xoá
    await reset(OFF_CFG);
    {
      await regOff('w2a', '🌸', HUNG);
      const rk = dedupKey(HUNG_PART);
      await ev().collection('reg_keys').doc(rk).set({ at: new Date(), profiled: true });           // chỗ giữ cũ của tên gõ thiếu dấu (đã profiled)
      const G = await openDevice(browser, 'W2', { seed: seedFor('uW2gate1', HUNG_PART), wait: false });   // seedFor đặt reservedKey = dedupKey(tên)
      await waitSoft(G);
      const before = await G.page.evaluate(k => localStorage.getItem(k), LSK('reservedKey'));
      await clickSoft(G, 'button[data-i="0"]');
      await until(G, () => remoteView === true, null, 25000).catch(() => {}); await sleep(600);
      const u = await ui(G); const after = await G.page.evaluate(k => localStorage.getItem(k), LSK('reservedKey'));
      const regDoc = await ev().collection('reg_keys').doc(rk).get();
      record('W2', 'chọn ứng viên khi đang giữ reg_keys của tên vừa gõ', 'trước: RESERVED_KEY = khoá tên gõ; sau khi chọn Hùng: reg_keys/{khoá} đã xoá, RESERVED_KEY xoá, remote view 🌸',
        J({ before: before === rk, after, regExists: regDoc.exists, ui: qState(u) }), before === rk && after === null && !regDoc.exists && u.remoteView && u.myIcon === '🌸');
      await G.ctx.close();
    }

    // W3 — đổi dataEpoch (server mới hơn) ⇒ me.softNo bị xoá cùng hồ sơ
    await reset(OFF_CFG);
    {
      const seed = { [LSK('me')]: J({ me: { id: 'uW3', fields: { name: THANH }, softNo: { NGUYENVANTHANH: 'NGUYỄNVĂNTHÀNH' } }, myIcon: null }), [LSK('dataEpoch')]: String(L.EVENT_CFG.dataEpoch - 1) };
      const Bd = await openDevice(browser, 'W3', { seed });
      const st = await Bd.page.evaluate(() => ({ softNo: me.softNo === undefined ? 'undefined' : JSON.stringify(me.softNo), fields: JSON.stringify(me.fields) }));
      const saved = await Bd.page.evaluate(k => JSON.parse(localStorage.getItem(k)).me.softNo === undefined, LSK('me'));
      record('W3', 'dataEpoch đổi => me.softNo bị xoá', 'me.softNo undefined (cả trong localStorage), me.fields rỗng', J({ st, savedWithoutSoftNo: saved }), st.softNo === 'undefined' && st.fields === '{}' && saved);
      await Bd.ctx.close();
    }
  },
};
