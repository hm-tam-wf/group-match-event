// build-admin-site.js — dựng thư mục phục vụ SITE ADMIN RIÊNG (firebase.json: hosting site "pickyourgroup-admin").
// Chỉ chép fe/admin.html + đúng các file cục bộ nó tham chiếu (<script src>, <link href>, ảnh, url() trong CSS) —
// danh sách SUY RA từ chính admin.html, không liệt kê tay ⇒ admin thêm file mới vẫn tự có mặt; trang sự kiện KHÔNG lên site admin.
// Thư mục ra tự có .gitignore "*" (không bao giờ bị commit; Firebase Hosting bỏ qua file chấm khi deploy).
//
// Chạy tự động trước khi deploy site admin (predeploy trong firebase.json), hoặc tay:
//   node backend/scripts/build-admin-site.js [--out <thư-mục>] [--entry admin.html]
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FE = path.join(ROOT, 'fe');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, arg('out', 'hosting-admin'));
const ENTRY = arg('entry', 'admin.html');

const isLocal = u => u && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);      // bỏ http(s):, data:, //cdn, #neo
const clean = u => decodeURIComponent(u.trim().split(/[?#]/)[0]);

function refsInHtml(html) {
  const out = new Set(), re = /<(?:script|link|img|source|use)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m; while ((m = re.exec(html))) if (isLocal(m[1].trim())) out.add(clean(m[1]));
  return [...out];
}
function refsInCss(css) {
  const out = new Set(), re = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
  let m; while ((m = re.exec(css))) if (isLocal(m[2].trim())) out.add(clean(m[2]));
  return [...out];
}

function main() {
  if (!OUT.startsWith(ROOT + path.sep) || OUT === FE || OUT.startsWith(FE + path.sep))
    throw new Error('--out phải là thư mục con của repo và KHÔNG nằm trong fe/: ' + OUT);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const queue = [ENTRY], done = new Set(), missing = [];
  while (queue.length) {
    const rel = path.posix.normalize(queue.shift().replace(/\\/g, '/'));
    if (done.has(rel)) continue;
    done.add(rel);
    const src = path.join(FE, rel);
    if (!src.startsWith(FE + path.sep)) throw new Error('tham chiếu ra ngoài fe/: ' + rel);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) { missing.push(rel); continue; }
    const dst = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    const ext = path.extname(rel).toLowerCase();
    const base = path.posix.dirname(rel);
    if (ext === '.html') refsInHtml(fs.readFileSync(src, 'utf8')).forEach(r => queue.push(path.posix.join(base, r)));
    if (ext === '.css') refsInCss(fs.readFileSync(src, 'utf8')).forEach(r => queue.push(path.posix.join(base, r)));
  }
  fs.writeFileSync(path.join(OUT, '.gitignore'), '*\n');
  if (missing.length) throw new Error(ENTRY + ' tham chiếu file không có: ' + missing.join(', '));
  console.log(`site admin: ${done.size} file → ${path.relative(ROOT, OUT)}\n  ` + [...done].join('\n  '));
}

try { main(); } catch (e) { console.error('LỖI build-admin-site:', e.message); process.exit(1); }
