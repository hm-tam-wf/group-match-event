'use strict';
// backend/scripts/hosts.js (domain → sự kiện mặc định, doc config/hosts) chạy THẬT trên emulator với service account GIẢ.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');

module.exports = {
  async run(t) {
    const { L, ok } = t;
    if (!fs.existsSync(t.script('hosts.js'))) { ok('hosts.js chưa có trong repo này — bỏ qua', true); return; }
    await L.reset();   // events/<EVENT>/meta/config + config/active
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const keyFile = path.join(t.tmp, 'fake-sa-hosts.json');
    fs.writeFileSync(keyFile, JSON.stringify({ type: 'service_account', project_id: L.PROJECT,
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), client_email: 'x@' + L.PROJECT + '.iam.gserviceaccount.com' }));
    try {
      const env = t.childEnv();
      const run = args => spawnSync(process.execPath, [t.script('hosts.js'), '--key', keyFile, ...args], { cwd: t.tmp, env, encoding: 'utf8' });
      const hosts = async () => { const s = await L.adb.doc('config/hosts').get(); return s.exists ? s.data().byHost : null; };

      let r = run([]);
      ok('hosts: liệt kê khi chưa có doc — exit 0, báo EMULATOR, (trống)', r.status === 0 && /EMULATOR/.test(r.stdout) && /trống/.test(r.stdout), { s: r.status, o: r.stdout, e: r.stderr });
      r = run(['--set', `hm-tam-wf.github.io=${L.EVENT}`]);
      ok('hosts: --set không --apply = XEM TRƯỚC, không ghi', r.status === 0 && /XEM TRƯỚC/.test(r.stdout) && (await hosts()) === null, { o: r.stdout, h: await hosts() });
      r = run(['--set', `HM-TAM-WF.github.io=${L.EVENT}`, '--set', `localhost=${L.EVENT}`, '--apply']);
      let h = await hosts();
      ok('hosts: --apply ghi map (domain về chữ thường, --set lặp được)', r.status === 0 && h && h['hm-tam-wf.github.io'] === L.EVENT && h.localhost === L.EVENT && Object.keys(h).length === 2, { o: r.stdout, e: r.stderr, h });
      r = run(['--set', 'localhost=khong-ton-tai', '--apply']);
      h = await hosts();
      ok('hosts: sự kiện đích không tồn tại ⇒ exit 1, không ghi', r.status === 1 && /Không tìm thấy sự kiện/.test(r.stderr) && h.localhost === L.EVENT, { s: r.status, e: r.stderr, h });
      r = run(['--set', 'localhost=khong-ton-tai', '--apply', '--force']);
      h = await hosts();
      ok('hosts: --force bỏ qua kiểm tra tồn tại', r.status === 0 && h.localhost === 'khong-ton-tai', { s: r.status, e: r.stderr, h });
      r = run(['--remove', 'localhost', '--apply']);
      h = await hosts();
      ok('hosts: --remove gỡ đúng 1 domain, giữ domain khác', r.status === 0 && !('localhost' in h) && h['hm-tam-wf.github.io'] === L.EVENT, { o: r.stdout, h });
      r = run(['--set', 'http://x.com=abc']);
      ok('hosts: domain sai (có http://) ⇒ exit 1', r.status === 1 && /Domain không hợp lệ/.test(r.stderr), { s: r.status, e: r.stderr });
      r = run(['--set', 'x.com=Bad_ID']);
      ok('hosts: ID sự kiện sai ⇒ exit 1', r.status === 1 && /ID sự kiện không hợp lệ/.test(r.stderr), { s: r.status, e: r.stderr });
      r = run(['--sett', 'x']);
      ok('hosts: tham số gõ sai ⇒ exit 1', r.status === 1 && /Tham số không hợp lệ/.test(r.stderr), { s: r.status, e: r.stderr });
      r = run([]);
      ok('hosts: liệt kê sau khi ghi', r.status === 0 && new RegExp(`hm-tam-wf\\.github\\.io\\s+→\\s+${L.EVENT}`).test(r.stdout), r.stdout);
    } finally {
      try { fs.unlinkSync(keyFile); } catch (e) {}
    }
  },
};
