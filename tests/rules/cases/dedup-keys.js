'use strict';
// S6 — rules dedup_keys (client trần, không qua app code): chỉ tạo {at, icon} kèm đúng lượt join +1 của team cùng icon;
// không update / ghi đè / xoá / list; {at} trần (thiếu icon) bị từ chối.
module.exports = {
  id: 'S6',
  name: 'rules dedup_keys',
  expect: 'R1,R2,R4,R5,R5b,R6,R8-R12,R15,R17 bị từ chối (permission-denied); R3,R13,R14,R16 được phép',
  async run(r) {
    const { ev, FAKE } = r;
    await r.reset();
    const c = r.anon(), col = c.col; const at = () => c.FV.serverTimestamp();
    await ev().collection('teams').doc('🌸').set({ icon: '🌸', count: 1, names: [FAKE(1)] });
    await ev().collection('teams').doc('🐬').set({ icon: '🐬', count: 1, names: [FAKE(2)] });
    await r.denied('R1 {at,icon} đơn lẻ, không +1 team', col('dedup_keys').doc('K1').set({ at: at(), icon: '🌸' }));
    await r.denied('R2 {at} đơn lẻ bị từ chối (phase B)', col('dedup_keys').doc('K2').set({ at: at() }));
    await ev().collection('dedup_keys').doc('K2').set({ at: new Date() });   // doc {at} cũ (admin SDK) để thử R5/R5b/R6
    { const b = c.fdb.batch(); b.set(col('teams').doc('🌸'), { icon: '🌸', count: 2, names: [FAKE(1), 'X'] }, { merge: true }); b.set(col('dedup_keys').doc('K3'), { at: at(), icon: '🌸' }); await r.allowed('R3 {at,icon} + team 🌸 +1 (join thật) được phép', b.commit()); }
    { const b = c.fdb.batch(); b.set(col('teams').doc('🐬'), { icon: '🐬', count: 2, names: [FAKE(2), 'Y'] }, { merge: true }); b.set(col('dedup_keys').doc('K4'), { at: at(), icon: '🌸' }); await r.denied('R4 icon dedup=🌸 nhưng team +1 là 🐬', b.commit()); }
    await r.denied('R5 update dedup_keys', col('dedup_keys').doc('K2').update({ icon: '🌸' }));
    await r.denied('R5b set ghi đè dedup_keys', col('dedup_keys').doc('K2').set({ at: at() }));
    await r.denied('R6 delete dedup_keys', col('dedup_keys').doc('K2').delete());
    await r.denied('R8 {at,icon} team chưa tồn tại, không ghi team', col('dedup_keys').doc('K8').set({ at: at(), icon: '🦈' }));
    await r.denied('R9 {icon} thiếu at', col('dedup_keys').doc('K9').set({ icon: '🌸' }));
    await r.denied('R10 {at,icon:số}', col('dedup_keys').doc('K10').set({ at: at(), icon: 5 }));
    await r.denied('R11 {at,icon,extra}', col('dedup_keys').doc('K11').set({ at: at(), icon: '🌸', pid: 'x' }));
    await r.denied('R12 list dedup_keys (không phải admin)', col('dedup_keys').get());
    { const b = c.fdb.batch(); b.set(col('dedup_keys').doc('K13'), { at: at(), icon: '🦈' }); b.set(col('teams').doc('🦈'), { icon: '🦈', count: 1, names: ['Z'] }); await r.allowed('R13 team mới tạo (count 1) + dedup icon được phép', b.commit()); }
    { const b = c.fdb.batch(); b.set(col('teams').doc('🌸'), { icon: '🌸', count: 3, names: [FAKE(1), 'X', 'W'] }, { merge: true }); b.set(col('dedup_keys').doc('K14a'), { at: at(), icon: '🌸' }); b.set(col('dedup_keys').doc('K14b'), { at: at(), icon: '🌸' }); await r.allowed('R14 2 doc dedup {at,icon} + team +1 (khoá gốc + fold) được phép', b.commit()); }
    { const b = c.fdb.batch(); b.set(col('teams').doc('🐬'), { icon: '🐬', count: 2, names: [FAKE(2), 'V'] }, { merge: true }); b.set(col('dedup_keys').doc('K15a'), { at: at(), icon: '🐬' }); b.set(col('dedup_keys').doc('K15b'), { at: at(), icon: '🌸' }); await r.denied('R15 doc fold sai icon (🌸) trong lượt join 🐬', b.commit()); }
    { const b = c.fdb.batch(); b.set(col('teams').doc('🦈'), { icon: '🦈', count: 2, names: ['Z', 'Y'] }, { merge: true }); b.set(col('dedup_keys').doc('K16'), { at: at(), icon: '🦈' }); b.set(col('dedup_keys').doc('m~M16'), { at: at(), icon: '🦈' }); await r.allowed('R16 doc k1 + doc M "m~..." trong cùng lượt join được phép', b.commit()); }
    await r.denied('R17 ghi lại M đã có (set lên doc tồn tại = update) bị từ chối', col('dedup_keys').doc('m~M16').set({ at: at() }));
  },
};
