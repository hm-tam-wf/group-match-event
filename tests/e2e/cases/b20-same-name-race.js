'use strict';
// Layer B — 2 thiết bị cùng tên, khác phòng, bấm xác nhận đồng thời (x3): người thua vào chế độ xem đúng phòng thắng.
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, snap, FAKE, sleep } = L;
    const { openDevice, until, clickTile, ui, seedFor } = B;

    const bad = [];
    for (let i = 1; i <= 3; i++) {
      await reset(); const name = FAKE(i);
      const a = await openDevice(browser, 'B2a', { seed: seedFor('uBtwoA' + i, name) });
      const b = await openDevice(browser, 'B2b', { seed: seedFor('uBtwoB' + i, name) });
      await until(a, () => document.querySelectorAll('#grid .tile.sel').length > 0); await until(b, () => document.querySelectorAll('#grid .tile.sel').length > 0);
      await Promise.all([clickTile(a, '🌸'), clickTile(b, '🐬')]);
      await Promise.all([a.page.evaluate(() => document.querySelector('#c1').click()), b.page.evaluate(() => document.querySelector('#c1').click())]);
      for (const x of [a, b]) { await until(x, () => window.__claims.length >= 1, null, 30000); await until(x, () => !busy && !document.body.classList.contains('claiming'), null, 30000); }
      await sleep(900);
      const ua = await ui(a), ub = await ui(b), s = await snap();
      const winner = (ua.myIcon && !ua.remoteView) ? ua : (ub.myIcon && !ub.remoteView) ? ub : null; const loser = winner === ua ? ub : ua;
      const wIcon = winner === ua ? '🌸' : '🐬';
      const memPids = Object.keys(s.members);
      const ok = !!winner && memPids.length === 1 && L.totalCount(s) === 1 && L.totalNames(s) === 1 && Object.keys(s.signups).length <= 1
        && loser.remoteView && loser.myIcon === wIcon && /đăng ký|registered/i.test(loser.banner) && loser.sel === 0 && loser.mates.length === 1;
      if (!ok) bad.push({ i, win: winner && { ic: winner.myIcon }, lose: { my: loser.myIcon, rv: loser.remoteView, dup: loser.dupModal, banner: loser.banner.slice(0, 40) }, members: memPids.length, count: L.totalCount(s), signups: Object.keys(s.signups).length });
      await a.ctx.close(); await b.ctx.close();
    }
    record('S2[browser]', '2 thiết bị cùng tên, khác phòng, bấm đồng thời x3',
      '1 thắng (đã join), 1 thua => chế độ xem đúng phòng thắng, tile khoá; count=1, 1 member, <=1 signup',
      bad.length === 0 ? '3/3 đạt' : J(bad).slice(0, 600), bad.length === 0);
  },
};
