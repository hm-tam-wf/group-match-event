'use strict';
// i18n: STRINGS.en / STRINGS.vi cùng shape; biến thể TNT (vi) vẫn có toast.liveLost / liveBack.
// Nạp đúng thứ tự trang thật, MỖI FILE một script riêng trong CÙNG context (như các thẻ <script>):
//   theme.js → config.js → themes/tech/strings.js → variants/tnt/strings.js → js/config/profile.js (NẾU có — bước 2 thêm).
const vm = require('vm');
const ORDER = ['fe/js/config/theme.js', 'fe/js/config/config.js', 'fe/themes/tech/strings.js', 'fe/themes/tech/variants/tnt/strings.js'];
const OPTIONAL = ['fe/js/config/profile.js'];

module.exports = {
  async run(t) {
    const { ok } = t;
    const ctx = vm.createContext({
      URLSearchParams, console,
      location: { search: '', hostname: 'x' },
      localStorage: { getItem() { return null; }, setItem() {} },
      document: { documentElement: { lang: '', setAttribute() {}, getAttribute() { return null; } } },
    });
    t.runScripts(ctx, ORDER.slice(0, 1));
    // theme.js của repo cũ hơn chưa khai ACTIVE_VARIANT ⇒ mới stub; đã khai (const/let) thì KHÔNG stub (tránh khai trùng).
    if (vm.runInContext('typeof ACTIVE_VARIANT', ctx) === 'undefined') vm.runInContext('var ACTIVE_VARIANT = "tnt";', ctx);
    t.runScripts(ctx, ORDER.slice(1).concat(OPTIONAL.filter(t.exists)));
    vm.runInContext('globalThis.__s = { STRINGS, TEXT, LANG };', ctx);
    const S = ctx.__s;
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v)) ? flat(v, p + k + '.') : [p + k]);
    const en = flat(S.STRINGS.en).sort(), vi = flat(S.STRINGS.vi).sort();
    const onlyEn = en.filter(k => !vi.includes(k)), onlyVi = vi.filter(k => !en.includes(k));
    ok(`i18n parity en=${en.length} vi=${vi.length}`, onlyEn.length === 0 && onlyVi.length === 0, { onlyEn, onlyVi });
    ok('TNT (vi) vẫn có toast.liveLost/liveBack', S.LANG === 'vi' && typeof S.TEXT.toast.liveLost === 'string' && typeof S.TEXT.toast.liveBack === 'string',
      { LANG: S.LANG, toast: S.TEXT && S.TEXT.toast && Object.keys(S.TEXT.toast) });
  },
};
