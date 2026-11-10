'use strict';
// Layer B — double-click vào phòng trên cùng thiết bị (2 popup xác nhận, bấm cả 2).

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, snap, NAMED } = L;
    const { openDevice, enterName, until, clickTile, confirmAll, waitJoined, settle, ui } = B;

    // S1 (browser): double-click cùng thiết bị
    await reset();
    {
      const d = await openDevice(browser, 'B1');
      await enterName(d, NAMED[0]); await until(d, () => !document.getElementById('profileModal') && document.querySelectorAll('#grid .tile.sel').length > 0);
      await clickTile(d, '🌸'); await clickTile(d, '🌸');             // 2 lần bấm nhanh => 2 popup xác nhận
      await confirmAll(d);                                              // bấm "Xác nhận" cả 2 gần như đồng thời
      await waitJoined(d, '🌸'); await settle(d, 900);
      const s = await snap(); const u = await ui(d);
      const t = s.teams['🌸'] || {};
      record('S1[browser]', 'double-click vào phòng (2 popup xác nhận, bấm cả 2)', 'đúng 1 lần gọi apiClaim; count=1, names=1, members=1', `claims=${u.claims} count=${t.count} names=${(t.names || []).length} members=${Object.keys(s.members).length} myIcon=${u.myIcon}`,
        u.claims === 1 && t.count === 1 && (t.names || []).length === 1 && Object.keys(s.members).length === 1 && u.myIcon === '🌸');
      await d.ctx.close();
    }
  },
};
