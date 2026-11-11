'use strict';
// Thẻ "Mức dùng Firestore" (tab Tổng quan, fe/js/admin/usage-panel.js) với Google GIẢ — không gọi mạng thật:
// mở trang KHÔNG tải script Google; chưa có Client ID ⇒ hướng dẫn bật; có Client ID ⇒ nút Kết nối, script Google chỉ tải khi rê chuột
// vào nút; token giả + fetch giả (Cloud Monitoring / Billing) ⇒ 3 thanh quota, 8 cột, Spark = 0 ₫, bảng số liệu, tooltip + phím mũi tên;
// Blaze + vượt quota ⇒ "Vượt quota" + chi phí ước tính; lỗi API chưa bật / thiếu quyền ⇒ hướng xử lý kèm link; đóng popup ⇒ quay lại;
// bỏ quyền billing ⇒ gói chưa rõ; nút "Tải lại" chung khi token hết hạn KHÔNG bật popup; Ngắt kết nối ⇒ thu hồi token; 390px không tràn.
const fs = require('fs');
const path = require('path');
const C = require('../../lib/config');

const CLIENT = 'test-client.apps.googleusercontent.com';
const MON = 'https://www.googleapis.com/auth/monitoring.read';
const BILL = 'https://www.googleapis.com/auth/cloud-billing.readonly';
const MOUNT = cfg => `(() => { UsagePanel.mount(document.getElementById('usageMount'), { projectId: 'icon-picker', config: ${JSON.stringify(cfg)} }); return 1; })()`;

// Google Identity Services + fetch giả. window.__mon = số liệu trả về (fail = body lỗi); window.__gisMode = ok | closed | nobilling.
// Lịch sử: mỗi giờ 1 điểm (100 đọc / 10 ghi / 1 xoá) ⇒ mỗi ngày quota = 100 × số giờ của ngày (23/24/25 tuỳ ngày đổi giờ).
const STUBS = `(() => {
  window.__gis = { calls: [], cfgs: [], revoked: '' };
  window.__gisMode = 'ok';
  window.google = { accounts: { oauth2: {
    initTokenClient(cfg) { window.__gis.cfgs.push(cfg); return { requestAccessToken() {
      window.__gis.calls.push(cfg.scope);
      const mode = window.__gisMode;
      setTimeout(() => {
        if (mode === 'closed') cfg.error_callback({ type: 'popup_closed', message: 'closed' });
        else cfg.callback({ access_token: 'tok-123', expires_in: 3599, token_type: 'Bearer',
          scope: mode === 'nobilling' ? cfg.scope.split(' ').filter(s => !/billing/.test(s)).join(' ') : cfg.scope });
      }, 30);
    } }; },
    hasGrantedAllScopes(resp, ...s) { return s.every(x => (' ' + resp.scope + ' ').includes(' ' + x + ' ')); },
    revoke(tok, cb) { window.__gis.revoked = tok; if (cb) cb(); }
  } } };
  window.__fetchLog = [];
  window.__mon = { mode: 'spark', reads: 1234, writes: 56, deletes: 0, fail: null };
  window.fetch = async (url, init) => {
    window.__fetchLog.push({ url: String(url), auth: init && init.headers && init.headers.Authorization });
    const u = new URL(url), M = window.__mon, res = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (M.fail) return res(M.fail.code || 403, M.fail);
    if (u.hostname === 'cloudbilling.googleapis.com') return res(200, { billingEnabled: M.mode === 'blaze' });
    const f = u.searchParams.get('filter'), kind = /read_count/.test(f) ? 'reads' : /write_count/.test(f) ? 'writes' : 'deletes';
    const start = Date.parse(u.searchParams.get('interval.startTime')), end = Date.parse(u.searchParams.get('interval.endTime'));
    if (end - start > 26 * 3600e3) {
      const per = { reads: 100, writes: 10, deletes: 1 }[kind], points = [];
      for (let t = end; t > start; t -= 3600e3) points.push({ interval: { startTime: new Date(t - 3600e3).toISOString(), endTime: new Date(t).toISOString() }, value: { int64Value: String(per) } });
      return res(200, { timeSeries: [{ metric: { type: 'x' }, resource: { type: 'firestore_instance' }, points }] });
    }
    return res(200, M[kind] ? { timeSeries: [{ points: [{ interval: { startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() },
      value: { int64Value: String(M[kind]) } }] }] } : { unit: '1' });
  };
  return 1;
})()`;

module.exports = {
  async run(t) {
    const { waitFor, ok, sleep, page } = t;
    // Lỗi khi đánh giá trong trang ('EVAL-EXC …') ⇒ dừng case kèm thông báo gốc (thay vì TypeError khó hiểu ở dòng sau).
    const ev = async expr => { const r = await t.ev(expr); if (typeof r === 'string' && /^EVAL-(EXC|ERR)/.test(r)) throw new Error('đánh giá trong trang lỗi: ' + r.slice(0, 600)); return r; };
    const shotDir = path.join(C.OUT, 'admin-shots');
    const shot = async name => {
      if (!C.SHOTS) return;
      fs.mkdirSync(shotDir, { recursive: true });
      await sleep(350);
      const el = await page.$('#usageMount');
      if (el) await el.screenshot({ path: path.join(shotDir, 'usage-' + name + '.png') });
    };
    const card = expr => ev(`(() => { const c = document.querySelector('#usageMount'); return ${expr}; })()`);
    const click = sel => ev(`(() => { const b = document.querySelector('#usageMount ${sel}'); if (!b) return 'missing'; b.click(); return 1; })()`);
    // Chữ hiển thị trên thẻ không dùng dấu "·" (user yêu cầu 2026-11-11): gom mọi trạng thái đi qua, kiểm 1 lần ở U14
    const dotHits = [];
    const noDot = async label => {
      const s = await card(`c.innerText + ' ' + ((c.querySelector('.us-tip:not([hidden])') || {}).textContent || '')`);
      const m = /.{0,30}·.{0,30}/.exec(s);
      if (m) dotHits.push(label + ': ' + m[0]);
    };

    await t.navigate(t.url());
    await waitFor(`!!document.querySelector('#usageMount .us-card') && !!document.querySelector('#dashGrid .card')`, 10000);

    // U0 — tự gắn ở tab Tổng quan; mở trang KHÔNG tải script Google (đã cấu hình hay chưa)
    const u0 = await ev(`(() => { const id = String((window.ADMIN_USAGE_CONFIG || {}).oauthClientId || '').trim(), c = document.querySelector('#usageMount');
      return { id: !!id, setup: /Chưa bật/.test(c.textContent), connect: !!c.querySelector('[data-us="connect"]'),
        gis: !!document.querySelector('script[data-us-gis], script[src*="accounts.google.com"]') }; })()`);
    ok('U0 thẻ Mức dùng Firestore tự gắn ở tab Tổng quan; mở trang không tải script Google',
      !u0.gis && (u0.id ? u0.connect && !u0.setup : u0.setup && !u0.connect), u0);

    // U1 — chưa có Client ID ⇒ "Chưa bật" + link hướng dẫn + Usage and billing đúng project (tab mới), không có nút Kết nối
    await ev(MOUNT({ oauthClientId: '' }));
    const u1 = await card(`({ txt: c.textContent, doc: !!c.querySelector('a[href$="documentation/USAGE-MONITORING.md"][target="_blank"][rel~="noopener"]'),
      usage: !!c.querySelector('a[href="https://console.firebase.google.com/project/icon-picker/usage"]'), connect: !!c.querySelector('[data-us="connect"]') })`);
    ok('U1 chưa có Client ID ⇒ "Chưa bật", link hướng dẫn + Usage and billing (tab mới), không có nút Kết nối',
      /Chưa bật/.test(u1.txt) && /usage-config\.js/.test(u1.txt) && u1.doc && u1.usage && !u1.connect, u1);
    await shot('1-chua-bat');
    await noDot('U1 chưa bật');

    // U2 — có Client ID, chưa có Google: rê chuột vào nút ⇒ tải script (src từ cấu hình); script không có GIS ⇒ báo lỗi + Thử lại
    await ev(`delete window.google; window.__gisLoaded = 0; 1`);
    await ev(MOUNT({ oauthClientId: CLIENT, gisSrc: 'data:text/javascript,window.__gisLoaded%3D1' }));
    const u2a = await card(`({ btn: (c.querySelector('[data-us="connect"]') || {}).textContent, txt: c.textContent, gis: !!document.querySelector('script[data-us-gis]') })`);
    await noDot('U2 nút Kết nối');
    await ev(`document.querySelector('#usageMount [data-us="connect"]').dispatchEvent(new PointerEvent('pointerover', { bubbles: true })), 1`);
    const loaded = await waitFor(`window.__gisLoaded === 1`, 3000);
    ok('U2 có Client ID ⇒ nút "Kết nối Google", nêu chỉ xin quyền đọc; script Google chỉ tải khi rê chuột vào nút',
      u2a.btn === 'Kết nối Google' && /quyền đọc/.test(u2a.txt) && /icon-picker/.test(u2a.txt) && !u2a.gis && loaded, u2a);
    await click('[data-us="connect"]');
    await waitFor(`!!document.querySelector('#usageMount .us-empty.is-err')`, 3000);
    const u2b = await card(`({ txt: c.textContent, retry: !!c.querySelector('[data-us="retry"]'), role: c.querySelector('.us-empty.is-err').getAttribute('role') })`);
    ok('U2 tải script nhưng không có Google Identity Services ⇒ báo lỗi (role=alert) + nút Thử lại',
      /Không tải được Google Identity Services/.test(u2b.txt) && u2b.retry && u2b.role === 'alert', u2b);
    await noDot('U2 lỗi tải Google');

    // U3 — Google + Cloud Monitoring giả ⇒ Thử lại: 1 lần xin token (2 quyền ĐỌC), 7 request kèm Bearer, số liệu gói Spark
    await ev(STUBS);
    await click('[data-us="retry"]');
    await waitFor(`document.querySelectorAll('#usageMount .us-m').length === 3 && document.querySelectorAll('#usageMount .us-col').length === 8`, 5000);
    const u3 = await ev(`(() => { const c = document.querySelector('#usageMount'), q = s => [...c.querySelectorAll(s)], L = window.__fetchLog;
      return { calls: window.__gis.calls, id: window.__gis.cfgs[0].client_id, prompt: window.__gis.cfgs[0].prompt,
        n: L.length, bearer: L.every(x => x.auth === 'Bearer tok-123'), hist: L.filter(x => /alignmentPeriod=3600s/.test(x.url)).length,
        bill: L.filter(x => /cloudbilling\\.googleapis\\.com\\/v1\\/projects\\/icon-picker\\/billingInfo$/.test(x.url)).length,
        mon: L.filter(x => x.url.startsWith('https://monitoring.googleapis.com/v3/projects/icon-picker/timeSeries?')).length,
        meters: q('.us-m').map(m => m.dataset.kind + ':' + m.dataset.level + ':' + m.querySelector('.us-m-v').textContent.replace(/\\s+/g, ' ').trim()),
        plan: (c.querySelector('.us-plan') || {}).textContent, cost: (c.querySelector('.us-cost') || {}).textContent,
        cols: q('.us-col').map(x => x.getAttribute('aria-label')), xlast: q('.us-col-x').pop().textContent,
        rows: q('.us-table tbody tr').map(r => r.cells[0].textContent + '|' + r.cells[1].textContent),
        note: (c.querySelector('.us-chart-note') || {}).textContent || '', ql: !!c.querySelector('.us-ql'),
        reset: (c.querySelector('[data-us-countdown]') || {}).textContent || '',
        store: JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)) }; })()`);
    ok('U3 xin token 1 lần: đúng Client ID, prompt rỗng, scope = monitoring.read + cloud-billing.readonly',
      u3.calls.length === 1 && u3.calls[0] === MON + ' ' + BILL && u3.id === CLIENT && u3.prompt === '', { calls: u3.calls, id: u3.id });
    ok('U3 7 request (3 hôm nay + 3 lịch sử bucket 1 giờ + 1 billing), đúng endpoint project, tất cả kèm Bearer token',
      u3.n === 7 && u3.mon === 6 && u3.hist === 3 && u3.bill === 1 && u3.bearer, { n: u3.n, mon: u3.mon, hist: u3.hist, bill: u3.bill });
    ok('U3 3 thanh quota hôm nay: đọc 1.234/50.000, ghi 56/20.000, xoá 0/20.000 (mức bình thường)',
      JSON.stringify(u3.meters) === JSON.stringify(['reads:ok:1.234 / 50.000', 'writes:ok:56 / 20.000', 'deletes:ok:0 / 20.000']), u3.meters);
    ok('U3 gói Spark ⇒ "Chi phí: 0 ₫" (vượt quota bị chặn, không tính tiền)', u3.plan === 'Gói Spark (miễn phí)' && /Chi phí: 0 ₫/.test(u3.cost), { plan: u3.plan, cost: u3.cost });
    ok('U3 biểu đồ 8 cột: 7 ngày quota (100 đọc × số giờ của ngày) + Hôm nay 1.234',
      u3.cols.length === 8 && /^Hôm nay \(đến giờ\): 1\.234 lượt đọc, 56 ghi, 0 xoá$/.test(u3.cols[7]) && u3.xlast === 'Hôm nay'
      && u3.cols.slice(0, 7).every(a => /^(CN|T[2-7]) \d\d\/\d\d: 2\.[345]00 lượt đọc, 2[345]0 ghi, 2[345] xoá$/.test(a)), u3.cols);
    ok('U3 dùng ít so với quota ⇒ không vẽ vạch quota, có câu "Cao nhất … = 5% quota miễn phí"',
      !u3.ql && /^Cao nhất 2\.[345]00 lượt\/ngày = 5% quota miễn phí\.$/.test(u3.note), u3.note);
    ok('U3 bảng số liệu: 8 dòng, mới nhất trước', u3.rows.length === 8 && u3.rows[0] === 'Hôm nay (đến giờ)|1.234', u3.rows);
    ok('U3 có đếm ngược tới giờ reset quota', /^(\d+ giờ( \d+ phút)?|\d+ phút|dưới 1 phút)$/.test(u3.reset), u3.reset);
    ok('U3 token chỉ ở bộ nhớ (không localStorage / sessionStorage)', !u3.store.includes('tok-123'));
    await shot('2-spark');
    await noDot('U3 Spark');

    // U4 — tooltip + bàn phím: focus cột hôm nay ⇒ tooltip; ← sang cột trước (roving tabindex, 1 điểm dừng Tab)
    await ev(`document.querySelector('#usageMount .us-col.is-today').focus(), 1`);
    const tip1 = await card(`({ shown: !c.querySelector('.us-tip').hidden, txt: c.querySelector('.us-tip').textContent, tab: [...c.querySelectorAll('.us-col')].map(x => x.tabIndex).join('') })`);
    await ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })), 1`);
    const tip2 = await card(`({ i: document.activeElement.dataset.i, tab: [...c.querySelectorAll('.us-col')].map(x => x.tabIndex).join(''), txt: c.querySelector('.us-tip').textContent })`);
    await noDot('U4 tooltip');
    ok('U4 focus cột hôm nay ⇒ tooltip (đọc + ghi/xoá); 1 điểm dừng Tab; ← sang cột trước',
      tip1.shown && tip1.txt === 'Hôm nay (đến giờ)1.234 lượt đọc56 ghi, 0 xoá' && tip1.tab === '-1-1-1-1-1-1-10'
      && tip2.i === '6' && tip2.tab === '-1-1-1-1-1-10-1' && /2\.[345]00 lượt đọc/.test(tip2.txt), { tip1, tip2 });

    // U5 — Blaze + vượt quota ⇒ "Vượt quota" (đỏ + chữ), vạch quota, chi phí ước tính chỉ phần vượt; làm mới không xin token lại
    await ev(`window.__mon = { mode: 'blaze', reads: 150000, writes: 30000, deletes: 0 }; 1`);
    await click('[data-us="refresh"]');
    await waitFor(`(document.querySelector('#usageMount .us-plan') || {}).textContent === 'Gói Blaze (trả theo mức dùng)' && !document.querySelector('#usageMount [aria-busy]')`, 5000);
    const u5 = await card(`({ meters: [...c.querySelectorAll('.us-m')].map(m => m.dataset.level + ':' + m.querySelector('.us-m-foot').textContent),
      cost: c.querySelector('.us-cost').textContent, ql: !!c.querySelector('.us-ql'), calls: window.__gis.calls.length, n: window.__fetchLog.length,
      w: parseFloat(c.querySelector('.us-m[data-kind="reads"] .us-m-bar > span').style.width) })`);
    ok('U5 Blaze: đọc 150.000 & ghi 30.000 ⇒ "Vượt quota 100.000 / 10.000", thanh dừng ở 100%',
      /^over:300% quota ngày.*Vượt quota 100\.000$/.test(u5.meters[0]) && /^over:150% quota ngày.*Vượt quota 10\.000$/.test(u5.meters[1])
      && /^ok:/.test(u5.meters[2]) && u5.w === 100, u5.meters);
    ok('U5 Blaze: ước tính hôm nay ≈ $0.08 (chỉ phần vượt), vạch quota hiện, làm mới không xin token lại',
      /hôm nay ≈ \$0\.08, cả 8 ngày ≈ \$0\.08/.test(u5.cost) && u5.ql && u5.calls === 1 && u5.n === 14, u5);
    await shot('3-blaze-vuot');
    await noDot('U5 Blaze');

    // U6 — lỗi khi đã có số cũ (API chưa bật) ⇒ dải cảnh báo role=alert + link bật API (chỉ console Google), vẫn giữ số cũ
    await ev(`window.__mon.fail = { code: 403, error: { code: 403, status: 'PERMISSION_DENIED', message: 'Cloud Monitoring API has not been used in project 1 before or it is disabled.',
      details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', metadata: { service: 'monitoring.googleapis.com',
      serviceTitle: 'Cloud Monitoring API', activationUrl: 'https://console.developers.google.com/apis/api/monitoring.googleapis.com/overview?project=1' } }] } }; 1`);
    await click('[data-us="refresh"]');
    await waitFor(`!!document.querySelector('#usageMount .us-alert')`, 5000);
    const u6 = await card(`({ txt: c.querySelector('.us-alert').textContent, href: (c.querySelector('.us-alert a') || {}).href || '',
      meters: c.querySelectorAll('.us-m').length, role: c.querySelector('.us-alert').getAttribute('role') })`);
    ok('U6 API chưa bật (đã có số cũ) ⇒ dải cảnh báo + link "Bật Cloud Monitoring API", giữ số cũ',
      /Cloud Monitoring API chưa bật cho project/.test(u6.txt) && /Bật Cloud Monitoring API/.test(u6.txt)
      && u6.href.startsWith('https://console.developers.google.com/apis/api/monitoring.googleapis.com/') && u6.meters === 3 && u6.role === 'alert', u6);
    await shot('4-loi-api');
    await noDot('U6 cảnh báo giữ số cũ');

    // U7 — thiếu quyền IAM, chưa có số ⇒ thông báo + gợi ý vai trò + link IAM đúng project + Thử lại
    await ev(`window.__mon.fail = { code: 403, error: { code: 403, status: 'PERMISSION_DENIED', message: 'Permission monitoring.timeSeries.list denied (or the resource may not exist).' } }; 1`);
    await ev(MOUNT({ oauthClientId: CLIENT }));
    await click('[data-us="connect"]');
    await waitFor(`!!document.querySelector('#usageMount .us-empty.is-err')`, 5000);
    const u7 = await card(`({ txt: c.textContent, iam: !!c.querySelector('a[href="https://console.cloud.google.com/iam-admin/iam?project=icon-picker"]'), retry: !!c.querySelector('[data-us="retry"]') })`);
    ok('U7 thiếu quyền ⇒ "không có quyền đọc số liệu", gợi ý Monitoring Viewer + link IAM của project, nút Thử lại',
      /không có quyền đọc số liệu/.test(u7.txt) && /Monitoring Viewer/.test(u7.txt) && u7.iam && u7.retry, u7);
    await noDot('U7 thiếu quyền');

    // U8 — đóng popup Google ⇒ về nút Kết nối dùng lại được + ghi chú (không kẹt "Đang chờ Google…")
    await ev(`window.__mon.fail = null; window.__gisMode = 'closed'; 1`);
    await ev(MOUNT({ oauthClientId: CLIENT }));
    await click('[data-us="connect"]');
    await waitFor(`/Đã đóng cửa sổ Google/.test((document.querySelector('#usageMount .us-note') || {}).textContent || '')`, 3000);
    const u8 = await card(`({ btn: c.querySelector('[data-us="connect"]').textContent, dis: c.querySelector('[data-us="connect"]').disabled })`);
    ok('U8 đóng popup ⇒ ghi chú "Đã đóng cửa sổ Google" + nút Kết nối dùng lại được', u8.btn === 'Kết nối Google' && !u8.dis, u8);

    // U9 — bỏ tick quyền billing ⇒ không gọi Cloud Billing, "Gói chưa rõ", chi phí nêu cả 2 khả năng
    await ev(`window.__gisMode = 'nobilling'; window.__mon = { mode: 'spark', reads: 10, writes: 1, deletes: 0 }; window.__fetchLog = []; 1`);
    await click('[data-us="connect"]');
    await waitFor(`!!document.querySelector('#usageMount .us-plan')`, 5000);
    const u9 = await card(`({ plan: c.querySelector('.us-plan').textContent, cost: c.querySelector('.us-cost').textContent,
      bill: window.__fetchLog.filter(x => /cloudbilling/.test(x.url)).length, n: window.__fetchLog.length })`);
    ok('U9 không cấp quyền billing ⇒ 6 request (không Cloud Billing), "Gói chưa rõ", chi phí: Spark 0 ₫ / Blaze ước tính',
      u9.plan === 'Gói chưa rõ' && u9.bill === 0 && u9.n === 6 && /gói Spark thì 0 ₫; gói Blaze thì hôm nay ≈ \$0/.test(u9.cost)
      && /chưa cấp quyền xem billing/.test(u9.cost), u9);
    await noDot('U9 gói chưa rõ');

    // U10 — token hết hạn + nút "Tải lại" chung của trang ⇒ KHÔNG bật popup, giữ số cũ + ghi chú + nút "Kết nối Google lại"
    const callsBefore = await ev(`window.__gis.calls.length`);
    await ev(`window.__realNow = Date.now; Date.now = () => window.__realNow.call(Date) + 2 * 3600e3; 1`);
    await ev(`document.getElementById('btnRefresh').click(), 1`);
    await sleep(300);
    const u10 = await card(`({ calls: window.__gis.calls.length, note: (c.querySelector('.us-note') || {}).textContent || '',
      relog: !!c.querySelector('.us-foot [data-us="connect"]'), meters: c.querySelectorAll('.us-m').length, disc: !!c.querySelector('[data-us="disconnect"]') })`);
    await ev(`Date.now = window.__realNow; 1`);
    ok('U10 token hết hạn + nút Tải lại chung ⇒ không bật popup, giữ số cũ, ghi chú hết hạn + nút "Kết nối Google lại"',
      u10.calls === callsBefore && /Phiên Google đã hết hạn/.test(u10.note) && u10.relog && u10.meters === 3 && !u10.disc, u10);
    await noDot('U10 phiên hết hạn');

    // U11 — kết nối lại rồi "Ngắt kết nối Google" ⇒ thu hồi token, xoá số liệu, về nút Kết nối
    await ev(`window.__gisMode = 'ok'; 1`);
    await click('.us-foot [data-us="connect"]');
    await waitFor(`!!document.querySelector('#usageMount [data-us="disconnect"]')`, 5000);
    await click('[data-us="disconnect"]');
    const u11 = await card(`({ revoked: window.__gis.revoked, btn: !!c.querySelector('[data-us="connect"]'), note: (c.querySelector('.us-note') || {}).textContent || '', m: c.querySelectorAll('.us-m').length })`);
    ok('U11 Ngắt kết nối ⇒ revoke token qua Google, xoá số liệu, về nút Kết nối', u11.revoked === 'tok-123' && u11.btn && u11.m === 0 && /Đã ngắt kết nối/.test(u11.note), u11);

    // U12 — màn hình 390px: thẻ có số liệu không tràn ngang (biểu đồ, bảng, chân thẻ)
    await ev(`window.__mon = { mode: 'spark', reads: 41000, writes: 15000, deletes: 120 }; 1`);
    await click('[data-us="connect"]');
    await waitFor(`document.querySelectorAll('#usageMount .us-col').length === 8`, 5000);
    await page.setViewport({ width: 390, height: 900 });
    await sleep(400);
    const u12 = await card(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, card: c.scrollWidth - c.clientWidth,
      levels: [...c.querySelectorAll('.us-m')].map(m => m.dataset.level).join(), ql: !!c.querySelector('.us-ql') })`);
    ok('U12 390px: thẻ không tràn ngang; 41.000 đọc = vàng "Sắp hết" (≥70%), 15.000 ghi = vàng; vạch quota hiện',
      u12.doc <= u12.vw && u12.card <= 0 && u12.levels === 'warn,warn,ok' && u12.ql, u12);
    await shot('5-mobile');
    await noDot('U12 390px');
    await page.setViewport({ width: 1440, height: 900 });

    ok('U14 chữ hiển thị trên thẻ không dùng dấu "·" (mọi trạng thái đã đi qua)', dotHits.length === 0, dotHits);
    ok('U13 không có exception JS', t.errs.length === 0, t.errs);
  }
};
