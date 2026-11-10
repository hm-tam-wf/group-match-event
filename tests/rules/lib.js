'use strict';
// Context cho case rules: client "trần" (chưa đăng nhập), client đăng nhập giả (mockUserToken, emulator không kiểm chữ ký),
// client admin, admin SDK để seed (bỏ qua rules) + ghi nhận từng kiểm tra denied/allowed.
const fs = require('fs');
const C = require('../lib/config');

// UID admin GỐC: danh sách UID CỨNG trong isRootAdmin() (isAdmin() = gốc HOẶC có doc admins/{uid}, bước 3A) ⇒ lấy UID đầu tiên.
// Case cần admin THEO DỮ LIỆU: seed doc admins/<uid> bằng r.adb rồi dùng r.authed(<uid>) (xem cases/admins.js, admin-data-batch.js).
function adminUid() {
  const txt = fs.readFileSync(C.RULES, 'utf8');
  const m = /request\.auth\.uid in \[\s*"([^"]+)"/.exec(txt);
  if (!m) throw new Error(`không đọc được UID admin gốc (isRootAdmin) trong ${C.RULES} — rules đổi mô hình admin? sửa adminUid() trong tests/rules/lib.js`);
  return m[1];
}

function createContext(L) {
  L.fbNs.firestore.setLogLevel('error');   // từ chối là KỲ VỌNG ở suite này ⇒ tắt cảnh báo PERMISSION_DENIED của SDK (kết quả từng thao tác vẫn in)
  const checks = [];
  const apps = [];
  let seq = 0, adminCli = null;
  const client = opts => { const c = L.rawClient('rules' + (++seq), opts); apps.push(c.app); return c; };
  const settle = p => (typeof p === 'function' ? p() : p);
  return {
    L, EVENT: L.EVENT, ev: L.ev, adb: L.adb, FAKE: L.FAKE, reset: L.reset,
    anon: () => client(),                                      // { fdb, col(name), FV } — chưa đăng nhập
    authed: uid => client({ uid }),                            // đăng nhập giả bằng uid bất kỳ (vd người dùng thường)
    admin: () => adminCli || (adminCli = client({ uid: adminUid() })),
    adminUid,
    // p: promise (hoặc hàm trả promise) của 1 thao tác ghi/đọc qua rules.
    async denied(name, p) {
      let r; try { await settle(p); r = false; } catch (e) { r = e.code === 'permission-denied' ? true : 'other:' + e.code; }
      checks.push({ name, want: 'denied', result: r });
    },
    async allowed(name, p) {
      let r; try { await settle(p); r = true; } catch (e) { r = 'denied:' + e.code; }
      checks.push({ name, want: 'allowed', result: r });
    },
    take: () => checks.splice(0),
    dispose: () => Promise.all(apps.map(a => a.delete().catch(() => {}))),
  };
}

module.exports = { createContext, adminUid };
