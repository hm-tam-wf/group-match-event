'use strict';
// app.js armCloseTimer: closeAt xa > 24,8 ngày KHÔNG được hiện "đã kết thúc" ngay (setTimeout tràn int32).
const vm = require('vm');
const DAY = 864e5;
const INT32_MAX = 2147483647;

module.exports = {
  async run(t) {
    const { ok, sleep } = t;
    const app = t.read('fe/js/app.js');
    const m = /const MAX_TIMER_MS[\s\S]*?\nfunction armCloseTimer\(\) \{[\s\S]*?\n\}\n/.exec(app);
    ok('trích được armCloseTimer từ app.js', !!m);
    if (!m) return;
    // a) closeAt + 30 ngày: code CŨ (setTimeout thẳng) chạy NGAY (Node cũng tràn int32 → 1ms, như trình duyệt) ⇒ tái hiện bug.
    let oldFired = false; const t0 = setTimeout(() => { oldFired = true; }, 30 * DAY + 250); await sleep(60); clearTimeout(t0);
    ok('tái hiện bug cũ: setTimeout(30 ngày) chạy gần như ngay', oldFired === true);
    // b) code MỚI với timer thật: không gọi showClosedScreen trong 60ms, hẹn chặng = MAX_TIMER_MS
    const ctx = { CLOSE_AT: Date.now() + 30 * DAY, _closeTimer: null, closed: 0, setTimeout, clearTimeout, Date, Math, delays: [] };
    vm.createContext(ctx);
    new vm.Script('function showClosedScreen(){ closed++; }\nconst _st = setTimeout; setTimeout = (f, d) => { delays.push(d); return _st(f, d); };\n' + m[0] + '\narmCloseTimer();').runInContext(ctx);
    await sleep(60);
    ok('closeAt +30 ngày: không hiện màn kết thúc, hẹn chặng MAX', ctx.closed === 0 && ctx.delays[0] === INT32_MAX, { closed: ctx.closed, delays: ctx.delays });
    clearTimeout(ctx._closeTimer);
    // c) closeAt gần: hẹn left+250; d) đã qua: hiện ngay
    ctx.CLOSE_AT = Date.now() + 1000; ctx.delays.length = 0; vm.runInContext('armCloseTimer();', ctx);
    ok('closeAt +1s: hẹn ~1250ms', ctx.delays[0] > 1150 && ctx.delays[0] <= 1250, ctx.delays);
    clearTimeout(ctx._closeTimer);
    ctx.CLOSE_AT = Date.now() - 1; ctx.delays.length = 0; vm.runInContext('armCloseTimer();', ctx);
    ok('closeAt đã qua: hiện màn kết thúc ngay', ctx.closed === 1 && ctx.delays.length === 0, { closed: ctx.closed });
  },
};
