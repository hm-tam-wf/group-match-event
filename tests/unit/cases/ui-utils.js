'use strict';
// ui-utils.js: esc / initial / firstName / validName chịu được kiểu lạ (số, object, null) và giới hạn NAME_MAX_LEN.
const vm = require('vm');

module.exports = {
  async run(t) {
    const { ok } = t;
    const ctx = vm.createContext({ MODE_FIREBASE: 'firebase', MODE_SHEET: 'sheet', MODE_DEMO: 'demo', SCRIPT_URL: '', window: {}, document: { getElementById: () => null }, FIELDS: [], TEXT: {} });
    new vm.Script(t.read('fe/js/ui/ui-utils.js') + '\n;globalThis.__u = { esc, initial, firstName, validName, NAME_MAX_LEN };').runInContext(ctx);
    const u = ctx.__u;
    ok('esc(số) không ném lỗi', u.esc(5) === '5', u.esc(5));
    ok('esc(object) không ném lỗi', u.esc({}) === '[object Object]');
    ok('esc(null/undefined/0/false) = "" như cũ', [null, undefined, 0, false, ''].every(v => u.esc(v) === ''));
    ok('esc vẫn escape HTML', u.esc('<b a="1">&') === '&lt;b a=&quot;1&quot;&gt;&amp;');
    ok('initial(số/null/khoảng trắng)', u.initial(5) === '5' && u.initial(null) === '?' && u.initial('   ') === '?' && u.initial('nam') === 'N');
    ok('firstName(chuỗi/số/null)', u.firstName('Nguyễn Văn A') === 'A' && u.firstName(7) === '7' && u.firstName(null) === '');
    const vn = [['Ab', true], ['A', false], ['123', false], ['a'.repeat(u.NAME_MAX_LEN), true], ['a'.repeat(u.NAME_MAX_LEN + 1), false],
      ['A/B', false], ['__abc__', false], ['Nguyễn Văn A', true], ['  Lê  ', true], ['Lê_Văn', true]];
    const bad = vn.filter(([v, want]) => u.validName(v) !== want);
    ok(`validName ${vn.length} ca (≤${u.NAME_MAX_LEN} ký tự, chặn "/" và "__x__")`, bad.length === 0, bad);
  },
};
