'use strict';
// backend/scripts/home-import.js (nạp trang home events/<id>/meta/home từ JSON/Excel) chạy THẬT trên emulator.
// Mặc định DRY-RUN; --apply mới ghi rồi đọc lại; sự kiện thiếu meta/config ⇒ từ chối; Excel lỗi tham chiếu ⇒ không ghi.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');

module.exports = {
  async run(t) {
    const { L, ok } = t;
    if (!fs.existsSync(t.script('home-import.js'))) { ok('home-import.js chưa có trong repo này — bỏ qua', true); return; }
    const XLSX = require(path.join(t.ROOT, 'node_modules', 'xlsx'));
    const HS = require(path.join(t.REPO, 'fe/js/home/home-schema.js'));
    const SH = require(path.join(t.REPO, 'fe/js/home/home-sheets.js'));
    const SEED_PATH = path.join(t.REPO, 'backend/seed/home-tnt.json');
    const SEED = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x));
    const EV = 'home-script-ev';
    const home = id => L.adb.collection('events').doc(id).collection('meta').doc('home');
    const server = async id => { const s = await home(id).get(); return s.exists ? HS.normalize(s.data()) : null; };
    const env = t.childEnv();
    const run = args => {
      const r = spawnSync(process.execPath, [t.script('home-import.js'), ...args, '--project', L.PROJECT], { cwd: t.tmp, env, encoding: 'utf8' });
      return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
    };

    await L.reset();
    await L.adb.doc(`events/${EV}/meta/config`).set({ title: 'Script test' });
    let r = run(['--event', EV, '--file', SEED_PATH]);
    ok('home-import: dry-run khi chưa có doc — tóm tắt + "sẽ tạo mới", KHÔNG ghi', r.code === 0 && /DRY-RUN/.test(r.out) && /EMULATOR/.test(r.out) && /sẽ tạo mới/.test(r.out)
      && /\[timeline\] #sec-timeline/.test(r.out) && (await server(EV)) === null, r.out);
    r = run(['--event', EV, '--file', SEED_PATH, '--apply']);
    ok('home-import: --apply ghi + đọc lại khớp seed', r.code === 0 && /đọc lại khớp/.test(r.out) && canon(await server(EV)) === canon(SEED), r.out);
    r = run(['--event', EV, '--file', SEED_PATH]);
    ok('home-import: chạy lại cùng file ⇒ "giống hệt — không cần ghi"', r.code === 0 && /giống hệt/.test(r.out), r.out);

    const mod = JSON.parse(JSON.stringify(SEED));
    mod.hero.title = 'TIÊU ĐỀ MỚI';
    mod.sections[1].items.pop();
    mod.sections[0].days[0].items[0].time = '05:45';
    const modPath = path.join(t.tmp, 'home-mod.json');
    fs.writeFileSync(modPath, JSON.stringify(mod, null, 2));
    r = run(['--event', EV, '--file', modPath]);
    ok('home-import: file sửa ⇒ dry-run liệt kê đúng 3 chỗ khác (~ sửa, - bỏ), server giữ nguyên', r.code === 0 && /Khác bản đang có ở 3 chỗ/.test(r.out)
      && /~ hero\.title: "TRẠM NGHỈ DƯỠNG TNT" → "TIÊU ĐỀ MỚI"/.test(r.out) && /- sections\[1\]\.items\[5\]/.test(r.out)
      && /~ sections\[0\]\.days\[0\]\.items\[0\]\.time/.test(r.out) && canon(await server(EV)) === canon(SEED), r.out);
    r = run(['--event', 'khong-co-ev', '--file', SEED_PATH, '--apply']);
    ok('home-import: sự kiện không có meta/config ⇒ exit 1, không ghi', r.code === 1 && /không có meta\/config/.test(r.out) && (await server('khong-co-ev')) === null, r.out);
    r = run(['--event', 'BAD_ID', '--file', SEED_PATH]);
    ok('home-import: --event sai định dạng ⇒ exit 1', r.code === 1 && /--event không hợp lệ/.test(r.out), r.out);
    const badJson = path.join(t.tmp, 'home-bad.json');
    fs.writeFileSync(badJson, JSON.stringify({ hero: { imageUrl: 'javascript:x' }, sections: [{ id: 'A B', type: 'notes' }] }));
    r = run(['--event', EV, '--file', badJson, '--apply']);
    ok('home-import: dữ liệu sai schema ⇒ in lỗi theo đường dẫn, exit 1, không ghi', r.code === 1 && /hero\.imageUrl: URL không hợp lệ/.test(r.out)
      && /sections\[0\]\.id/.test(r.out) && canon(await server(EV)) === canon(SEED), r.out);

    const xlsxPath = path.join(t.tmp, 'home-script.xlsx');
    XLSX.writeFile(SH.toWorkbook(XLSX, mod), xlsxPath);
    r = run(['--event', EV, '--file', xlsxPath, '--apply']);
    ok('home-import: --file .xlsx + --apply ⇒ server = nội dung file Excel', r.code === 0 && canon(await server(EV)) === canon(HS.normalize(mod)), r.out);
    const sheets = SH.toSheets(SEED);
    sheets.find(s => s.name === 'Xe').rows[1][0] = 'sai-muc';
    const wb = XLSX.utils.book_new();
    sheets.forEach(s => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name));
    const badX = path.join(t.tmp, 'home-script-bad.xlsx');
    XLSX.writeFile(wb, badX);
    r = run(['--event', EV, '--file', badX, '--apply']);
    ok('home-import: Excel lỗi tham chiếu ⇒ in lỗi kèm sheet/dòng, exit 1, server giữ nguyên', r.code === 1 && /sheet "Xe" dòng 2: mục "sai-muc"/.test(r.out)
      && canon(await server(EV)) === canon(HS.normalize(mod)), r.out);
  },
};
