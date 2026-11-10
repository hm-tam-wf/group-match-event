'use strict';
// S6b — rules teams: client chỉ được +1 người và nối ĐÚNG 1 tên hợp lệ vào cuối names; admin (isAdmin) bỏ qua mọi ràng buộc.
module.exports = {
  id: 'S6b',
  name: 'rules teams: client chỉ +1 người & nối 1 tên hợp lệ; admin bỏ qua',
  expect: 'T1-T8,T10-T12 bị từ chối; T9,T13-T15 được phép',
  async run(r) {
    const { ev, FAKE } = r;
    await r.reset();
    const T = r.anon().col('teams'); const acol = r.admin().col;
    await ev().collection('teams').doc('🌸').set({ icon: '🌸', count: 2, names: [FAKE(1), FAKE(2)] });
    const up = d => T.doc('🌸').set(d, { merge: true });
    await r.denied('T1 reset đội về 0', up({ icon: '🌸', count: 0, names: [] }));
    await r.denied('T2 sửa tên, giữ count', up({ icon: '🌸', count: 2, names: [FAKE(1), 'Hacker'] }));
    await r.denied('T3 +1 nhưng đổi tên cũ', up({ icon: '🌸', count: 3, names: [FAKE(1), 'Hacker', 'New'] }));
    await r.denied('T4 +1 tên không phải chuỗi', up({ icon: '🌸', count: 3, names: [FAKE(1), FAKE(2), 5] }));
    await r.denied('T5 +1 tên rỗng', up({ icon: '🌸', count: 3, names: [FAKE(1), FAKE(2), ''] }));
    await r.denied('T5b +1 tên 121 ký tự', up({ icon: '🌸', count: 3, names: [FAKE(1), FAKE(2), 'x'.repeat(121)] }));
    await r.denied('T6 +2 một lần', up({ icon: '🌸', count: 4, names: [FAKE(1), FAKE(2), 'A', 'B'] }));
    await r.denied('T7 thêm field lạ', up({ icon: '🌸', count: 3, names: [FAKE(1), FAKE(2), 'New'], x: 1 }));
    await r.denied('T8 đổi icon', up({ icon: '🐬', count: 3, names: [FAKE(1), FAKE(2), 'New'] }));
    await r.allowed('T9 +1 hợp lệ', up({ icon: '🌸', count: 3, names: [FAKE(1), FAKE(2), 'New Person'] }));
    await r.denied('T10 tạo doc id khác icon', T.doc('🌸x').set({ icon: '🌸', count: 1, names: ['Z'] }));
    await r.denied('T11 tạo kèm field lạ', T.doc('T11X').set({ icon: 'T11X', count: 1, names: ['Z'], x: 1 }));
    await r.denied('T12 tạo names là chuỗi', T.doc('T12X').set({ icon: 'T12X', count: 1, names: 'Z' }));
    await r.allowed('T13 tạo hợp lệ', T.doc('T13X').set({ icon: 'T13X', count: 1, names: ['Z'] }));
    await r.allowed('T14 admin reset đội', acol('teams').doc('🌸').set({ icon: '🌸', count: 0, names: [] }));
    await r.allowed('T15 admin seed vượt sĩ số', acol('teams').doc('🐬').set({ icon: '🐬', count: 50, names: Array.from({ length: 50 }, (_, i) => 'S' + i) }));
  },
};
