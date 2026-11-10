'use strict';
// S6c — rules signups: người chơi chỉ tạo / sửa / xoá hồ sơ của mình (playerId = id doc); doc xếp sẵn seed_* chỉ admin ghi.
module.exports = {
  id: 'S6c',
  name: 'rules signups: hồ sơ của mình vs doc xếp sẵn seed_* (chỉ admin)',
  expect: 'U2,U3,U7-U9 bị từ chối; U1,U4-U6,U10 được phép',
  async run(r) {
    await r.reset();
    const c = r.anon();
    const S = c.col('signups'), AS = r.admin().col('signups');
    await r.allowed('U1 tạo hồ sơ của mình', S.doc('u1abc').set({ name: 'A', playerId: 'u1abc', at: c.FV.serverTimestamp() }, { merge: true }));
    await r.denied('U2 playerId khác pid', S.doc('u2abc').set({ name: 'A', playerId: 'other' }));
    await r.denied('U3 icon không phải chuỗi', S.doc('u3abc').set({ name: 'A', playerId: 'u3abc', icon: 5 }));
    await r.allowed('U4 gắn đội cho hồ sơ của mình', S.doc('u1abc').set({ playerId: 'u1abc', icon: '🌸' }, { merge: true }));
    await r.allowed('U5 xoá hồ sơ của mình', S.doc('u1abc').delete());
    await r.allowed('U6 admin tạo seed_*', AS.doc('seed_K6').set({ name: 'Seeded', playerId: 'seed_K6', icon: '🌸' }));
    await r.denied('U7 client sửa seed_*', S.doc('seed_K6').set({ playerId: 'seed_K6', name: 'Hacked' }, { merge: true }));
    await r.denied('U8 client xoá seed_*', S.doc('seed_K6').delete());
    await r.denied('U9 client tạo seed_*', S.doc('seed_K9').set({ name: 'X', playerId: 'seed_K9' }));
    await r.allowed('U10 admin sửa seed_*', AS.doc('seed_K6').set({ name: 'Fixed' }, { merge: true }));
  },
};
