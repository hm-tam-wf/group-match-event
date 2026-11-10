'use strict';
// Cấu hình chung của bộ test — nơi DUY NHẤT đọc biến môi trường. Mọi giá trị có mặc định chạy được ngay
// (repo cần test = chính repo chứa thư mục tests/). Project Firestore luôn là demo-* ⇒ chỉ emulator, KHÔNG BAO GIỜ production.
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');           // repo chứa tests/ (package.json, node_modules)
const PKG = require(path.join(ROOT, 'package.json'));

function int(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${name}="${v}" không phải số nguyên`);
  return n;
}

// Cổng emulator = TEST_PORT_BASE + offset (cùng bố cục với cổng mặc định của Firebase 8080/9150/4400/4500).
// Mặc định 21000 ⇒ 21080/21150/21400/21500: không trùng cổng mặc định của Firebase, nằm ngoài dải cổng tạm
// (ephemeral) của Windows (49152+) và Linux (32768+). Máy chạy song song nhiều đợt test ⇒ mỗi đợt một TEST_PORT_BASE.
const PORT_OFFSET = { firestore: 80, websocket: 150, hub: 400, logging: 500 };
const PORT_BASE = int('TEST_PORT_BASE', 21000);
if (PORT_BASE < 1024 || PORT_BASE + Math.max(...Object.values(PORT_OFFSET)) > 65535) {
  throw new Error(`TEST_PORT_BASE=${PORT_BASE} ngoài khoảng hợp lệ (1024..${65535 - Math.max(...Object.values(PORT_OFFSET))})`);
}
const ports = Object.fromEntries(Object.entries(PORT_OFFSET).map(([k, o]) => [k, PORT_BASE + o]));

const REPO = path.resolve(process.env.TEST_REPO || ROOT);   // repo cần test (fe/, backend/)

module.exports = {
  ROOT,
  REPO,
  OUT: path.resolve(process.env.TEST_OUT_DIR || path.join(ROOT, 'tests', '.out')),   // log emulator, kết quả JSON, file tạm
  PROJECT: 'demo-icon-picker',                    // tiền tố demo- ⇒ emulator chạy không cần credential
  EMU_HOST: '127.0.0.1',
  PORT_BASE,
  ports,
  RULES: path.resolve(process.env.TEST_RULES || path.join(REPO, 'backend', 'firestore.rules')),
  FIREBASE_BIN: process.env.TEST_FIREBASE_BIN || 'firebase',
  FIREBASE_TOOLS_VERSION: (PKG.config && PKG.config.firebaseTools) || '',   // bản firebase-tools cố định (package.json → config)
  BROWSER: process.env.TEST_BROWSER || process.env.CHROME_PATH || '',     // trống ⇒ tự dò Edge/Chrome
  HEADFUL: process.env.TEST_HEADFUL === '1',
  // Linux trong CI (runner Ubuntu chặn user namespace) cần --no-sandbox; trang test chỉ là file của chính repo.
  NO_SANDBOX: process.env.TEST_NO_SANDBOX === '1' || (process.platform === 'linux' && !!process.env.CI),
  LIVE_BASE: process.env.TEST_LIVE_BASE || 'https://hm-tam-wf.github.io/group-match-event/',   // chỉ smoke tay (đọc)
  ONLY: (process.env.TEST_ONLY || '').split(',').map(s => s.trim()).filter(Boolean),
};
