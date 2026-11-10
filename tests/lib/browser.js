'use strict';
// Dò + mở trình duyệt Chromium (Edge / Chrome) cho test. puppeteer-core KHÔNG tự tải trình duyệt.
// Thứ tự: TEST_BROWSER / CHROME_PATH → Windows: Edge rồi Chrome · macOS: Chrome, Edge, Chromium · Linux: google-chrome… trên PATH.
const fs = require('fs'), path = require('path');
const C = require('./config');

// Lưới an toàn: trang test KHÔNG BAO GIỜ tới được Firestore production (vá firebase-config hỏng ⇒ lỗi mạng, không ghi nhầm).
const BLOCK_PROD_FIRESTORE = '--host-resolver-rules=MAP firestore.googleapis.com ~NOTFOUND';
const BASE_ARGS = ['--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions'];

function onPath(names) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const n of names) for (const d of dirs) { const p = path.join(d, n); if (fs.existsSync(p)) return p; }
  return '';
}

function findBrowser() {
  if (C.BROWSER) {
    if (!fs.existsSync(C.BROWSER)) throw new Error('TEST_BROWSER/CHROME_PATH trỏ tới file không tồn tại: ' + C.BROWSER);
    return C.BROWSER;
  }
  let cand = [];
  if (process.platform === 'win32') {
    const roots = [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA].filter(Boolean);
    cand = roots.map(r => path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
      .concat(roots.map(r => path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe')));
  } else if (process.platform === 'darwin') {
    cand = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  } else {
    cand = [onPath(['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'])];
  }
  const hit = cand.find(p => p && fs.existsSync(p));
  if (!hit) throw new Error('Không tìm thấy Chrome/Edge. Cài Chrome hoặc đặt TEST_BROWSER=<đường dẫn file chạy trình duyệt>.');
  return hit;
}

// opts: tuỳ chọn puppeteer.launch (args được NỐI thêm). allowProdFirestore: chỉ cho smoke tay trên site thật (chỉ đọc).
async function launch(opts = {}) {
  const puppeteer = require('puppeteer-core');
  const { allowProdFirestore, args = [], ...rest } = opts;
  const all = BASE_ARGS.concat(C.NO_SANDBOX ? ['--no-sandbox'] : [], allowProdFirestore ? [] : [BLOCK_PROD_FIRESTORE], args);
  return puppeteer.launch(Object.assign({ executablePath: findBrowser(), headless: !C.HEADFUL }, rest, { args: all }));
}

module.exports = { findBrowser, launch };
