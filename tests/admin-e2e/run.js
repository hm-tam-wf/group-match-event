'use strict';
// Admin E2E: fe/admin.html THẬT trên Firestore + Auth Emulator (rules thật, đăng nhập thật) trong trình duyệt headless.
// Mỗi file tests/admin-e2e/cases/*.js export { run() } và tự reset dữ liệu (fresh()). Cuối suite: kiểm không có exception JS.
// Dùng: node tests/admin-e2e/run.js [chuỗi lọc tên file…]   ·   TEST_SHOTS=1 ⇒ lưu ảnh minh hoạ vào tests/.out/admin-e2e-shots/
const path = require('path');
const C = require('../lib/config');
process.env.FIREBASE_AUTH_EMULATOR_HOST = `${C.EMU_HOST}:${C.ports.auth}`;   // firebase-admin (tạo tài khoản) → Auth Emulator, KHÔNG BAO GIỜ production
const emu = require('../lib/emulator');
const { listCases } = require('../lib/discover');
const { createReport, exitLater } = require('../lib/report');

(async () => {
  const report = createReport('admin-e2e');
  let code = 0, H = null;
  process.once('SIGINT', () => { emu.stop().finally(() => process.exit(130)); });
  try {
    const cases = listCases(path.join(__dirname, 'cases'));
    await emu.start('admin-e2e', { auth: true });
    H = require('./lib');
    await H.start(report);
    for (const c of cases) {
      console.log(`\n=== ${c.file} ===`);
      try { await require(c.path).run(); }
      catch (e) { report.crash(c.file, e); }
      finally { await H.closeContexts(); }
    }
    report.ok('NOERR không có exception JS (pageerror) / hộp thoại gốc trong toàn bộ suite', H.pageErrs.length === 0, H.pageErrs);
  } catch (e) { console.error('SUITE ERROR', e); code = 2; }
  finally {
    if (H) {
      await H.stop();
      if (H.srv.fatal) report.crash('static-server', H.srv.fatal);
    }
    await emu.stop();
  }
  const failed = report.summary();
  exitLater(code || (failed ? 1 : 0));
})();
