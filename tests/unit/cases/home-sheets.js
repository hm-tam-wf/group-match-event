'use strict';
// HomeSheets (fe/js/home/home-sheets.js — định dạng file Excel của trang home, dùng chung trình soạn admin + script):
// round-trip doc → xlsx → doc khớp tuyệt đối (bằng chính thư viện xlsx của repo), định dạng ô Text, báo lỗi tham chiếu kèm sheet/dòng.
const path = require('path');

module.exports = {
  async run(t) {
    const { ok } = t;
    if (!t.exists('fe/js/home/home-sheets.js')) { ok('home-sheets.js chưa có trong repo này — bỏ qua', true); return; }
    const XLSX = require(path.join(t.ROOT, 'node_modules', 'xlsx'));
    const HS = require(path.join(t.REPO, 'fe/js/home/home-schema.js'));
    const SH = require(path.join(t.REPO, 'fe/js/home/home-sheets.js'));
    const seed = JSON.parse(t.read('backend/seed/home-tnt.json'));
    const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x));
    const roundTrip = doc => {
      const buf = XLSX.write(SH.toWorkbook(XLSX, doc), { type: 'buffer', bookType: 'xlsx' });
      const res = SH.fromWorkbook(XLSX, XLSX.read(buf, { type: 'buffer' }));
      return { res, v: HS.validate(res.doc), buf };
    };

    let { res, v, buf } = roundTrip(seed);
    ok('home-sheets: seed → xlsx → doc không lỗi, hợp lệ', !res.errors.length && !res.warnings.length && v.ok, { e: res.errors, w: res.warnings, v: v.errors });
    ok('home-sheets: round-trip seed KHỚP tuyệt đối', canon(v.doc) === canon(HS.normalize(seed)));
    const wb = XLSX.read(buf, { type: 'buffer', cellNF: true });
    ok('home-sheets: đủ 10 sheet đúng tên + thứ tự', JSON.stringify(wb.SheetNames) === JSON.stringify(['Trang', 'Mục', 'Lịch trình', 'Lưu ý', 'Trang phục', 'Màu trang phục', 'Di chuyển', 'Xe', 'Liên hệ', 'Hướng dẫn']), wb.SheetNames);
    const tl = wb.Sheets['Lịch trình'];
    ok('home-sheets: ô giờ là chữ + định dạng Text (@)', tl.G2 && tl.G2.v === '05:30' && tl.G2.t === 's' && tl.G2.z === '@', tl.G2);
    const rows = XLSX.utils.sheet_to_json(tl, { header: 1, raw: false });
    ok('home-sheets: lịch trình 21 dòng hoạt động, thông tin ngày chỉ ở dòng đầu của ngày', rows.length === 22 && rows[1][2] === 'NGÀY 01' && !rows[2][2] && rows[9][1] === '2' && rows[9][2] === 'NGÀY 02', rows.slice(0, 3));

    const d2 = JSON.parse(JSON.stringify(seed));
    d2.sections.push({ id: 'gallery', type: 'gallery', title: 'Ảnh', photos: [{ url: 'a.png', cap: 'x' }], n: 2 });
    d2.sections.push(HS.blankSection('notes', 'empty-notes', { title: 'Rỗng' }));
    d2.sections[0].days.push({ label: 'NGÀY 04', date: '', title: 'Dự phòng', summary: '', items: [] });
    d2.sections[2].items[2].featured = true;
    d2.sections.push(Object.assign(HS.blankSection('text', 'txt', { title: 'Văn bản' }), { body: 'Dòng 1\nDòng 2\n\nĐoạn 2', bodyHtml: '<p>a <b>b</b></p>' }));
    ({ res, v } = roundTrip(d2));
    ok('home-sheets: type lạ / ngày không hoạt động / mục rỗng / featured / text nhiều dòng — round-trip khớp',
      !res.errors.length && v.ok && canon(v.doc) === canon(HS.normalize(d2)), { e: res.errors, v: v.errors });

    const sheets = Object.fromEntries(SH.toSheets(seed).map(s => [s.name, s.rows]));
    const bad = JSON.parse(JSON.stringify(sheets));
    bad['Lưu ý'][2][0] = 'khong-co';
    bad['Màu trang phục'][1][1] = '9';
    bad['Lịch trình'][3][0] = 'notes';
    bad['Lịch trình'][4][1] = 'x';
    let r = SH.fromSheets(bad);
    const hasErr = re => r.errors.some(e => re.test(e.sheet + ' ' + e.row + ' ' + e.msg));
    ok('home-sheets: báo lỗi kèm số dòng — mục không tồn tại / sai type / màu không có thẻ / day không phải số',
      hasErr(/^Lưu ý 3 .*khong-co/) && hasErr(/^Màu trang phục 2 .*item 9/) && hasErr(/^Lịch trình 4 .*type notes/) && hasErr(/^Lịch trình 5 .*day/), r.errors);
    const noPage = Object.assign({}, sheets); delete noPage['Trang'];
    r = SH.fromSheets(noPage);
    ok('home-sheets: thiếu sheet bắt buộc ⇒ lỗi', r.errors.some(e => /thiếu sheet "Trang"/.test(e.msg)), r.errors);
    const dup = JSON.parse(JSON.stringify(sheets)); dup['Mục'][2][0] = 'timeline';
    r = SH.fromSheets(dup);
    ok('home-sheets: id mục trùng ⇒ lỗi', r.errors.some(e => /bị trùng/.test(e.msg)), r.errors);
    const extra = JSON.parse(JSON.stringify(sheets)); extra['Trang'].push(['hero.foo', 'x'], ['', ''], ['pageTitle', 'Mới']);
    r = SH.fromSheets(extra);
    ok('home-sheets: key lạ ở sheet Trang ⇒ cảnh báo; dòng trống bỏ qua; key sau thắng', r.warnings.length === 1 && r.doc.pageTitle === 'Mới' && !r.errors.length, r);
    const nocol = JSON.parse(JSON.stringify(sheets)); nocol['Xe'][0][0] = 'muc';
    r = SH.fromSheets(nocol);
    ok('home-sheets: thiếu cột section ⇒ lỗi', r.errors.some(e => e.sheet === 'Xe' && /thiếu cột: section/.test(e.msg)), r.errors);
    const typed = JSON.parse(JSON.stringify(sheets));
    typed['Trang phục'][1][7] = 'TRUE'; typed['Màu trang phục'][1][4] = 'có'; typed['Lịch trình'][1][1] = 1;
    r = SH.fromSheets(typed); v = HS.validate(r.doc);
    ok('home-sheets: Excel gõ TRUE / "có" ⇒ true; số ⇒ chuỗi', v.ok && v.doc.sections[2].items[0].featured === true && v.doc.sections[2].items[0].colors[0].border === true, v.errors);
  },
};
