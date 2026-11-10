'use strict';
// api.js: _teamFromDoc / _teamsFromSnap + apiSubscribe (lỗi listener → onError + nối lại backoff 2s→…→30s).
const vm = require('vm');

module.exports = {
  async run(t) {
    const { ok } = t;
    const api = t.read('fe/js/data/api.js');
    const a = /function _teamFromDoc[\s\S]*?\nfunction _teamsFromSnap[^\n]*\n/.exec(api);
    const b = /const SUB_RETRY_BASE_MS[\s\S]*?\nfunction apiSubscribe[\s\S]*?\n\}\n/.exec(api);
    ok('trích được _teamFromDoc + apiSubscribe', !!(a && b));
    if (!(a && b)) return;
    const subs = []; const delays = []; const timers = [];
    const ctx = vm.createContext({ MODE: 'firebase', MODE_FIREBASE: 'firebase', COL: { TEAMS: 'teams' }, Number, Array, Math,
      col: () => ({ onSnapshot: (next, err) => { const s = { next, err, unsub: 0 }; subs.push(s); return () => { s.unsub++; }; } }),
      setTimeout: (f, d) => { delays.push(d); timers.push(f); return timers.length; }, clearTimeout: id => { timers[id - 1] = null; } });
    new vm.Script(a[0] + b[0] + '\n;globalThis.__a = { apiSubscribe };').runInContext(ctx);
    const got = []; const errs = [];
    const stop = ctx.__a.apiSubscribe((teams, meta) => got.push({ teams, meta }), e => errs.push(e));
    const doc = (id, data) => ({ id, data: () => data });
    const snap = (docs, fromCache) => ({ metadata: { fromCache }, forEach: fn => docs.forEach(fn) });
    subs[0].next(snap([doc('🌸', { icon: '🌸', count: 2, names: ['A', 5, null, 'B'] }), doc('🌸~', { icon: '🌸', count: 9, names: ['X'] }), doc('🐬', { icon: '🐬', count: 'x', names: 'Z' })], false));
    const tm = got[0] && got[0].teams;
    ok('names lọc phần tử không phải chuỗi', tm && JSON.stringify(tm['🌸']) === JSON.stringify({ count: 2, names: ['A', 'B'] }), tm && tm['🌸']);
    ok('khoá theo doc id: doc lạ khai icon 🌸 không đè đội 🌸', tm && tm['🌸'].count === 2 && tm['🌸~'] && tm['🌸~'].count === 9);
    ok('count/names sai kiểu ⇒ 0 / []', tm && tm['🐬'].count === 0 && Array.isArray(tm['🐬'].names) && tm['🐬'].names.length === 0, tm && tm['🐬']);
    ok('meta.fromCache=false', got[0].meta && got[0].meta.fromCache === false);
    subs[0].err({ code: 'resource-exhausted' });
    ok('lỗi listener ⇒ onError + hẹn nối lại 2s', errs.length === 1 && delays[0] === 2000, { errs: errs.length, delays });
    timers[0](); subs[1].err({ code: 'unavailable' }); timers[1](); subs[2].err({ code: 'unavailable' });
    ok('backoff tăng 2s→4s→8s', JSON.stringify(delays) === JSON.stringify([2000, 4000, 8000]), delays);
    for (let i = 0; i < 6; i++) { timers[timers.length - 1](); subs[subs.length - 1].err({ code: 'unavailable' }); }
    ok('backoff chặn trần 30s', delays[delays.length - 1] === 30000, delays);
    timers[timers.length - 1](); subs[subs.length - 1].next(snap([], true));
    ok('nối lại thành công ⇒ nhận snapshot (fromCache truyền qua)', got.length === 2 && got[1].meta.fromCache === true);
    subs[subs.length - 1].err({ code: 'unavailable' });
    ok('sau khi hồi phục, lỗi kế tiếp backoff lại từ 2s', delays[delays.length - 1] === 2000, delays.slice(-2));
    const nSubs = subs.length; stop(); const pending = timers[timers.length - 1]; if (pending) pending();
    ok('huỷ đăng ký ⇒ không nối lại nữa', subs.length === nSubs);
  },
};
