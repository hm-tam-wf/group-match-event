'use strict';
// Layer A — đua nhiều thiết bị với các biến thể tên (allowlist tắt), mỗi kịch bản x10.
const J = x => JSON.stringify(x);

module.exports = {
  async run({ L, record }) {
    const { reset, snap, makeDevice, claim, dedupKey, mKey, ICONS } = L;

    // S11 — đua: "Lê Văn A" / "LE VAN A" / "le van a" trên 3 thiết bị, 3 phòng, đồng thời x10 (allowlist tắt) ⇒ đúng 1 thắng
    {
      const bad = []; const names = ['Lê Văn A', 'LE VAN A', 'le van a'];
      for (let i = 1; i <= 10; i++) {
        await reset();
        const devs = names.map((n, k) => makeDevice('A11' + k, { cfg: { allowlistMode: false } }));
        const before = await snap();
        const rs = await Promise.all(names.map((n, k) => claim(devs[k], ICONS[k], n)));
        const s = await snap(); const oks = rs.filter(r => r.ok); const losers = rs.filter(r => !r.ok);
        const winIdx = rs.findIndex(r => r.ok); const winIcon = ICONS[winIdx];
        const expectDocs = winIdx === 0 ? [dedupKey(names[0]), mKey(names[0])].sort() : [dedupKey(names[1])];
        const ok = oks.length === 1 && losers.every(r => r.reason === 'dup' && r.icon === winIcon)
          && L.totalCount(s) - L.totalCount(before) === 1 && L.totalNames(s) - L.totalNames(before) === 1 && Object.keys(s.members).length === 1
          && J(Object.keys(s.dedup).sort()) === J(expectDocs) && Object.values(s.dedup).every(d => d.icon === winIcon);
        if (!ok) bad.push({ i, rs: J(rs), dedup: J(s.dedup).slice(0, 200), members: Object.keys(s.members).length, count: L.totalCount(s) });
      }
      record('S11', 'đua 3 biến thể tên (có dấu / HOA / thường) trên 3 thiết bị, Promise.all x10',
        '10/10: đúng 1 ok, 2 dup kèm icon phòng thắng, count+1, 1 member, docs khớp người thắng (có dấu: k1+M; không dấu: k1)',
        bad.length === 0 ? '10/10 đạt' : `${bad.length} vòng lỗi: ${J(bad).slice(0, 500)}`, bad.length === 0);
    }

    // S11b — đua chéo: "Lê Văn A" ∥ "Le Van A" (2 thiết bị) x10 ⇒ đúng 1 thắng (hai tx đọc chéo F/M)
    {
      const bad = []; const nm = 'Lê Văn A', plain = 'Le Van A'; const off = { allowlistMode: false };
      for (let i = 1; i <= 10; i++) {
        await reset();
        const x = makeDevice('A11bx', { cfg: off }), y = makeDevice('A11by', { cfg: off });
        const before = await snap();
        const [rx, ry] = i % 2 ? await Promise.all([claim(x, '🌸', nm), claim(y, '🐬', plain)]) : (await Promise.all([claim(y, '🐬', plain), claim(x, '🌸', nm)])).reverse();
        const s = await snap(); const oks = [rx, ry].filter(r => r.ok); const lose = rx.ok ? ry : rx;
        const ok = oks.length === 1 && lose.reason === 'dup' && L.totalCount(s) - L.totalCount(before) === 1 && Object.keys(s.members).length === 1;
        if (!ok) bad.push({ i, rx: J(rx), ry: J(ry), count: L.totalCount(s), members: Object.keys(s.members).length });
      }
      record('S11b', 'đua chéo "Lê Văn A" ∥ "Le Van A" (2 thiết bị) x10', '10/10: đúng 1 ok, người kia dup, count+1, 1 member',
        bad.length === 0 ? '10/10 đạt' : `${bad.length} vòng lỗi: ${J(bad).slice(0, 500)}`, bad.length === 0);
    }

    // S11c — đua: "Nguyễn Văn Hùng" ∥ "Nguyễn Văn Hưng" x10 ⇒ CẢ HAI thành công; M tạo đúng 1 lần; không tx nào lỗi vì rules
    {
      const bad = []; const h1 = 'Nguyễn Văn Hùng', h2 = 'Nguyễn Văn Hưng'; const off = { allowlistMode: false };
      for (let i = 1; i <= 10; i++) {
        await reset();
        const x = makeDevice('A11cx', { cfg: off }), y = makeDevice('A11cy', { cfg: off });
        const [rx, ry] = await Promise.all([claim(x, '🌸', h1), claim(y, '🐬', h2)]);
        const s = await snap(); const docs = Object.keys(s.dedup).sort();
        const ok = rx.ok && ry.ok && L.totalCount(s) === 2 && Object.keys(s.members).length === 2
          && J(docs) === J([dedupKey(h1), dedupKey(h2), mKey(h1)].sort()) && ['🌸', '🐬'].includes(s.dedup[mKey(h1)].icon);
        if (!ok) bad.push({ i, rx: J(rx), ry: J(ry), docs, count: L.totalCount(s) });
      }
      record('S11c', 'đua "Hùng" ∥ "Hưng" (2 thiết bị) x10', '10/10: cả hai ok (không error/permission-denied), 2 member, docs = 2 k1 + đúng 1 M',
        bad.length === 0 ? '10/10 đạt' : `${bad.length} vòng lỗi: ${J(bad).slice(0, 600)}`, bad.length === 0);
    }
  },
};
