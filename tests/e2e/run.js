'use strict';
// E2E trên Firestore Emulator: chạy tests/e2e/cases/*.js theo thứ tự tên file.
//   a*-*.js  "thiết bị" Node nạp NGUYÊN VĂN fe/js (transaction + rules thật, không trình duyệt)
//   b*-*.js  trình duyệt thật (module khai `browser: true`) — trình duyệt + static server bật khi gặp file đầu tiên cần.
// Dùng: node tests/e2e/run.js [chuỗi lọc tên file…] [--node | --browser]
const path = require('path');
const emu = require('../lib/emulator');
const { listCases, hasFlag } = require('../lib/discover');
const { createReport, exitLater } = require('../lib/report');

(async () => {
  const report = createReport('e2e');
  let code = 0, B = null, browser = null;
  process.once('SIGINT', () => { emu.stop().finally(() => process.exit(130)); });
  try {
    let cases = listCases(path.join(__dirname, 'cases')).map(c => Object.assign(c, { mod: require(c.path) }));
    if (hasFlag('--node')) cases = cases.filter(c => !c.mod.browser);
    if (hasFlag('--browser')) cases = cases.filter(c => c.mod.browser);
    await emu.start('e2e');
    const L = require('../lib/firestore');
    for (const c of cases) {
      console.log(`\n=== ${c.file} ===`);
      if (c.mod.browser && !B) { B = require('./browser-helpers'); browser = await B.start(); }
      try {
        await c.mod.run({ L, B: c.mod.browser ? B : null, browser: c.mod.browser ? browser : null, record: report.record, ok: report.ok });
      } catch (e) { report.crash(c.file, e); }
      finally { if (B) await B.closeContexts(); }
    }
  } catch (e) { console.error('SUITE ERROR', e); code = 2; }
  finally {
    if (B) {
      await B.stop();
      if (B.srv.fatal) report.crash('static-server', B.srv.fatal);
    }
    await emu.stop();
  }
  const failed = report.summary();
  exitLater(code || (failed ? 1 : 0));
})();
