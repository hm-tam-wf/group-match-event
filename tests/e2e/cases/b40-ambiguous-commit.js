'use strict';
// Layer B — commit mơ hồ: server đã ghi nhưng UI chưa biết; người dùng bấm lại phòng khác; reload tự hồi phục.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, snap, NAMED, sleep } = L;
    const { openDevice, load, until, enterName, ui, joinViaUI, settle } = B;

    await reset();
    {
      const d = await openDevice(browser, 'B5'); await enterName(d, NAMED[1]);
      await until(d, () => !document.getElementById('profileModal') && document.querySelectorAll('#grid .tile.sel').length > 0, null, 25000);
      const direct = await d.page.evaluate(async () => { const f = Object.assign({}, me.fields); const r = await apiClaim({ icon: '🐬', playerId: me.id, fields: f }); return JSON.parse(JSON.stringify(r)); });
      const pre = await ui(d);                                          // UI vẫn chưa biết đã join
      await joinViaUI(d, '🌸');                                         // người dùng bấm lại (retry) vào phòng KHÁC
      await until(d, () => myIcon !== null, null, 20000); await settle(d, 900);
      const u = await ui(d); const s = await snap();
      record('S5[browser]', 'claim đã commit (UI chưa biết) rồi bấm lại phòng khác', 'ALREADY+icon => UI hiện phòng đã vào 🐬 (banner "Bạn đang ở…"), không remote view; tổng count=1',
        J({ direct: direct.ok, selBefore: pre.sel, myIcon: u.myIcon, remoteView: u.remoteView, banner: u.banner.slice(0, 60), sel: u.sel, total: L.totalCount(s) }),
        direct.ok && pre.myIcon === null && pre.sel > 0 && u.myIcon === '🐬' && !u.remoteView && u.sel === 0 && L.totalCount(s) === 1);
      await load(d, true, true); await sleep(500); const u2 = await ui(d);
      record('S5[browser] reload', 'reload sau commit mơ hồ', 'self-heal từ members/{pid}: myIcon=🐬, không remote view', J({ myIcon: u2.myIcon, rv: u2.remoteView }), u2.myIcon === '🐬' && !u2.remoteView);
      await d.ctx.close();
    }
  },
};
