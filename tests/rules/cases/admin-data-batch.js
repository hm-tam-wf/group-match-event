'use strict';
// Admin THEO DỮ LIỆU ghi lô lớn: mỗi doc trong lô gọi exists(admins/uid) — phải được cache, không vượt giới hạn lượt truy cập
// của rules (nạp 400 dòng danh sách cho phép, transaction chuyển phòng của tab Đăng ký).
const DATA = 'dataAdminUid0001';
const N = 400;   // = cỡ lô admin.html dùng (batch ≤400)

module.exports = {
  id: 'S3A-3', name: 'rules: admin theo dữ liệu ghi lô 400 doc + transaction chuyển phòng không vượt giới hạn truy cập',
  async run(r) {
    await r.reset();
    await r.adb.collection('admins').doc(DATA).set({ addedBy: r.adminUid(), at: new Date() });
    await r.ev().collection('teams').doc('🌸').set({ icon: '🌸', count: 1, names: ['X'] });
    await r.ev().collection('members').doc('u7').set({ icon: '🌸', at: new Date() });
    await r.ev().collection('dedup_keys').doc('K7').set({ at: new Date(), icon: '🌸' });
    const data = r.authed(DATA), key = i => 'NV' + String(i).padStart(4, '0');
    {
      const b = data.fdb.batch();
      for (let i = 0; i < N; i++) b.set(data.col('allowlist').doc(key(i)), { name: 'N' + i, at: data.FV.serverTimestamp() });
      await r.allowed(`C1 batch ${N} allowlist`, b.commit());
    }
    {
      const b = data.fdb.batch();
      for (let i = 0; i < N; i++) b.delete(data.col('allowlist').doc(key(i)));
      await r.allowed(`C2 batch xoá ${N} allowlist`, b.commit());
    }
    await r.allowed('C3 transaction chuyển phòng (teams + members + dedup_keys + signups)', data.fdb.runTransaction(async tx => {
      const tA = data.col('teams').doc('🌸'), tB = data.col('teams').doc('🐬'), m = data.col('members').doc('u7');
      const k = data.col('dedup_keys').doc('K7'), s = data.col('signups').doc('u7');
      await Promise.all([tx.get(tA), tx.get(tB), tx.get(m), tx.get(k), tx.get(s)]);
      tx.delete(tA); tx.set(tB, { icon: '🐬', count: 1, names: ['X'] }); tx.update(m, { icon: '🐬' }); tx.update(k, { icon: '🐬' });
      tx.set(s, { name: 'X', playerId: 'u7', icon: '🐬' }, { merge: true });
    }));
  },
};
