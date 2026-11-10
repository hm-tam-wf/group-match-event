'use strict';
// Hồ sơ sự kiện (bước 2): theme.js → config.js → themes/tech/strings.js → variants/tnt/strings.js → profile.js (→ ui-utils.js
// cho brandLogoHtml) nạp NGUYÊN VĂN, mỗi file một script trong CÙNG context. Mỗi "trang" = 1 context mới (= 1 lần tải trang);
// localStorage truyền qua các lần tải để kiểm cache vẽ đầu. Thiếu js/config/profile.js (repo cũ) ⇒ bỏ qua cả file.
const vm = require('vm');
const PAGE = ['fe/js/config/theme.js', 'fe/js/config/config.js', 'fe/themes/tech/strings.js', 'fe/themes/tech/variants/tnt/strings.js', 'fe/js/config/profile.js'];

function makeStorage(store) {
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
function makeDocument(eventPage) {
  const attrs = eventPage ? { 'data-event-page': '' } : {};
  const styleProps = {};
  return {
    documentElement: {
      lang: '', attrs, styleProps,
      setAttribute(k, v) { attrs[k] = String(v); }, removeAttribute(k) { delete attrs[k]; },
      hasAttribute(k) { return k in attrs; }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
      style: { setProperty(k, v) { styleProps[k] = v; }, removeProperty(k) { delete styleProps[k]; }, getPropertyValue(k) { return styleProps[k] || ''; } },
    },
    getElementById() { return null; }, querySelector() { return null; },
  };
}

module.exports = {
  async run(t) {
    const { ok } = t;
    if (!t.exists('fe/js/config/profile.js')) { ok('profile.js chưa có trong repo này — bỏ qua', true); return; }
    // search = '?e=…&lang=…'; store = localStorage dùng chung giữa các lần tải; onlyTheme = trang chỉ nạp theme.js (travel.html).
    const openPage = ({ search = '', store = {}, eventPage = true, withUtils = false, onlyTheme = false } = {}) => {
      const warns = [];
      const ctx = vm.createContext({
        console: { log() {}, warn: (...a) => warns.push(a.join(' ')), error() {} },
        location: { search, hostname: 'example.test', href: 'https://example.test/index.html' + search, origin: 'https://example.test' },
        localStorage: makeStorage(store), document: makeDocument(eventPage), URLSearchParams, URL,
        MODE_FIREBASE: 'firebase', MODE_SHEET: 'sheet', MODE_DEMO: 'demo', FIREBASE_ON: false,
      });
      ctx.window = ctx;
      t.runScripts(ctx, onlyTheme ? PAGE.slice(0, 1) : PAGE.concat(withUtils ? ['fe/js/ui/ui-utils.js'] : []));
      return { run: code => vm.runInContext(code, ctx), warns, root: ctx.document.documentElement };
    };
    const J = v => JSON.parse(JSON.stringify(v === undefined ? null : v));

    // ── 1) Không có hồ sơ (sự kiện cũ) = y như trước: tnt + tiếng Việt + FARADAY + home cũ ──
    {
      const p = openPage();
      ok('mặc định: variant tnt (DEFAULT_VARIANT) + data-variant=tnt', p.run('ACTIVE_VARIANT') === 'tnt' && p.root.attrs['data-variant'] === 'tnt');
      ok('mặc định: LANG vi (defaultLang của tnt), <html lang=vi>', p.run('LANG') === 'vi' && p.root.lang === 'vi');
      ok('mặc định: chữ TNT phủ lên (celebrate.ok, tech.appTitle)', p.run('TEXT.celebrate.ok') === 'Lên Đồ Đi Mini Outing Thôi!' && /TNT/.test(p.run('TEXT.tech.appTitle')));
      ok('mặc định: hàm TNT vẫn là hàm (confirm.title)', p.run('TEXT.confirm.title("101")') === 'Chốt kèo Roommate phòng 101?');
      ok('mặc định: BRAND = DEFAULT_BRAND, không data-brand', p.run('BRAND === DEFAULT_BRAND') === true && !('data-brand' in p.root.attrs));
      ok('mặc định: HOME_URL null (hành vi cũ), không ghi đè --boot-hold-ms', p.run('HOME_URL') === null && !('--boot-hold-ms' in p.root.styleProps));
      ok('STRINGS gốc KHÔNG bị chữ TNT ghi đè', p.run('STRINGS.vi.celebrate.ok') === 'Sẵn sàng rồi!' && p.run('VARIANT_COPY.tnt.vi.celebrate.ok') === 'Lên Đồ Đi Mini Outing Thôi!');
      ok('TNT (vi) vẫn có toast.liveLost/liveBack + toast.already của TNT', typeof p.run('TEXT.toast.liveLost') === 'string'
        && typeof p.run('TEXT.toast.liveBack') === 'string' && /không thể quay đầu/.test(p.run('TEXT.toast.already')));
    }
    // ── 2) Biến thể / ngôn ngữ ──
    {
      const p = openPage();
      let r = J(p.run('applyEventProfile({ variant: "" })'));
      ok('variant "" ⇒ theme gốc, gỡ data-variant, LANG = DEFAULT_LANG (en)', r.variant === '' && !('data-variant' in p.root.attrs) && r.lang === 'en');
      ok('variant "" ⇒ chữ gốc EN (không còn chữ TNT)', p.run('TEXT.celebrate.ok') === "Let's go!" && !/TNT/.test(p.run('TEXT.tech.appTitle')));
      r = J(p.run('applyEventProfile({ variant: "", lang: "vi" })'));
      ok('variant "" + lang vi ⇒ chữ gốc VI', r.lang === 'vi' && p.run('TEXT.celebrate.ok') === 'Sẵn sàng rồi!');
      r = J(p.run('applyEventProfile({ variant: "khong-co" })'));
      ok('variant lạ ⇒ theme gốc', r.variant === '' && !('data-variant' in p.root.attrs));
      r = J(p.run('applyEventProfile({ variant: "tnt", lang: "en" })'));
      ok('tnt + lang en ⇒ EN (tnt chỉ có chữ VI) nhưng giữ data-variant tnt', r.variant === 'tnt' && r.lang === 'en' && p.root.attrs['data-variant'] === 'tnt' && p.run('TEXT.celebrate.ok') === "Let's go!");
      r = J(p.run('applyEventProfile(undefined)'));
      ok('áp lại hồ sơ rỗng ⇒ về đúng mặc định (không dính hồ sơ trước)', r.variant === 'tnt' && r.lang === 'vi' && p.run('TEXT.celebrate.ok') === 'Lên Đồ Đi Mini Outing Thôi!');
    }
    {
      const p = openPage({ search: '?lang=en' });
      ok('?lang=en thắng defaultLang của tnt', p.run('LANG') === 'en' && J(p.run('applyEventProfile({ lang: "vi" })')).lang === 'en');
    }
    {
      const p = openPage({ search: '?variant=' });
      const r = J(p.run('applyEventProfile({ variant: "tnt" })'));
      ok('?variant= (rỗng) ép tắt biến thể dù hồ sơ chọn tnt', r.variant === '' && !('data-variant' in p.root.attrs));
    }
    // ── 3) Câu chữ (profile.copy) ──
    {
      const p = openPage();
      p.run('applyEventProfile({ copy: { vi: { "banner.sub": "Đã chốt!", "tech.terminalLine2": "Chào {0}!", "khong.ton.tai": "x", "celebrate.ok": 5 } } })');
      ok('copy: ghi đè chuỗi thường', p.run('TEXT.banner.sub') === 'Đã chốt!');
      ok('copy: key gốc là HÀM ⇒ vẫn là hàm, {0} = tham số', p.run('TEXT.tech.terminalLine2("Bạn")') === 'Chào Bạn!');
      ok('copy: key không tồn tại bị bỏ qua (có cảnh báo), không tạo namespace rác', p.run('typeof TEXT.khong') === 'undefined' && p.warns.some(w => /khong\.ton\.tai/.test(w)));
      ok('copy: giá trị không phải chuỗi bị bỏ qua (giữ chữ TNT)', p.run('TEXT.celebrate.ok') === 'Lên Đồ Đi Mini Outing Thôi!');
      ok('copy: STRINGS gốc + VARIANT_COPY không bị sửa', p.run('STRINGS.vi.banner.sub') !== 'Đã chốt!' && p.run('VARIANT_COPY.tnt.vi.banner.sub') === 'Đã chốt cạ cứng — không thể quay đầu.');
      p.run('applyEventProfile({})');
      ok('copy: áp hồ sơ khác ⇒ chữ ghi đè biến mất', p.run('TEXT.banner.sub') === 'Đã chốt cạ cứng — không thể quay đầu.');
      p.run('applyEventProfile({ variant: "", copy: { en: { "validate.name": "Bad name" } } })');
      ok('copy: đường dẫn 2 cấp (validate.name) ở EN', p.run('TEXT.validate.name') === 'Bad name');
    }
    // ── 4) Logo (profile.brand) ──
    {
      const p = openPage({ withUtils: true });
      let html = p.run('brandLogoHtml()');
      ok('brand mặc định: markup FARADAY + LOGO.png', /class="tech-logo-only"/.test(html) && /FARADAY/.test(html) && /themes\/tech\/img\/LOGO\.png/.test(html));
      p.run('applyEventProfile({ brand: { name: "ACME <b>", logoUrl: "javascript:alert(1)" } })');
      html = p.run('brandLogoHtml("margin-top: 10px;")');
      ok('brand tuỳ chỉnh: data-brand=custom, chặn javascript:, escape tên', p.root.attrs['data-brand'] === 'custom' && !/<img/.test(html) && /ACME &lt;b&gt;/.test(html) && /style="margin-top: 10px;"/.test(html));
      p.run('applyEventProfile({ brand: { name: "", logoUrl: "" } })');
      ok('brand rỗng ⇒ ẩn khối logo', p.run('brandLogoHtml()') === '' && p.root.attrs['data-brand'] === 'custom');
      p.run('applyEventProfile({ brand: { name: "X".repeat(60), logoUrl: "img/a.png" } })');
      ok('brand: tên cắt ≤40, logo tương đối hợp lệ', p.run('BRAND.name.length') === 40 && p.run('BRAND.logoUrl') === 'img/a.png');
      p.run('applyEventProfile({})');
      ok('bỏ brand ⇒ về DEFAULT_BRAND, gỡ data-brand', p.run('BRAND === DEFAULT_BRAND') === true && !('data-brand' in p.root.attrs));
    }
    // ── 5) Trang home + intro ──
    {
      const p = openPage();
      const home = v => J(p.run(`applyEventProfile(${JSON.stringify(v)})`)).homeUrl;
      ok('homeUrl "" ⇒ không có home', home({ homeUrl: '' }) === '');
      ok('homeUrl tương đối giữ nguyên', home({ homeUrl: 'home.html?e=tnt' }) === 'home.html?e=tnt');
      ok('homeUrl https giữ nguyên', home({ homeUrl: 'https://ok.example/x' }) === 'https://ok.example/x');
      ok('homeUrl //domain-khác, javascript:, data: ⇒ ""', home({ homeUrl: '//evil.example' }) === '' && home({ homeUrl: 'javascript:alert(1)' }) === '' && home({ homeUrl: 'data:text/html,x' }) === '');
      ok('thiếu homeUrl ⇒ null (hành vi cũ)', home({}) === null);
      p.run('applyEventProfile({ introMs: 7000 })');
      ok('introMs 7000 ⇒ --boot-hold-ms 7000', p.root.styleProps['--boot-hold-ms'] === '7000');
      p.run('applyEventProfile({ introMs: 999999 })');
      ok('introMs vượt trần ⇒ 15000', p.root.styleProps['--boot-hold-ms'] === '15000');
      p.run('applyEventProfile({ introMs: "abc" })');
      ok('introMs sai kiểu ⇒ bỏ ghi đè', !('--boot-hold-ms' in p.root.styleProps));
    }
    // ── 6) ?e= + cache hồ sơ cho lần vẽ đầu ──
    {
      ok('?e=event-demo hợp lệ', J(openPage({ search: '?e=event-demo' }).run('eventIdFromUrl()')).id === 'event-demo');
      const u = J(openPage({ search: '?e=Event_Demo' }).run('eventIdFromUrl()'));
      ok('?e= sai định dạng ⇒ given true, id ""', u.given === true && u.id === '');
      ok('không có ?e= ⇒ given false', J(openPage().run('eventIdFromUrl()')).given === false);
      const store = {};
      openPage({ search: '?e=su-kien-a', store }).run('cacheEventProfile({ variant: "", lang: "en", brand: { name: "ACME", logoUrl: "" } })');
      const again = openPage({ search: '?e=su-kien-a', store });
      ok('lần tải sau: theme.js vẽ đầu theo hồ sơ đã lưu (không data-variant, có data-brand)', !('data-variant' in again.root.attrs) && again.root.attrs['data-brand'] === 'custom');
      ok('lần tải sau: profile.js áp hồ sơ đã lưu ngay lúc nạp (LANG en, BRAND ACME)', again.run('LANG') === 'en' && again.run('BRAND.name') === 'ACME');
      const other = openPage({ search: '?e=su-kien-b', store });
      ok('cache tách theo sự kiện: sự kiện khác vẫn mặc định tnt', other.root.attrs['data-variant'] === 'tnt' && other.run('LANG') === 'vi');
      const travel = openPage({ search: '?e=su-kien-a', store, eventPage: false, onlyTheme: true });
      ok('trang KHÔNG có data-event-page (travel.html) bỏ qua cache ⇒ tnt', travel.root.attrs['data-variant'] === 'tnt' && !('data-brand' in travel.root.attrs));
    }
  },
};
