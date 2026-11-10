'use strict';
// Layer A — commit mơ hồ: client retry cùng pid / máy quên pid cùng tên.
const J = x => JSON.stringify(x);

module.exports = {
  async run({ L, record }) {
    const { reset, snap, makeDevice, claim, NAMED } = L;

    // S5 — commit mơ hồ: client retry
    await reset();
    {
      const a = makeDevice('A5a'), a2 = makeDevice('A5b');
      const r1 = await claim(a, '🌸', NAMED[1]);
      const r2 = await claim(a, '🌸', NAMED[1]);                          // retry cùng pid
      const r3 = await claim(a, '🐬', NAMED[1]);                          // retry cùng pid, chọn nhầm phòng khác
      const r4 = await claim(a2, '🐬', NAMED[1]);                         // máy quên pid (localStorage mất) cùng tên
      const s = await snap();
      const pass = r1.ok && r2.reason === 'already' && r2.icon === '🌸' && r3.reason === 'already' && r3.icon === '🌸'
        && r4.reason === 'dup' && r4.icon === '🌸' && L.totalCount(s) === 1;
      record('S5', 'claim ok rồi retry (cùng pid / pid mới cùng tên)',
        'retry cùng pid => already+icon=🌸; pid mới => dup+icon=🌸; tổng count=1', J([r1, r2, r3, r4]) + ' total=' + L.totalCount(s), pass);
    }
  },
};
