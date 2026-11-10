'use strict';
// Layer B — admin xoá dedup_keys (rồi reg_keys) ⇒ thiết bị đang ở remote view được nhả khi reload.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, makeDevice, claim, NAMED, dedupKey, foldKey, ev, sleep } = L;
    const { openDevice, load, until, enterName, ui } = B;

    await reset();
    {
      const r2 = makeDevice('r2'); await claim(r2, '🌸', NAMED[3]);
      const Bd = await openDevice(browser, 'B7'); await enterName(Bd, NAMED[3]);
      await until(Bd, () => remoteView === true, null, 25000); await sleep(400);
      const before = await ui(Bd);
      await ev().collection('dedup_keys').doc(dedupKey(NAMED[3])).delete();   // admin gỡ 1 người = xoá cả khoá gốc lẫn khoá fold
      await ev().collection('dedup_keys').doc(foldKey(NAMED[3])).delete();
      await load(Bd, true, true); await sleep(900); const u1 = await ui(Bd);
      record('S7[browser] chỉ xoá dedup_keys', 'admin xoá dedup_keys rồi B reload', 'B thoát remote view (myIcon=null, remoteView=false) và không còn ở chế độ xem',
        J({ before: { rv: before.remoteView, ic: before.myIcon }, after: { rv: u1.remoteView, ic: u1.myIcon, sel: u1.sel, dupModal: u1.dupModal, allowModal: u1.allowModal } }), before.remoteView && !u1.remoteView && u1.myIcon === null,
        'nếu reg_keys.profiled vẫn còn thì cổng reg_keys cũ có thể vẫn chặn (dupModal) — xem actual');
      const canJoin = u1.sel > 0;
      // bước 2: xoá tiếp reg_keys (admin "Bỏ chặn") => join được
      await ev().collection('reg_keys').doc(dedupKey(NAMED[3])).delete();
      await load(Bd, true, true); await sleep(900); const u2 = await ui(Bd);
      record('S7b[browser] xoá thêm reg_keys', 'admin xoá thêm reg_keys rồi B reload', 'B được nhả hẳn: tile bật, không modal chặn', J({ sel: u2.sel, dupModal: u2.dupModal, rv: u2.remoteView, ic: u2.myIcon, joinableAfterStep1: canJoin }), u2.sel > 0 && !u2.dupModal && !u2.remoteView);
      await Bd.ctx.close();
    }
  },
};
