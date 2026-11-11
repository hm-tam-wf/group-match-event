'use strict';
// UsageCore (fe/js/admin/usage-core.js — logic thẻ "Mức dùng Firestore" của admin): mốc ngày quota theo giờ Pacific (kể cả ngày
// đổi giờ 23h/25h), URL timeSeries.list, cộng / gom điểm theo ngày, chi phí phần vượt quota, ghi đè cấu hình, phân loại lỗi API Google.
const path = require('path');

module.exports = {
  async run(t) {
    const { ok } = t;
    if (!t.exists('fe/js/admin/usage-core.js')) { ok('usage-core.js chưa có trong repo này — bỏ qua', true); return; }
    const U = require(path.join(t.REPO, 'fe/js/admin/usage-core.js'));
    const cfg = U.mergeConfig({});
    const LA = cfg.quotaTimeZone, H = 3600e3, at = s => Date.parse(s);

    // 1) Mốc ngày quota
    const now = at('2026-11-11T04:32:00Z');                                  // = 10/11 20:32 giờ Pacific (PST, UTC−8)
    ok('usage dayStart: 00:00 PST = 08:00Z', U.dayStart(LA, now) === at('2026-11-10T08:00:00Z'));
    ok('usage dayStart: đúng tại chính nửa đêm, 1ms trước thuộc ngày trước',
      U.dayStart(LA, at('2026-11-10T08:00:00Z')) === at('2026-11-10T08:00:00Z') && U.dayStart(LA, at('2026-11-10T07:59:59.999Z')) === at('2026-11-09T08:00:00Z'));
    const spring = U.dayStart(LA, at('2026-03-08T20:00:00Z'));
    ok('usage: ngày đổi giờ mùa hè 8/3/2026 bắt đầu 08:00Z, dài 23 giờ', spring === at('2026-03-08T08:00:00Z') && U.nextDayStart(LA, spring) - spring === 23 * H);
    const fall = U.dayStart(LA, at('2026-11-01T20:00:00Z'));
    ok('usage: ngày đổi giờ mùa đông 1/11/2026 bắt đầu 07:00Z, dài 25 giờ', fall === at('2026-11-01T07:00:00Z') && U.nextDayStart(LA, fall) - fall === 25 * H);
    ok('usage: prevDayStart qua ngày 25 giờ', U.prevDayStart(LA, at('2026-11-02T08:00:00Z')) === at('2026-11-01T07:00:00Z'));
    ok('usage dayKey theo giờ Pacific (không theo giờ máy)', U.dayKey(LA, now) === '2026-11-10');

    // 2) Khoảng hỏi số liệu
    const w = U.windows(now, cfg);
    ok('usage windows: reset = 00:00 PST hôm sau (= 15:00 giờ VN)', w.resetAt === at('2026-11-11T08:00:00Z') && w.todayStart === at('2026-11-10T08:00:00Z'));
    ok('usage windows: 7 ngày đã qua, cũ → mới, không gồm hôm nay',
      JSON.stringify(w.days) === JSON.stringify(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']) && w.todayKey === '2026-11-10', w.days);
    ok('usage windows: lịch sử [00:00 PST 7 ngày trước, đầu hôm nay)', w.histStart === at('2026-11-03T08:00:00Z') && w.histEnd === w.todayStart);
    const w2 = U.windows(at('2026-11-04T12:00:00Z'), cfg);
    ok('usage windows: vắt qua ngày đổi giờ vẫn đúng mốc 00:00 (PDT 07:00Z → PST 08:00Z)',
      w2.histStart === at('2026-10-28T07:00:00Z') && w2.histEnd === at('2026-11-04T08:00:00Z') && w2.days[0] === '2026-10-28' && w2.days[6] === '2026-11-03', w2);
    ok('usage windows: historyDays 0 ⇒ chỉ hôm nay', U.windows(now, U.mergeConfig({ historyDays: 0 })).days.length === 0);

    // 3) URL Cloud Monitoring / Billing
    const u = new URL(U.seriesUrl(cfg, 'icon-picker', 'reads', w.todayStart, now, (now - w.todayStart) / 1000));
    const p = k => u.searchParams.get(k);
    ok('usage seriesUrl: endpoint timeSeries của project', u.origin + u.pathname === 'https://monitoring.googleapis.com/v3/projects/icon-picker/timeSeries');
    ok('usage seriesUrl: metric đọc, ALIGN_SUM + REDUCE_SUM, 1 bucket phủ trọn hôm nay',
      p('filter') === 'metric.type = "firestore.googleapis.com/document/read_count"' && p('aggregation.perSeriesAligner') === 'ALIGN_SUM'
      && p('aggregation.crossSeriesReducer') === 'REDUCE_SUM' && p('aggregation.alignmentPeriod') === '73920s'
      && p('interval.startTime') === '2026-11-10T08:00:00.000Z' && p('interval.endTime') === '2026-11-11T04:32:00.000Z', u.search);
    ok('usage seriesUrl: bucket tối thiểu 60s; metric ghi/xoá đúng tên',
      new URL(U.seriesUrl(cfg, 'p', 'writes', 0, 1000, 1)).searchParams.get('aggregation.alignmentPeriod') === '60s'
      && /write_count/.test(new URL(U.seriesUrl(cfg, 'p', 'writes', 0, 1, 60)).searchParams.get('filter'))
      && /delete_count/.test(new URL(U.seriesUrl(cfg, 'p', 'deletes', 0, 1, 60)).searchParams.get('filter')));
    ok('usage billingUrl', U.billingUrl(cfg, 'icon-picker') === 'https://cloudbilling.googleapis.com/v1/projects/icon-picker/billingInfo');

    // 4) Cộng / gom điểm
    const pt = (end, v, key = 'int64Value') => ({ interval: { startTime: new Date(at(end) - H).toISOString(), endTime: end }, value: { [key]: v } });
    ok('usage sumPoints: rỗng / null = 0', U.sumPoints({}) === 0 && U.sumPoints(null) === 0 && U.sumPoints({ timeSeries: [] }) === 0);
    ok('usage sumPoints: cộng mọi series + điểm (int64 dạng chuỗi, double)',
      U.sumPoints({ timeSeries: [{ points: [pt('2026-11-10T09:00:00Z', '120'), pt('2026-11-10T10:00:00Z', '5')] }, { points: [pt('2026-11-10T09:00:00Z', 2.5, 'doubleValue')] }] }) === 127.5);
    const pd = U.perDay({ timeSeries: [{ points: [pt('2026-11-10T08:00:00Z', '10'), pt('2026-11-10T09:00:00Z', '7'), pt('2026-11-09T08:00:00Z', '3'), { value: { int64Value: '9' } }] }] }, LA);
    ok('usage perDay: bucket kết thúc đúng 00:00 PST thuộc ngày trước; điểm thiếu thời gian bị bỏ',
      pd['2026-11-09'] === 10 && pd['2026-11-10'] === 7 && pd['2026-11-08'] === 3 && Object.keys(pd).length === 3, pd);

    // 5) Chi phí, ngưỡng, cấu hình
    ok('usage costUsd: trong quota = $0', U.costUsd({ reads: 50000, writes: 20000, deletes: 0 }, cfg).usd === 0);
    const c = U.costUsd({ reads: 150000, writes: 30000, deletes: 20001 }, cfg);
    ok('usage costUsd: chỉ phần vượt quota × giá / 100k', Math.abs(c.usd - (0.06 + 0.1 * 0.18 + 0.00001 * 0.02)) < 1e-12
      && c.excess.reads === 100000 && c.excess.writes === 10000 && c.excess.deletes === 1, c);
    const cfg2 = U.mergeConfig({ pricePer100k: { reads: 0.03 }, freeQuota: { reads: 1000 }, oauthClientId: 'x', historyDays: undefined });
    ok('usage mergeConfig: ghi đè từng khoá con, giữ phần còn lại, nhận khoá mới', cfg2.pricePer100k.reads === 0.03 && cfg2.pricePer100k.writes === 0.18
      && cfg2.freeQuota.reads === 1000 && cfg2.freeQuota.writes === 20000 && cfg2.oauthClientId === 'x' && cfg2.historyDays === 7);
    ok('usage mergeConfig: không làm bẩn DEFAULTS / cấu hình khác', U.DEFAULTS.pricePer100k.reads === 0.06 && U.DEFAULTS.freeQuota.reads === 50000 && cfg.pricePer100k.reads === 0.06);
    ok('usage levelOf: 70% vàng · 90% đỏ · >100% vượt', [0.69, 0.7, 0.9, 1, 1.0001].map(r => U.levelOf(r, cfg)).join() === 'ok,warn,danger,danger,over');
    ok('usage fill: thay + encode biến trong mẫu URL', U.fill(cfg.apiLibraryUrl, { service: 'monitoring.googleapis.com', projectId: 'a b' })
      === 'https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=a%20b');

    // 6) Mô hình hiển thị
    const s = U.summarize({ cfg, win: w, today: { reads: 1234, writes: 56, deletes: 0 }, history: { reads: { '2026-11-09': 40000 }, writes: {}, deletes: {} }, billing: { billingEnabled: false } });
    ok('usage summarize: gói Spark khi billingEnabled=false', s.plan === 'spark');
    ok('usage summarize: 3 thanh quota hôm nay', s.meters.map(m => `${m.kind}:${m.used}/${m.free}:${m.level}`).join() === 'reads:1234/50000:ok,writes:56/20000:ok,deletes:0/20000:ok', s.meters);
    ok('usage summarize: 7 ngày + hôm nay ở cuối; ngày thiếu số = 0', s.days.length === 8 && s.days[7].today && s.days[7].reads === 1234
      && s.days[6].reads === 40000 && s.days[0].reads === 0 && s.maxReads === 40000 && s.resetAt === w.resetAt);
    const s2 = U.summarize({ cfg, win: w, today: { reads: 150000 }, history: { reads: { '2026-11-09': 60000 } }, billing: { billingEnabled: true } });
    ok('usage summarize: Blaze + chi phí hôm nay / cả kỳ (chỉ phần vượt)', s2.plan === 'blaze' && Math.abs(s2.cost.today - 0.06) < 1e-12
      && Math.abs(s2.cost.period - (0.06 + 0.006)) < 1e-12 && s2.meters[0].level === 'over' && s2.meters[0].over === 100000, s2.cost);
    ok('usage summarize: không có billing ⇒ gói chưa rõ', U.summarize({ cfg, win: w, billing: null }).plan === 'unknown'
      && U.summarize({ cfg, win: w, billing: {} }).plan === 'unknown');

    // 7) Lỗi API Google
    const disabled = { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Cloud Monitoring API has not been used in project 1 before or it is disabled.',
      details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED',
        metadata: { service: 'monitoring.googleapis.com', serviceTitle: 'Cloud Monitoring API', activationUrl: 'https://console.developers.google.com/apis/api/monitoring.googleapis.com/overview?project=1' } }] } };
    const e1 = U.classifyError(403, disabled);
    ok('usage classifyError: API chưa bật + link bật + tên dịch vụ', e1.kind === 'disabled' && e1.service === 'monitoring.googleapis.com'
      && e1.serviceTitle === 'Cloud Monitoring API' && e1.activationUrl.startsWith('https://console.developers.google.com/'), e1);
    ok('usage classifyError: thiếu quyền IAM', U.classifyError(403, { error: { status: 'PERMISSION_DENIED', message: 'Permission monitoring.timeSeries.list denied (or the resource may not exist).' } }).kind === 'perm');
    ok('usage classifyError: project chưa bật billing (tách khỏi thiếu quyền)',
      U.classifyError(403, { error: { status: 'PERMISSION_DENIED', details: [{ reason: 'BILLING_DISABLED' }] } }).kind === 'billing'
      && U.classifyError(403, { error: { status: 'PERMISSION_DENIED', message: 'This method requires billing to be enabled.' } }).kind === 'billing');
    ok('usage classifyError: token hết hạn / sai', U.classifyError(401, { error: { status: 'UNAUTHENTICATED' } }).kind === 'auth');
    ok('usage classifyError: thiếu scope', U.classifyError(403, { error: { status: 'PERMISSION_DENIED', details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }).kind === 'scope');
    ok('usage classifyError: 429 / 400 / body rỗng', U.classifyError(429, {}).kind === 'rate' && U.classifyError(400, { error: { status: 'INVALID_ARGUMENT' } }).kind === 'bad'
      && U.classifyError(500, null).kind === 'other');
    ok('usage classifyError: link kích hoạt lạ bị bỏ (chỉ nhận console Google)',
      U.classifyError(403, { error: { details: [{ reason: 'SERVICE_DISABLED', metadata: { activationUrl: 'https://evil.example/x' } }] } }).activationUrl === ''
      && U.safeConsoleUrl('https://console.cloud.google.com/x"onmouseover=1') === '');

    // 8) Định dạng
    ok('usage fmtDuration', U.fmtDuration(3 * H + 12 * 60e3) === '3 giờ 12 phút' && U.fmtDuration(2 * H) === '2 giờ'
      && U.fmtDuration(45 * 60e3) === '45 phút' && U.fmtDuration(20e3) === 'dưới 1 phút' && U.fmtDuration(-5) === 'dưới 1 phút');
    ok('usage niceCeil', [7, 10, 11, 23, 48000, 55000, 0, 0.3].map(U.niceCeil).join() === '10,10,20,25,50000,100000,1,0.5', [7, 10, 11, 23, 48000, 55000, 0, 0.3].map(U.niceCeil));
  }
};
