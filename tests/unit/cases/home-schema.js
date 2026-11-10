'use strict';
// HomeSchema (fe/js/home/home-schema.js — schema trang home events/{id}/meta/home): validate chặt / normalize khoan dung,
// URL/hex/id/type, giới hạn độ dài, type lạ giữ nguyên, helper đường dẫn. Seed TNT phải hợp lệ tuyệt đối.
const path = require('path');

module.exports = {
  async run(t) {
    const { ok } = t;
    if (!t.exists('fe/js/home/home-schema.js')) { ok('home-schema.js chưa có trong repo này — bỏ qua', true); return; }
    const HS = require(path.join(t.REPO, 'fe/js/home/home-schema.js'));
    const seed = JSON.parse(t.read('backend/seed/home-tnt.json'));
    const clone = v => JSON.parse(JSON.stringify(v));
    const has = (r, p, re) => r.errors.some(e => e.path === p && (!re || re.test(e.msg)));

    let r = HS.validate(seed);
    ok('home-schema: seed TNT hợp lệ, 0 cảnh báo', r.ok && !r.warnings.length, r);
    ok('home-schema: normalize(seed) bất biến', JSON.stringify(HS.normalize(seed)) === JSON.stringify(seed));
    ok('home-schema: normalize({}) đủ khung', (() => { const d = HS.normalize({}); return d.v === 1 && d.hero.title === '' && Array.isArray(d.sections) && d.cta.url === '' && d.footer.text === ''; })());
    ok('home-schema: normalize(null / chuỗi) không ném', HS.normalize(null).v === 1 && HS.normalize('x').sections.length === 0);

    let d = clone(seed); d.hero.imageUrl = 'javascript:alert(1)'; d.cta.url = 'http://evil.com';
    r = HS.validate(d);
    ok('home-schema: URL javascript: / http: bị báo lỗi', has(r, 'hero.imageUrl', /URL/) && has(r, 'cta.url', /URL/), r.errors);
    ok('home-schema: URL xấu bị bỏ khi normalize', HS.normalize(d).hero.imageUrl === '' && HS.normalize(d).cta.url === '');
    ok('home-schema: URL hợp lệ (https / tương đối / #)', ['https://a.b/c.png', 'themes/x.png', '/img/a.png', 'index.html?e=a', '#sec-a', ''].every(HS.isSafeUrl));
    ok('home-schema: URL không hợp lệ (//host, data:, khoảng trắng, \\, https:// trống)', ['//evil.com/x', 'data:image/png;base64,AA', 'a b.png', 'a\\b', 'JAVASCRIPT:x', 'https://'].every(u => !HS.isSafeUrl(u)));

    d = clone(seed); d.sections[2].items[0].colors[0].hex = 'red; background:url(x)';
    r = HS.validate(d);
    ok('home-schema: hex sai bị báo + bỏ khi normalize', has(r, 'sections[2].items[0].colors[0].hex') && HS.normalize(d).sections[2].items[0].colors[0].hex === '', r.errors);

    d = clone(seed); d.sections[1].id = 'timeline'; d.sections[2].id = 'Bad ID';
    r = HS.validate(d);
    ok('home-schema: id mục trùng / sai định dạng bị báo', has(r, 'sections[1].id', /trùng/) && has(r, 'sections[2].id'), r.errors);
    const nd = HS.normalize(d);
    ok('home-schema: normalize tự sửa id trùng/sai thành duy nhất', new Set(nd.sections.map(s => s.id)).size === nd.sections.length && nd.sections.every(s => HS.SECTION_ID_RE.test(s.id)), nd.sections.map(s => s.id));

    d = clone(seed); d.hero.title = 'x'.repeat(121);
    ok('home-schema: quá dài bị báo kèm số ký tự', has(HS.validate(d), 'hero.title', /121/));

    d = clone(seed); d.sections.push({ id: 'gallery', type: 'gallery', photos: [{ url: 'a.png' }] });
    r = HS.validate(d);
    ok('home-schema: type lạ hợp lệ + cảnh báo + giữ nguyên dữ liệu', r.ok && r.warnings.some(w => /gallery/.test(w.msg)) && r.doc.sections[4].photos[0].url === 'a.png', r);
    d.sections.push({ id: 'x2', type: 'Bad Type!' });
    ok('home-schema: type sai định dạng bị báo', has(HS.validate(d), 'sections[5].type'));

    ok('home-schema: doc schema v2 bị từ chối sửa', has(HS.validate(Object.assign(clone(seed), { v: 2 })), 'v'));
    d = clone(seed); d.extra = 1; d.hero.foo = 2;
    r = HS.validate(d);
    ok('home-schema: trường lạ ⇒ cảnh báo, bị bỏ', r.ok && r.warnings.length === 2 && !('extra' in r.doc) && !('foo' in r.doc.hero), r.warnings);

    d = clone(seed); d.sections[0].days[0].items[0].tone = 'pink';
    ok('home-schema: tone lạ bị báo', has(HS.validate(d), 'sections[0].days[0].items[0].tone'));
    d = clone(seed); d.sections[2].items[0].featured = 'x'; d.sections[2].items[1].featured = 'maybe';
    r = HS.validate(d);
    ok('home-schema: boolean "x" ⇒ true, "maybe" ⇒ lỗi', r.doc.sections[2].items[0].featured === true && has(r, 'sections[2].items[1].featured'), r.errors);
    d = clone(seed); d.sections[0].days[0].items[0].time = 530; d.hero.title = { a: 1 };
    r = HS.validate(d);
    ok('home-schema: số ⇒ chuỗi; object ở field chuỗi ⇒ lỗi', r.doc.sections[0].days[0].items[0].time === '530' && has(r, 'hero.title', /chuỗi/), r.errors);
    d = clone(seed); d.sections = Array.from({ length: 13 }, (_, i) => HS.blankSection('notes', 'n' + i));
    ok('home-schema: quá 12 mục bị báo', has(HS.validate(d), 'sections', /12/));
    d = clone(seed); d.footer.text = '  a\r\nb  ';
    ok('home-schema: trim + chuẩn hoá xuống dòng', HS.normalize(d).footer.text === 'a\nb');
    d = clone(seed); d.sections[3].contacts = 'abc';
    ok('home-schema: danh sách sai kiểu bị báo', has(HS.validate(d), 'sections[3].contacts', /danh sách/));
    d = clone(seed);
    d.sections[0].days = Array(14).fill(Object.assign(clone(seed.sections[0].days[0]), { items: Array(40).fill(Object.assign(clone(seed.sections[0].days[0].items[0]), { desc: 'z'.repeat(1000) })) }));
    ok('home-schema: doc lớn trong giới hạn vẫn hợp lệ', HS.validate(d).ok, HS.validate(d).errors.slice(0, 3));

    const p = 'sections[2].items[0].colors[1].hex';
    ok('home-schema: parsePath', JSON.stringify(HS.parsePath(p)) === JSON.stringify(['sections', 2, 'items', 0, 'colors', 1, 'hex']));
    d = clone(seed); HS.setPath(d, p, '#000000');
    ok('home-schema: getPath / setPath', HS.getPath(d, p) === '#000000' && HS.getPath(d, 'sections[9].x') === undefined);
    ok('home-schema: uniqueId', HS.uniqueId('notes', ['notes', 'notes-2']) === 'notes-3' && HS.uniqueId('text', []) === 'text');
    ok('home-schema: blank / blankSection đúng khung', (() => { const s = HS.blankSection('transport', 'tp'); return s.id === 'tp' && Array.isArray(s.contacts) && s.contactsBadge === '' && HS.blank('color').hex === '#FFFFFF' && HS.blank('dress').featured === false && Array.isArray(HS.blank('day').items); })());
    ok('home-schema: khuôn trống của mọi type đều hợp lệ', HS.validate({ sections: Object.keys(HS.TYPES).map(x => HS.blankSection(x, x)) }).ok);
    ok('home-schema: EVENT_ID_RE = quy tắc ?e= (theme.js)', HS.EVENT_ID_RE.source === '^[a-z0-9][a-z0-9-]{0,99}$'
      && (!t.exists('fe/js/config/theme.js') || t.read('fe/js/config/theme.js').includes('/^[a-z0-9][a-z0-9-]{0,99}$/')));
  },
};
