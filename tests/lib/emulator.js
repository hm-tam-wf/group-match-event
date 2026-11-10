'use strict';
// Bật / tắt Firestore Emulator (project demo-*) cho MỘT suite. Đa nền tảng:
//   Windows: spawn qua shell, tắt bằng taskkill cả cây process; Linux/macOS: process group riêng, tắt bằng signal.
// Dự phòng: chỉ giết java của emulator chạy ĐÚNG cổng của mình (máy dùng chung với các đợt test khác cổng).
const { spawn, spawnSync, execFileSync } = require('child_process');
const fs = require('fs'), net = require('net'), path = require('path');
const C = require('./config');

const START_TIMEOUT_MS = 120000;   // lần đầu firebase-tools có thể phải tải jar emulator
const STOP_TIMEOUT_MS = 20000;
const POLL_MS = 500;
const LOG_TAIL_CHARS = 4000;
const isWin = process.platform === 'win32';

let child = null, logStream = null, logTail = '';

const HTTP_PROBE_TIMEOUT_MS = 2000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Sẵn sàng = emulator TRẢ LỜI HTTP. Chỉ kiểm TCP là SAI: firebase-tools mở listener tạm trên chính cổng này để kiểm
// cổng còn trống trước khi spawn Java ⇒ poll TCP trúng khe đó tưởng emulator đã lên (fetch sau đó "fetch failed").
async function httpReady(port) {
  try {
    const r = await fetch(`http://${C.EMU_HOST}:${port}/`, { signal: AbortSignal.timeout(HTTP_PROBE_TIMEOUT_MS) });
    return r.status < 500;
  } catch (e) { return false; }
}
const portOpen = port => new Promise(res => {
  const s = net.connect(port, C.EMU_HOST);
  s.once('connect', () => { s.destroy(); res(true); });
  s.once('error', () => { s.destroy(); res(false); });
});
async function waitClosed(port, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (!(await portOpen(port))) return true; await sleep(POLL_MS); }
  return false;
}

// JAVA_HOME (nếu có) đứng đầu PATH; giữ đúng tên khoá PATH/Path của Windows (tránh 2 khoá trùng).
function childEnv() {
  const env = Object.assign({}, process.env);
  const key = Object.keys(env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  if (env.JAVA_HOME) env[key] = path.join(env.JAVA_HOME, 'bin') + path.delimiter + (env[key] || '');
  delete env.GOOGLE_APPLICATION_CREDENTIALS;   // emulator demo-* không cần credential; không để lộ key thật vào process con
  return env;
}

function checkTools(env) {
  const j = spawnSync('java', ['-version'], { env, encoding: 'utf8' });
  if (j.error || j.status !== 0) {
    throw new Error('Không chạy được Java — Firestore Emulator cần JDK/JRE 21+. Đặt JAVA_HOME hoặc thêm java vào PATH.'
      + (j.error ? ' (' + j.error.code + ')' : ''));
  }
  const f = spawnSync(`"${C.FIREBASE_BIN}" --version`, { env, encoding: 'utf8', shell: true });
  if (f.error || f.status !== 0) {
    throw new Error(`Không chạy được firebase CLI ("${C.FIREBASE_BIN}"). Cài: npm i -g firebase-tools@${C.FIREBASE_TOOLS_VERSION}`
      + ' (hoặc đặt TEST_FIREBASE_BIN=<đường dẫn>).');
  }
  const v = String(f.stdout || '').trim().split(/\s+/).pop();
  if (C.FIREBASE_TOOLS_VERSION && v !== C.FIREBASE_TOOLS_VERSION) {
    console.warn(`[emulator] CẢNH BÁO: firebase-tools ${v} khác bản cố định ${C.FIREBASE_TOOLS_VERSION} (package.json → config.firebaseTools)`);
  }
}

function writeConfig(dir, opts = {}) {
  const cfg = {
    firestore: { rules: C.RULES.split(path.sep).join('/') },
    emulators: {
      firestore: { host: C.EMU_HOST, port: C.ports.firestore, websocketPort: C.ports.websocket },
      hub: { host: C.EMU_HOST, port: C.ports.hub },
      logging: { host: C.EMU_HOST, port: C.ports.logging },
      ui: { enabled: false },
    },
  };
  if (opts.auth) cfg.emulators.auth = { host: C.EMU_HOST, port: C.ports.auth };   // Auth Emulator (trong process firebase-tools, không cần Java)
  const file = path.join(dir, 'firebase.json');
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  return file;
}

// label: tên suite ⇒ log riêng ở tests/.out/emulator-<label>/ (emulator.log, firebase-debug.log, firestore-debug.log).
// opts.auth: bật thêm Auth Emulator ở cổng TEST_PORT_BASE + 99 (suite cần đăng nhập Firebase Auth thật, vd admin-e2e).
let withAuth = false;
async function start(label = 'tests', opts = {}) {
  if (child) throw new Error('emulator đã bật trong process này');
  if (!/^demo-/.test(C.PROJECT)) throw new Error('Chỉ chạy emulator với project demo-*');
  const dir = path.join(C.OUT, 'emulator-' + label);
  fs.mkdirSync(dir, { recursive: true });
  for (const p of [C.ports.firestore].concat(opts.auth ? [C.ports.auth] : [])) {
    if (await portOpen(p)) {
      throw new Error(`Cổng ${p} đang bận — emulator khác / đợt test trước chưa tắt? Tắt nó hoặc đặt TEST_PORT_BASE khác.`);
    }
  }
  if (!fs.existsSync(C.RULES)) throw new Error('Không thấy file rules: ' + C.RULES);
  const env = childEnv();
  checkTools(env);
  withAuth = !!opts.auth;
  const cfgFile = writeConfig(dir, opts);
  const cmd = `"${C.FIREBASE_BIN}" emulators:start --only ${withAuth ? 'firestore,auth' : 'firestore'} --project ${C.PROJECT} --config "${cfgFile}"`;
  logStream = fs.createWriteStream(path.join(dir, 'emulator.log'));
  logTail = '';
  child = spawn(cmd, { cwd: dir, env, shell: true, detached: !isWin, stdio: ['ignore', 'pipe', 'pipe'] });
  const keep = d => { logStream.write(d); logTail = (logTail + d).slice(-LOG_TAIL_CHARS); };
  child.stdout.on('data', keep); child.stderr.on('data', keep);

  await new Promise((resolve, reject) => {
    let done = false;
    const finish = (err) => { if (done) return; done = true; err ? reject(err) : resolve(); };
    child.once('exit', code => finish(new Error(`firebase emulators:start thoát sớm (code ${code}). Log: ${path.join(dir, 'emulator.log')}\n${logTail}`)));
    (async () => {
      const t0 = Date.now();
      while (!done && Date.now() - t0 < START_TIMEOUT_MS) {
        if (await httpReady(C.ports.firestore) && (!withAuth || await httpReady(C.ports.auth))) return finish();
        await sleep(POLL_MS);
      }
      finish(new Error(`Emulator không lên sau ${START_TIMEOUT_MS / 1000}s. Log: ${path.join(dir, 'emulator.log')}\n${logTail}`));
    })();
  }).catch(async e => { await stop(); throw e; });
  console.log(`[emulator] Firestore ${C.EMU_HOST}:${C.ports.firestore}${withAuth ? ` · Auth ${C.EMU_HOST}:${C.ports.auth}` : ''} · project ${C.PROJECT} · rules ${C.RULES}`);
}

// Dự phòng: giết java của Firestore Emulator đang chạy đúng cổng của mình (không đụng emulator cổng khác).
// firebase-tools chạy: java … -jar …cloud-firestore-emulator-vX.jar --host 127.0.0.1 --port <cổng> --websocket_port …
function killStray() {
  const port = String(C.ports.firestore);
  try {
    if (isWin) {
      execFileSync('powershell', ['-NoProfile', '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { $_.CommandLine -like '*cloud-firestore-emulator*' -and $_.CommandLine -like '*--port ${port} *' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
        { stdio: 'ignore' });
    } else {
      execFileSync('pkill', ['-KILL', '-f', `cloud-firestore-emulator.*--port ${port}( |$)`], { stdio: 'ignore' });
    }
  } catch (e) { /* không còn gì để giết */ }
}

function killTreeSync(pid, signal) {
  try {
    if (isWin) execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, signal);
  } catch (e) { /* process đã thoát */ }
}

async function stop() {
  if (!child) return;
  const pid = child.pid;
  child = null;
  killTreeSync(pid, 'SIGTERM');
  if (!(await waitClosed(C.ports.firestore, STOP_TIMEOUT_MS))) {
    if (!isWin) killTreeSync(pid, 'SIGKILL');
    killStray();
    await waitClosed(C.ports.firestore, STOP_TIMEOUT_MS / 4);
  }
  if (withAuth) { await waitClosed(C.ports.auth, STOP_TIMEOUT_MS / 4); withAuth = false; }   // Auth nằm trong cây process vừa tắt
  if (logStream) { logStream.end(); logStream = null; }
}

// Lưới an toàn: process test chết bất ngờ (uncaught / Ctrl+C) vẫn tắt emulator mình bật.
process.on('exit', () => { if (child) { killTreeSync(child.pid, 'SIGKILL'); child = null; } });

module.exports = { start, stop, childEnv };
