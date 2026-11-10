'use strict';
// Script backend (backend/scripts/*.js) chạy THẬT bằng process con trên Firestore Emulator (project demo-*).
// Mỗi file tests/scripts/cases/*.js export { run(t) }. Dùng: node tests/scripts/run.js [chuỗi lọc tên file…]
const fs = require('fs'), path = require('path');
const C = require('../lib/config');
const emu = require('../lib/emulator');
const { listCases } = require('../lib/discover');
const { createReport, exitLater } = require('../lib/report');

(async () => {
  const report = createReport('scripts');
  let code = 0;
  process.once('SIGINT', () => { emu.stop().finally(() => process.exit(130)); });
  try {
    const cases = listCases(path.join(__dirname, 'cases'));
    const tmp = path.join(C.OUT, 'scripts-tmp');
    fs.mkdirSync(tmp, { recursive: true });
    await emu.start('scripts');
    const L = require('../lib/firestore');
    const emuHost = `${C.EMU_HOST}:${C.ports.firestore}`;
    const t = {
      L, REPO: C.REPO, ROOT: C.ROOT, tmp, ok: report.ok, record: report.record,
      script: name => path.join(C.REPO, 'backend', 'scripts', name),
      // env process con: LUÔN trỏ emulator (script có nhánh service account thật khi thiếu biến này), bỏ credential thật.
      childEnv(extra = {}) {
        const env = Object.assign({}, process.env, extra, { FIRESTORE_EMULATOR_HOST: emuHost });
        delete env.GOOGLE_APPLICATION_CREDENTIALS;
        env.NODE_PATH = [path.join(C.ROOT, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
        return env;
      },
    };
    for (const c of cases) {
      console.log(`\n=== ${c.file} ===`);
      try { await require(c.path).run(t); } catch (e) { report.crash(c.file, e); }
    }
  } catch (e) { console.error('SUITE ERROR', e); code = 2; }
  finally { await emu.stop(); }
  const failed = report.summary();
  exitLater(code || (failed ? 1 : 0));
})();
