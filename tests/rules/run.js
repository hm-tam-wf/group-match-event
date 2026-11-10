'use strict';
// Rules nhanh trên Firestore Emulator: mỗi file tests/rules/cases/*.js = 1 nhóm kiểm tra (1 dòng kết quả),
// in chi tiết từng thao tác denied/allowed. Dùng: node tests/rules/run.js [chuỗi lọc tên file…]
const path = require('path');
const emu = require('../lib/emulator');
const { listCases } = require('../lib/discover');
const { createReport, exitLater } = require('../lib/report');
const J = x => JSON.stringify(x);

const short = list => list.map(x => x.name.split(' ')[0]).join(',');

(async () => {
  const report = createReport('rules');
  let code = 0, ctx = null;
  process.once('SIGINT', () => { emu.stop().finally(() => process.exit(130)); });
  try {
    const cases = listCases(path.join(__dirname, 'cases'));
    await emu.start('rules');
    const L = require('../lib/firestore');
    ctx = require('./lib').createContext(L);
    for (const c of cases) {
      const mod = require(c.path);
      console.log(`\n=== ${c.file} ===`);
      try {
        await mod.run(ctx);
        const checks = ctx.take();
        checks.forEach(x => console.log('  ' + (x.result === true ? 'đúng ' : 'SAI  ') + `[${x.want}] ` + x.name + (x.result === true ? '' : '  => ' + x.result)));
        const bad = checks.filter(x => x.result !== true);
        const expect = mod.expect || `bị từ chối: ${short(checks.filter(x => x.want === 'denied'))}; được phép: ${short(checks.filter(x => x.want === 'allowed'))}`;
        report.record(mod.id || c.file, mod.name || c.file, expect,
          bad.length ? 'SAI: ' + J(bad.map(x => [x.name, x.result])) : `${checks.length}/${checks.length} đúng: ${short(checks)}`,
          checks.length > 0 && bad.length === 0);
      } catch (e) { ctx.take(); report.crash(c.file, e); }
    }
  } catch (e) { console.error('SUITE ERROR', e); code = 2; }
  finally {
    if (ctx) await ctx.dispose();
    await emu.stop();
  }
  const failed = report.summary();
  exitLater(code || (failed ? 1 : 0));
})();
