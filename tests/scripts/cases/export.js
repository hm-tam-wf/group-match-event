'use strict';
// backend/scripts/export.js chạy THẬT trên emulator với service account GIẢ (project demo-*, emulator không kiểm chữ ký): kiểm CSV.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');

module.exports = {
  async run(t) {
    const { L, ok } = t;
    await L.reset();
    const cfg = (await L.ev().collection('meta').doc('config').get()).data();
    const icon0 = cfg.icons[0];
    const TS = ms => L.admin.firestore.Timestamp.fromMillis(ms);
    await L.ev().collection('signups').doc('u1').set({ name: 'Lê Thị Alpha', playerId: 'u1', icon: icon0.icon, at: TS(Date.UTC(2026, 10, 10, 3, 0, 0)) });
    await L.ev().collection('signups').doc('u2').set({ name: '=HACK()', playerId: 'u2', at: TS(Date.UTC(2026, 10, 10, 2, 0, 0)) });   // chưa chọn đội

    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const keyFile = path.join(t.tmp, 'fake-sa.json');
    fs.writeFileSync(keyFile, JSON.stringify({ type: 'service_account', project_id: L.PROJECT,
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), client_email: 'x@' + L.PROJECT + '.iam.gserviceaccount.com' }));
    try {
      const env = t.childEnv();
      const run = args => spawnSync(process.execPath, [t.script('export.js'), '--key', keyFile, ...args], { cwd: t.tmp, env, encoding: 'utf8' });

      const out = path.join(t.tmp, 'export-out.csv'); try { fs.unlinkSync(out); } catch (e) {}
      const r1 = run(['--out', out]);                          // không --event ⇒ sự kiện đang mở (config/active)
      ok('export chạy xong (exit 0)', r1.status === 0, { status: r1.status, err: (r1.stderr || '').slice(0, 300) });
      const csv = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
      ok('có BOM UTF-8', csv.charCodeAt(0) === 0xFEFF);
      const rows = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
      const want = ['STT', 'Thời gian', ...cfg.fields.map(f => f.label || f.key), 'Đội', 'Icon', 'PlayerID'].map(h => '"' + h + '"').join(',');
      ok('tiêu đề cột theo cấu hình sự kiện', rows[0] === want, { got: rows[0], want });
      ok('2 dòng dữ liệu', rows.length === 3, rows.length);
      ok('sắp theo thời gian (u2 02:00 trước u1 03:00)', /"u2"$/.test(rows[1] || '') && /"u1"$/.test(rows[2] || ''), rows.slice(1));
      ok('giờ VN (UTC+7)', (rows[1] || '').includes('"2026-11-10 09:00:00"'), rows[1]);
      ok('tên đội lấy từ meta/config.icons', (rows[2] || '').includes('"' + (icon0.name || icon0.icon) + '"'), rows[2]);
      ok('chống chèn công thức (=HACK() ⇒ \'=HACK())', (rows[1] || '').includes('"\'=HACK()"'), rows[1]);
      ok('in tên sự kiện trong tóm tắt', /Sự kiện:/.test(r1.stdout || ''), (r1.stdout || '').slice(0, 200));

      const r2 = run(['--event', 'khong-ton-tai', '--out', out + '.2']);
      ok('--event sai ID ⇒ exit 1 + báo không tìm thấy', r2.status === 1 && /Không tìm thấy sự kiện/.test(r2.stderr || ''), { status: r2.status, err: (r2.stderr || '').slice(0, 200) });
      const r3 = run(['--evnt', 'x']);
      ok('tham số gõ sai ⇒ báo lỗi, không chạy', r3.status === 1 && /Tham số không hợp lệ/.test(r3.stderr || ''), (r3.stderr || '').slice(0, 200));
    } finally { try { fs.unlinkSync(keyFile); } catch (e) {} }
  },
};
