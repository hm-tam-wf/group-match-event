'use strict';
// Mục 6 — quản trị viên bằng dữ liệu (admins/{uid}): gốc thêm/gỡ, admin theo dữ liệu dùng được, user thường bị chặn, gỡ là mất quyền.
const H = require('../lib');
const { J, sleep, adb, FV, TS, evRef, seedEvent, getCfg, listCol, fresh, rec, openAdmin, until, clickTab, confirmYes, confirmNo, modalText,
  setVal, waitText, shot, waitDrawerClosed, baseCfg, same, openEdit, newEvent, typeCopy, xlsxFile, dk, fk, RH, upload, uploadTpl, recBatches, USERS } = H;

module.exports = {
  async run() {
    await fresh();
    await seedEvent('adm-ev', baseCfg('Sự kiện thử quyền', { closeAt: TS.fromMillis(Date.now() + 864e5) }), { active: true });
    await evRef('adm-ev').collection('signups').doc('u1').set({ name: 'Người A', employeeId: 'NV1', playerId: 'u1', at: TS.now() });
    const { USERS } = H;
    const R = await openAdmin('root', { label: 'root' });
    await clickTab(R.page, 'tabAdmins');
    await until(R.page, () => document.querySelectorAll('#admBody tr.is-root').length === 2, null, 10000);
    const r0 = await R.page.evaluate(() => ({ role: admRole.textContent, uid: admMyUid.textContent, roots: document.querySelectorAll('#admBody tr.is-root').length, del: document.querySelectorAll('#admBody .adm-del').length }));
    const tryAdd = async (page, uid, note) => {
      await setVal(page, '#admUid', uid); await setVal(page, '#admNote', note || '');
      await page.evaluate(() => { admMsg.textContent = ''; });
      await page.click('#admAdd'); await sleep(150);
      if (await page.$('.cm-bg .cm-confirm')) { await confirmYes(page); }
      await waitText(page, '#admMsg', /./, 10000);
      return page.$eval('#admMsg', e => e.textContent);
    };
    const selfMsg = await tryAdd(R.page, USERS.root.uid), rootMsg = await tryAdd(R.page, H.ROOT_UIDS.find(u => u !== USERS.root.uid) || H.ROOT_UIDS[0]), badMsg = await tryAdd(R.page, 'a/b');
    const addMsg = await tryAdd(R.page, USERS.data.uid, 'BTC Mini Outing');
    const doc = (await adb.collection('admins').doc(USERS.data.uid).get()).data();
    await until(R.page, () => document.querySelectorAll('#admBody .adm-del').length === 1, null, 10000);
    await shot(R.page, 'm6-quan-tri-1440');
    rec('6a', 'gốc: thấy UID + vai trò, 2 dòng UID gốc không có nút gỡ; chặn tự thêm / thêm UID gốc / UID sai; thêm UID khác ⇒ doc {note, addedBy=gốc, at}',
      r0.role === 'Quản trị gốc' && r0.uid === USERS.root.uid && r0.roots === 2 && r0.del === 0 && /chính mình/.test(selfMsg) && /quản trị gốc/.test(rootMsg) && /không hợp lệ/.test(badMsg)
      && /Đã thêm/.test(addMsg) && doc && doc.addedBy === USERS.root.uid && doc.note === 'BTC Mini Outing' && doc.at && typeof doc.at.toMillis === 'function',
      { r0, selfMsg, rootMsg, badMsg, addMsg, doc });

    // 6b — admin theo dữ liệu đăng nhập: làm được việc admin (đọc đăng ký), rules chặn tự thêm/ghi đè chính mình
    const D = await openAdmin('data', { label: 'data' });
    await clickTab(D.page, 'tabSignups');
    await D.page.select('#sigSelect', 'adm-ev').catch(() => {});
    await until(D.page, () => document.querySelectorAll('#tbody .row-act').length === 1, null, 15000);
    await clickTab(D.page, 'tabAdmins');
    await until(D.page, () => /dữ liệu/.test(admRole.textContent), null, 10000);
    const selfWrite = await D.page.evaluate(async uid => { try { await db.collection('admins').doc(uid).set({ addedBy: uid, at: firebase.firestore.FieldValue.serverTimestamp() }); return 'allowed'; } catch (e) { return e.code; } }, USERS.data.uid);
    const addPlain = await tryAdd(D.page, USERS.plain.uid, 'tạm');
    rec('6b', 'admin theo dữ liệu: xem được đăng ký, vai trò "thêm bằng dữ liệu"; ghi đè doc của chính mình bị rules chặn; thêm người khác được',
      selfWrite === 'permission-denied' && /Đã thêm/.test(addPlain), { selfWrite, addPlain });

    // 6c — user thường (bị gỡ) thấy thông báo thiếu quyền; ghi admins bị chặn
    await until(D.page, () => document.querySelectorAll('#admBody .adm-del').length === 2, null, 10000);
    await D.page.click(`#admBody .adm-del[data-uid="${USERS.plain.uid}"]`); await confirmYes(D.page);
    await waitText(D.page, '#toast', /Đã gỡ quyền/);
    const P = await openAdmin('plain', { label: 'plain' });
    await clickTab(P.page, 'tabAdmins');
    await waitText(P.page, '#admErr', /chưa có quyền quản trị/);
    const pRole = await P.page.$eval('#admRole', e => e.textContent);
    const pWrite = await P.page.evaluate(async uid => { try { await db.collection('admins').doc(uid).set({ addedBy: uid, at: firebase.firestore.FieldValue.serverTimestamp() }); return 'allowed'; } catch (e) { return e.code; } }, USERS.plain.uid);
    await shot(P.page, 'm6-chua-co-quyen-390', { width: 390, height: 844 });
    rec('6c', 'user thường: báo "chưa có quyền quản trị", vai trò tương ứng; tự thêm mình bằng Firestore trực tiếp bị chặn', /Chưa có quyền/.test(pRole) && pWrite === 'permission-denied', { pRole, pWrite });

    // 6d — gốc gỡ admin theo dữ liệu ⇒ người đó mất quyền ở lần đọc kế tiếp
    await until(R.page, u => !!document.querySelector(`#admBody .adm-del[data-uid="${u}"]`) && !admBody.hasAttribute('aria-busy'), USERS.data.uid, 10000);
    await R.page.click(`#admBody .adm-del[data-uid="${USERS.data.uid}"]`); await confirmYes(R.page);
    await waitText(R.page, '#toast', /Đã gỡ quyền/);
    await D.page.click('#admReload');
    await waitText(D.page, '#admErr', /chưa có quyền quản trị/);
    await shot(R.page, 'm6-quan-tri-390', { width: 390, height: 844 });
    rec('6d', 'gốc gỡ admin theo dữ liệu ⇒ máy của người đó tải lại danh sách bị từ chối ngay', true, '');
    for (const c of [R, D, P]) await c.ctx.close();
  },
};
