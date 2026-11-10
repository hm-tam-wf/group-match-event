'use strict';
// Chạy TUẦN TỰ mọi suite (mỗi suite 1 process, suite cần emulator tự bật/tắt emulator riêng), chạy hết rồi mới tổng kết.
// Dùng: node tests/run-all.js [tên suite…]   vd: node tests/run-all.js unit rules
const path = require('path'), { spawnSync } = require('child_process');

const SUITES = ['unit', 'rules', 'scripts', 'admin', 'e2e'];   // nhẹ → nặng
const pick = process.argv.slice(2);
const bad = pick.filter(s => !SUITES.includes(s));
if (bad.length) { console.error(`Suite không có: ${bad.join(', ')}. Có: ${SUITES.join(', ')}`); process.exit(2); }

const results = [];
for (const s of (pick.length ? SUITES.filter(x => pick.includes(x)) : SUITES)) {
  console.log(`\n################ ${s} ################`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, s, 'run.js')], { stdio: 'inherit' });
  results.push({ s, code: r.status === null ? 'signal ' + r.signal : r.status, sec: Math.round((Date.now() - t0) / 1000) });
}
console.log('\n================ TỔNG KẾT ================');
results.forEach(r => console.log((r.code === 0 ? 'PASS' : 'FAIL') + '  ' + r.s.padEnd(8) + ` (${r.sec}s)` + (r.code === 0 ? '' : '  exit ' + r.code)));
process.exit(results.every(r => r.code === 0) ? 0 : 1);
