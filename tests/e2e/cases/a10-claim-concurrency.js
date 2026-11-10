'use strict';
// Layer A — claim đồng thời (rules + transaction thật, api.js nguyên văn): cùng thiết bị và 2 thiết bị cùng tên.
const J = x => JSON.stringify(x);

module.exports = {
  async run({ L, record }) {
    const { reset, snap, makeDevice, claim, FAKE, NAMED, dedupKey } = L;

    // S1 — cùng thiết bị, 2 claim đồng thời (mô phỏng double-click lọt qua UI): đúng 1 join, count +1.
    await reset();
    {
      const d = makeDevice('A1'); const name = NAMED[0];
      const [r1, r2] = await Promise.all([claim(d, '🌸', name), claim(d, '🌸', name)]);
      const s = await snap(); const oks = [r1, r2].filter(r => r.ok).length;
      const other = [r1, r2].find(r => !r.ok);
      const t = s.teams['🌸'] || {};
      const pass = oks === 1 && other && ['already', 'dup'].includes(other.reason) && t.count === 1 && (t.names || []).length === 1 && Object.keys(s.members).length === 1;
      record('S1', 'cùng thiết bị, 2 claim đồng thời', '1 ok + 1 already/dup; count=1, names=1, members=1', `oks=${oks} other=${J(other)} count=${t.count} members=${Object.keys(s.members).length}`, pass);
    }

    // S2 — 2 thiết bị cùng tên, 2 phòng khác nhau, đồng thời, x10
    {
      await reset();
      const bad = [];
      for (let i = 1; i <= 10; i++) {
        await reset(); const name = FAKE(i); const a = makeDevice('A2a'), b = makeDevice('A2b');
        const before = await snap();
        const [ra, rb] = await Promise.all([claim(a, '🌸', name), claim(b, '🐬', name)]);
        const s = await snap(); const lose = ra.ok ? rb : ra; const winIcon = ra.ok ? '🌸' : '🐬';
        const memPids = [a.pid, b.pid].filter(p => s.members[p]);
        const dk = s.dedup[dedupKey(name)];
        const ok = (ra.ok !== rb.ok) && lose.reason === 'dup' && L.totalCount(s) - L.totalCount(before) === 1 && L.totalNames(s) - L.totalNames(before) === 1
          && memPids.length === 1 && !!dk && dk.icon === winIcon && lose.icon === winIcon;
        if (!ok) bad.push({ i, ra, rb, dk, memPids: memPids.length });
      }
      record('S2', '2 thiết bị cùng tên, khác phòng, Promise.all x10',
        '10/10: đúng 1 ok, thua=dup kèm icon=phòng thắng, count+1, 1 member, dedup đúng',
        bad.length === 0 ? '10/10 đạt' : `${bad.length} vòng lỗi: ${J(bad).slice(0, 400)}`, bad.length === 0);
    }
  },
};
