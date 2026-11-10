'use strict';
// admins/{uid} — admin THEO DỮ LIỆU (bước 3A): isAdmin = UID gốc (isRootAdmin) HOẶC có doc admins/{uid}.
// Chỉ admin đọc / thêm / gỡ; không ai tự thêm chính mình; doc { note?, addedBy = người thêm, at = giờ máy chủ }; không sửa tại chỗ.
const DATA = 'dataAdminUid0001', PLAIN = 'plainUserUid0001', OTHER = 'otherUserUid0001';

module.exports = {
  id: 'S3A-1', name: 'rules admins/{uid}: chỉ admin đọc/ghi, không ai tự thêm mình, admin theo dữ liệu có quyền như admin, gỡ là mất quyền',
  async run(r) {
    await r.reset();
    await r.ev().collection('signups').doc('u1').set({ name: 'A', playerId: 'u1' });
    const ROOT = r.adminUid();
    const anon = r.anon(), root = r.admin(), data = r.authed(DATA), plain = r.authed(PLAIN);
    const adm = (c, id) => c.fdb.collection('admins').doc(id);
    const by = (c, uid, extra) => Object.assign({ addedBy: uid, at: c.FV.serverTimestamp() }, extra || {});

    await r.denied('A1 vô danh đọc admins', adm(anon, DATA).get());
    await r.denied('A2 vô danh tạo admins', adm(anon, DATA).set({ addedBy: 'x', at: anon.FV.serverTimestamp() }));
    await r.denied('A3 user thường tự thêm mình', adm(plain, PLAIN).set(by(plain, PLAIN)));
    await r.denied('A4 user thường thêm người khác', adm(plain, OTHER).set(by(plain, PLAIN)));
    await r.denied('A5 user thường đọc signups (chưa là admin)', plain.col('signups').get());
    await r.denied('A6 gốc tự thêm mình', adm(root, ROOT).set(by(root, ROOT)));
    await r.denied('A7 gốc thêm với addedBy sai', adm(root, DATA).set(by(root, OTHER)));
    await r.denied('A8 gốc thêm kèm field lạ', adm(root, DATA).set(by(root, ROOT, { role: 'super' })));
    await r.denied('A9 gốc thêm ghi chú 201 ký tự', adm(root, DATA).set(by(root, ROOT, { note: 'x'.repeat(201) })));
    await r.denied('A10 gốc thêm với at không phải giờ máy chủ', adm(root, DATA).set({ addedBy: ROOT, at: new Date(0) }));
    await r.allowed('A11 gốc thêm admin theo dữ liệu (hợp lệ)', adm(root, DATA).set(by(root, ROOT, { note: 'BTC' })));
    await r.denied('A12 gốc sửa tại chỗ (update)', adm(root, DATA).set({ note: 'đổi' }, { merge: true }));
    await r.allowed('A13 admin dữ liệu đọc signups', data.col('signups').get());
    await r.allowed('A14 admin dữ liệu mở sự kiện (config/active)', data.fdb.doc('config/active').set({ eventId: r.EVENT }));
    await r.allowed('A15 admin dữ liệu đọc admins', data.fdb.collection('admins').get());
    await r.denied('A16 admin dữ liệu ghi đè doc của chính mình', adm(data, DATA).set(by(data, DATA)));
    await r.allowed('A17 admin dữ liệu thêm người khác', adm(data, PLAIN).set(by(data, DATA)));
    await r.allowed('A18 người vừa được thêm đọc signups', plain.col('signups').get());
    await r.allowed('A19 admin dữ liệu gỡ người khác', adm(data, PLAIN).delete());
    await r.denied('A20 người bị gỡ mất quyền ngay', plain.col('signups').get());
    await r.denied('A21 user thường gỡ admin khác', adm(plain, DATA).delete());
    await r.allowed('A22 gốc gỡ admin theo dữ liệu', adm(root, DATA).delete());
    await r.denied('A23 admin dữ liệu sau khi bị gỡ đọc signups', data.col('signups').get());
    await r.allowed('A24 vô danh vẫn đọc config/active (công khai)', anon.fdb.doc('config/active').get());
  },
};
