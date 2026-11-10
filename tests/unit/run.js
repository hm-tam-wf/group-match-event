'use strict';
// Unit: nạp NGUYÊN VĂN code FE / backend của repo cần test vào Node (vm), không emulator, không trình duyệt.
// Mỗi file tests/unit/cases/*.js export { run(t) }. Dùng: node tests/unit/run.js [chuỗi lọc tên file…]
const fs = require('fs'), path = require('path'), vm = require('vm');
const C = require('../lib/config');
const { listCases } = require('../lib/discover');
const { createReport, exitLater } = require('../lib/report');

const read = rel => fs.readFileSync(path.join(C.REPO, rel), 'utf8').replace(/\r\n/g, '\n');   // checkout Windows có thể là CRLF

const t = {
  REPO: C.REPO, ROOT: C.ROOT, OUT: C.OUT,
  read,
  exists: rel => fs.existsSync(path.join(C.REPO, rel)),
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  // Chạy từng file như MỘT thẻ <script> riêng trong CÙNG vm context: let/const top-level dùng chung giữa các file
  // (không nối chuỗi ⇒ khai trùng tên giữa các file vẫn báo lỗi như trình duyệt). Lỗi cú pháp/chạy ném kèm tên file.
  runScripts(ctx, rels) { for (const rel of rels) new vm.Script(read(rel), { filename: rel }).runInContext(ctx); },
  // env cho process con chạy script backend của repo (thư viện lấy từ node_modules của repo chứa tests/).
  childEnv(extra = {}) {
    const env = Object.assign({}, process.env, extra);
    env.NODE_PATH = [path.join(C.ROOT, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    return env;
  },
};

(async () => {
  const report = createReport('unit');
  let code = 0;
  try {
    fs.mkdirSync(C.OUT, { recursive: true });
    for (const c of listCases(path.join(__dirname, 'cases'))) {
      console.log(`\n=== ${c.file} ===`);
      try { await require(c.path).run(Object.assign({ ok: report.ok }, t)); } catch (e) { report.crash(c.file, e); }
    }
  } catch (e) { console.error('SUITE ERROR', e); code = 2; }
  const failed = report.summary();
  exitLater(code || (failed ? 1 : 0));
})();
