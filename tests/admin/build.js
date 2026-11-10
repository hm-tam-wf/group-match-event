'use strict';
// Dựng bản admin chạy offline: copy fe/admin.html + js/themes/assets, thay Firebase CDN bằng mock-firebase.js.
// Hook test: ?theme=<tên> ép theme · ?tab=signups|allowlist|events|drawer mở tab sau khi dữ liệu tải.
// Dùng như module (tests/admin/run.js) hoặc tay: node tests/admin/build.js <feDir> <outDir>
const fs = require('fs'), path = require('path');

function buildAdmin(feDir, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(path.join(feDir, 'js'), path.join(outDir, 'js'), { recursive: true });
  for (const d of ['themes', 'assets']) if (fs.existsSync(path.join(feDir, d))) fs.cpSync(path.join(feDir, d), path.join(outDir, d), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'mock-firebase.js'), path.join(outDir, 'mock-firebase.js'));
  let html = fs.readFileSync(path.join(feDir, 'admin.html'), 'utf8');
  html = html.replace(/<script src="https:\/\/www\.gstatic\.com[^"]*"><\/script>\s*/g, '')
    .replace(/<script src="https:\/\/cdn\.sheetjs\.com[^"]*"><\/script>/, '<script src="mock-firebase.js"></script>');
  if (!html.includes('mock-firebase.js') || /www\.gstatic\.com\/firebasejs/.test(html)) {
    throw new Error('build admin: không thay được thẻ <script> Firebase CDN bằng mock (admin.html đổi cách nạp SDK?) — sửa tests/admin/build.js');
  }
  // ?theme=<tên> → ép theme qua cả 2 key (bản cũ đọc 'theme', bản mới đọc 'adminTheme'), chạy TRƯỚC theme.js
  html = html.replace('<script src="js/config/theme.js"></script>', `<script>try{var q=new URLSearchParams(location.search).get('theme');
  if(q){localStorage.setItem('theme',q);localStorage.setItem('adminTheme',q);}}catch(e){}</script>
<script src="js/config/theme.js"></script>`);
  // Chọn tab theo ?tab=signups|allowlist (sau khi dữ liệu tải xong)
  html = html.replace(/<\/body>/, `<script>
  setTimeout(function(){ var t=new URLSearchParams(location.search).get('tab');
    var map={signups:'tabSignups',allowlist:'tab-allowlist',events:'tabEvents',drawer:'tabEvents'};
    if(t&&map[t]){ var b=document.querySelector('.tab[data-tab="'+map[t]+'"]'); if(b) b.click(); }
    if(t==='signups') setTimeout(function(){ var r=document.getElementById('btnLoad'); if(r) r.click(); }, 200);
    if(t==='drawer') setTimeout(function(){ var e=document.querySelector('#evListWrap [data-action="edit"]'); if(e) e.click(); }, 200);
  }, 300);
</script></body>`);
  fs.writeFileSync(path.join(outDir, 'admin.html'), html);
  return path.join(outDir, 'admin.html');
}

module.exports = { buildAdmin };
if (require.main === module) {
  const [feDir, outDir] = process.argv.slice(2);
  if (!feDir || !outDir) { console.error('Dùng: node tests/admin/build.js <feDir> <outDir>'); process.exit(1); }
  console.log('built', buildAdmin(path.resolve(feDir), path.resolve(outDir)));
}
