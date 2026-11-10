'use strict';
// Bước 3A: admin "Chuyển phòng" cần update members/{pid} + dedup_keys/{key} (client vẫn KHÔNG sửa được);
// client join được đội đang rỗng {count:0, names:[]} (trước đây names[0:0] làm rules lỗi index ⇒ không ai vào lại được phòng đó).
module.exports = {
  id: 'S3A-2', name: 'rules: admin đổi icon members/dedup_keys (chuyển phòng), client không sửa được; client join được đội rỗng',
  async run(r) {
    await r.reset();
    await r.ev().collection('members').doc('u9').set({ icon: '🌸', at: new Date() });
    await r.ev().collection('dedup_keys').doc('K9').set({ at: new Date(), icon: '🌸' });
    await r.ev().collection('teams').doc('🌊').set({ icon: '🌊', count: 0, names: [] });   // đội admin vừa gỡ hết người (dữ liệu cũ)
    const anon = r.anon(), root = r.admin();
    await r.denied('B1 client sửa members', anon.col('members').doc('u9').set({ icon: '🐬' }, { merge: true }));
    await r.denied('B2 client sửa dedup_keys', anon.col('dedup_keys').doc('K9').set({ icon: '🐬' }, { merge: true }));
    await r.allowed('B3 admin đổi icon members', root.col('members').doc('u9').update({ icon: '🐬' }));
    await r.allowed('B4 admin đổi icon dedup_keys', root.col('dedup_keys').doc('K9').update({ icon: '🐬' }));
    const c = r.anon(), b = c.fdb.batch();
    b.set(c.col('teams').doc('🌊'), { icon: '🌊', count: 1, names: [r.FAKE(1)] }, { merge: true });
    b.set(c.col('dedup_keys').doc('KJOIN'), { at: c.FV.serverTimestamp(), icon: '🌊' });
    await r.allowed('B5 client join đội đang rỗng {count:0,names:[]}', b.commit());
  },
};
