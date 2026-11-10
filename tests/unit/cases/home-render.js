'use strict';
// HomeRender (fe/js/home/home-render.js) + HomeStrings: chuỗi en/vi cùng bộ key, dựng trang từ seed (đủ mục, CTA),
// mục rỗng bị ẩn (kèm nút "xem lịch trình"), escape, đoán màu nhãn như travel.js. (Lọc HTML cần DOM ⇒ kiểm ở e2e b98.)
const path = require('path'), vm = require('vm');

module.exports = {
  async run(t) {
    const { ok } = t;
    if (!t.exists('fe/js/home/home-render.js')) { ok('home-render.js chưa có trong repo này — bỏ qua', true); return; }
    const HS = require(path.join(t.REPO, 'fe/js/home/home-schema.js'));
    const HR = require(path.join(t.REPO, 'fe/js/home/home-render.js'));
    const ctx = vm.createContext({});
    t.runScripts(ctx, ['fe/js/home/home-strings.js']);
    const STR = ctx.HomeStrings;
    const shape = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? shape(v, p + k + '.')
      : [p + k + ':' + typeof v + (Array.isArray(v) ? v.length : '')])).sort().join(',');
    ok('home-render: HomeStrings en/vi cùng bộ key + kiểu', STR && shape(STR.vi) === shape(STR.en), STR && { vi: shape(STR.vi), en: shape(STR.en) });

    const seed = JSON.parse(t.read('backend/seed/home-tnt.json'));
    const out = HR.build(HS.normalize(seed), { S: STR.vi, ctaHref: 'index.html?e=x', cfgTitle: '' });
    ok('home-render: seed ⇒ 4 mục, 4 tab, CTA đúng link, nút "xem lịch trình"', out.count === 4 && (out.nav.match(/nav-anchor-tab/g) || []).length === 4
      && out.hero.includes('href="index.html?e=x"') && out.hero.includes('id="btnCtaSchedule"'), out.count);
    const empty = HR.build(HS.normalize({ sections: [{ id: 'a', type: 'notes', title: 'x' }, { id: 'b', type: 'timeline', title: 'y' }] }), { S: STR.en, ctaHref: 'i', cfgTitle: 'T' });
    ok('home-render: mục rỗng bị ẩn, không nút lịch trình, H1 lấy meta/config.title', empty.count === 0 && !empty.hero.includes('btnCtaSchedule') && empty.hero.includes('<h1>T</h1>'), empty);
    const xss = HR.build(HS.normalize({ hero: { title: '<img src=x onerror=alert(1)>' }, sections: [{ id: 'n', type: 'notes', title: '"><b>', items: [{ title: '<script>', desc: 'a\nb' }] }] }),
      { S: STR.vi, ctaHref: 'i', cfgTitle: '' });
    ok('home-render: mọi chuỗi được escape, xuống dòng ⇒ <br>', !/<img|<script|"><b>/.test(xss.hero + xss.sections) && xss.hero.includes('&lt;img') && xss.sections.includes('a<br>b'), xss.sections.slice(0, 300));
    ok('home-render: đoán màu nhãn như travel.js (+ tone tường minh thắng)', HR.toneOf({ tag: 'Ẩm thực' }) === 'food' && HR.toneOf({ tag: 'Lunch' }) === 'food'
      && HR.toneOf({ tag: 'Tự do' }) === '' && HR.toneOf({ tag: 'Tự do', tone: 'gala' }) === 'gala' && HR.toneOf({ tag: 'Tập trung' }) === 'move');
    ok('home-render: tel chỉ giữ số và +, màu sáng tự có viền', HR.telOf('0908 123 456') === '0908123456' && HR.telOf('+84 (90) 1') === '+84901'
      && HR.isLight('#FFFFFF') && HR.isLight('#fff') && !HR.isLight('#FFE17D') && !HR.isLight('#15458E'));
  },
};
