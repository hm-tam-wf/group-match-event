/* UsageCore — logic THUẦN của thẻ "Mức dùng Firestore" (tab Tổng quan của admin): không DOM, không mạng ⇒ test được trong Node.
 * Số liệu thật do usage-panel.js lấy từ Cloud Monitoring API (metric firestore.googleapis.com/document/{read,write,delete}_count);
 * file này chỉ: tính mốc NGÀY QUOTA (Firestore reset free quota quanh 00:00 giờ Pacific, kể cả ngày đổi giờ mùa hè/đông),
 * dựng URL timeSeries.list, cộng / gom điểm số liệu theo ngày, ước tính chi phí phần vượt quota, phân loại lỗi API Google.
 * UMD: trình duyệt → window.UsageCore · Node → module.exports. Cấu hình ghi đè: js/admin/usage-config.js. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UsageCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KINDS = ["reads", "writes", "deletes"];
  var H = 3600 * 1000;

  // Mặc định — mọi khoá ghi đè được qua window.ADMIN_USAGE_CONFIG (object lồng nhau ghi đè TỪNG khoá con).
  var DEFAULTS = {
    quotaTimeZone: "America/Los_Angeles",          // free quota Firestore reset quanh 00:00 giờ Pacific
    historyDays: 7,                                 // số ngày quota ĐÃ QUA trên biểu đồ (cộng thêm cột hôm nay)
    metricTypes: {
      reads: "firestore.googleapis.com/document/read_count",
      writes: "firestore.googleapis.com/document/write_count",
      deletes: "firestore.googleapis.com/document/delete_count"
    },
    freeQuota: { reads: 50000, writes: 20000, deletes: 20000 },     // mỗi ngày, cho database miễn phí duy nhất của project
    // USD / 100.000 thao tác — mức TRẦN phổ biến của Firestore, CHƯA xác minh cho vùng của database (xem usage-config.js)
    pricePer100k: { reads: 0.06, writes: 0.18, deletes: 0.02 },
    warnAt: 0.7, dangerAt: 0.9,                     // ngưỡng màu thanh quota (tỉ lệ đã dùng / quota miễn phí)
    checkBilling: true,                             // hỏi Cloud Billing API project có bật billing (gói Blaze) không
    scopes: {
      monitoring: "https://www.googleapis.com/auth/monitoring.read",
      billing: "https://www.googleapis.com/auth/cloud-billing.readonly"
    },
    monitoringBase: "https://monitoring.googleapis.com/v3",
    billingBase: "https://cloudbilling.googleapis.com/v1",
    gisSrc: "https://accounts.google.com/gsi/client",
    consoleUsageUrl: "https://console.firebase.google.com/project/{projectId}/usage",
    iamUrl: "https://console.cloud.google.com/iam-admin/iam?project={projectId}",
    apiLibraryUrl: "https://console.cloud.google.com/apis/library/{service}?project={projectId}",
    pricingUrl: "https://cloud.google.com/firestore/pricing",
    setupDocUrl: "https://github.com/hm-tam-wf/group-match-event/blob/master/documentation/md/USAGE-MONITORING.md"
  };

  var isObj = function (v) { return !!v && typeof v === "object" && !Array.isArray(v); };
  function mergeConfig(user) {
    var out = {}, k;
    for (k in DEFAULTS) out[k] = isObj(DEFAULTS[k]) ? Object.assign({}, DEFAULTS[k]) : DEFAULTS[k];
    if (isObj(user)) for (k in user) {
      if (user[k] === undefined) continue;
      out[k] = isObj(out[k]) && isObj(user[k]) ? Object.assign(out[k], user[k]) : user[k];
    }
    return out;
  }
  // "{projectId}" / "{service}" trong mẫu URL cấu hình → giá trị đã encode.
  function fill(tpl, vars) {
    return String(tpl || "").replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? encodeURIComponent(vars[k]) : m; });
  }

  // ── Mốc thời gian theo múi giờ tz (Intl, không thư viện) ────────────────────────────────────────────────
  var fmts = {};
  function parts(tz, t, withTime) {
    var key = tz + (withTime ? "|t" : "|d");
    var f = fmts[key] || (fmts[key] = new Intl.DateTimeFormat("en-US", withTime
      ? { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }
      : { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
    var o = {};
    f.formatToParts(new Date(t)).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  // Độ lệch (ms) giờ tz so với UTC tại thời điểm t (Pacific: −8h mùa đông, −7h mùa hè).
  function tzOffsetMs(tz, t) {
    var p = parts(tz, t, true), h = +p.hour === 24 ? 0 : +p.hour;     // engine cũ có thể trả "24" lúc nửa đêm
    return Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
  }
  // 00:00 (giờ tz) của ngày chứa t → mốc UTC ms. Tính lại độ lệch tại kết quả ⇒ đúng cả ngày dài 23h / 25h.
  function dayStart(tz, t) {
    var p = parts(tz, t, false), guess = Date.UTC(+p.year, +p.month - 1, +p.day);
    return guess - tzOffsetMs(tz, guess - tzOffsetMs(tz, guess));
  }
  function nextDayStart(tz, start) { return dayStart(tz, start + 26 * H); }   // ngày dài nhất 25h ⇒ +26h chắc chắn sang ngày sau
  function prevDayStart(tz, start) { return dayStart(tz, start - H); }
  function dayKey(tz, t) { var p = parts(tz, t, false); return p.year + "-" + p.month + "-" + p.day; }

  // Các khoảng cần hỏi: hôm nay [todayStart, now) và historyDays ngày quota đã qua [histStart, todayStart).
  function windows(now, cfg) {
    var tz = cfg.quotaTimeZone, n = Math.max(0, Math.floor(+cfg.historyDays || 0));
    var todayStart = dayStart(tz, now), starts = [], s = todayStart;
    for (var i = 0; i < n; i++) { s = prevDayStart(tz, s); starts.unshift(s); }
    return {
      now: now, todayStart: todayStart, resetAt: nextDayStart(tz, todayStart),
      histStart: n ? starts[0] : todayStart, histEnd: todayStart,
      days: starts.map(function (x) { return dayKey(tz, x); }), todayKey: dayKey(tz, now)
    };
  }

  // ── Cloud Monitoring / Billing API ───────────────────────────────────────────────────────────────────────
  // Gộp mọi series (database/loại thao tác) thành 1 bằng REDUCE_SUM; mỗi bucket alignSec giây cộng bằng ALIGN_SUM.
  // Lịch sử dùng bucket 3600s: mốc 00:00 Pacific luôn là đầu giờ UTC ⇒ mỗi bucket nằm trọn trong 1 ngày quota.
  function seriesUrl(cfg, projectId, kind, startMs, endMs, alignSec) {
    var q = [
      ["filter", 'metric.type = "' + cfg.metricTypes[kind] + '"'],
      ["interval.startTime", new Date(startMs).toISOString()],
      ["interval.endTime", new Date(endMs).toISOString()],
      ["aggregation.alignmentPeriod", Math.max(60, Math.ceil(+alignSec || 0)) + "s"],
      ["aggregation.perSeriesAligner", "ALIGN_SUM"],
      ["aggregation.crossSeriesReducer", "REDUCE_SUM"]
    ];
    return cfg.monitoringBase + "/projects/" + encodeURIComponent(projectId) + "/timeSeries?" +
      q.map(function (p) { return encodeURIComponent(p[0]) + "=" + encodeURIComponent(p[1]); }).join("&");
  }
  function billingUrl(cfg, projectId) { return cfg.billingBase + "/projects/" + encodeURIComponent(projectId) + "/billingInfo"; }

  function pointValue(p) {
    var v = (p && p.value) || {}, n = Number(v.int64Value != null ? v.int64Value : v.doubleValue);
    return isFinite(n) ? n : 0;
  }
  function eachPoint(json, fn) {
    ((json && json.timeSeries) || []).forEach(function (s) { ((s && s.points) || []).forEach(fn); });
  }
  function sumPoints(json) { var t = 0; eachPoint(json, function (p) { t += pointValue(p); }); return t; }
  // Gom theo ngày quota: bucket thuộc ngày chứa khoảnh khắc CUỐI của nó (endTime − 1ms).
  function perDay(json, tz) {
    var out = {};
    eachPoint(json, function (p) {
      var end = Date.parse(p && p.interval && p.interval.endTime);
      if (!isFinite(end)) return;
      var k = dayKey(tz, end - 1);
      out[k] = (out[k] || 0) + pointValue(p);
    });
    return out;
  }

  // ── Quota / chi phí ──────────────────────────────────────────────────────────────────────────────────────
  // Blaze GIỮ free quota mỗi ngày, chỉ tính phần vượt; Spark không bao giờ tính tiền (vượt ⇒ bị chặn tới lúc reset).
  function costUsd(used, cfg) {
    var ex = {}, usd = 0;
    KINDS.forEach(function (k) {
      ex[k] = Math.max(0, (+(used && used[k]) || 0) - (+cfg.freeQuota[k] || 0));
      usd += ex[k] / 100000 * (+cfg.pricePer100k[k] || 0);
    });
    return { usd: usd, excess: ex };
  }
  function levelOf(ratio, cfg) {
    return ratio > 1 ? "over" : ratio >= cfg.dangerAt ? "danger" : ratio >= cfg.warnAt ? "warn" : "ok";
  }
  function planOf(billing) {
    return billing && typeof billing.billingEnabled === "boolean" ? (billing.billingEnabled ? "blaze" : "spark") : "unknown";
  }

  // Mô hình hiển thị: 3 thanh quota hôm nay + historyDays ngày + cột hôm nay (cuối) + chi phí kiểu Blaze.
  function summarize(o) {
    var cfg = o.cfg, w = o.win, today = o.today || {}, hist = o.history || {};
    var meters = KINDS.map(function (k) {
      var used = +today[k] || 0, free = +cfg.freeQuota[k] || 0, ratio = free ? used / free : 0;
      return { kind: k, used: used, free: free, ratio: ratio, left: Math.max(0, free - used), over: Math.max(0, used - free), level: levelOf(ratio, cfg) };
    });
    var days = w.days.map(function (key) {
      var d = { key: key, today: false };
      KINDS.forEach(function (k) { d[k] = +((hist[k] || {})[key]) || 0; });
      return d;
    });
    var td = { key: w.todayKey, today: true };
    KINDS.forEach(function (k) { td[k] = +today[k] || 0; });
    days.push(td);
    var cToday = costUsd(today, cfg).usd, cPeriod = 0;
    days.forEach(function (d) { cPeriod += costUsd(d, cfg).usd; });
    return {
      plan: planOf(o.billing), meters: meters, days: days, now: w.now, resetAt: w.resetAt,
      cost: { today: cToday, period: cPeriod },
      maxReads: days.reduce(function (m, d) { return Math.max(m, d.reads); }, 0)
    };
  }

  // ── Lỗi API Google → loại lỗi để panel hiện hướng xử lý ──────────────────────────────────────────────────
  // Link kích hoạt API trong lỗi chỉ được dùng nếu trỏ về console Google (dữ liệu từ mạng, không tin mù).
  function safeConsoleUrl(u) {
    return /^https:\/\/console\.(developers|cloud)\.google\.com\/[^\s"'<>]*$/.test(String(u || "")) ? String(u) : "";
  }
  function classifyError(status, body) {
    var e = (body && body.error) || {}, details = Array.isArray(e.details) ? e.details : [];
    var info = details.filter(function (d) { return d && d.reason; })[0] || {}, meta = info.metadata || {};
    var msg = String(e.message || ""), reason = String(info.reason || ""), gs = String(e.status || "");
    var out = { status: status, gstatus: gs, reason: reason, service: String(meta.service || ""),
      serviceTitle: String(meta.serviceTitle || ""), activationUrl: safeConsoleUrl(meta.activationUrl), message: msg };
    if (reason === "SERVICE_DISABLED" || /has not been used in project|it is disabled/i.test(msg)) out.kind = "disabled";
    // project chưa gắn billing (gói Spark) mà API đòi billing — tách khỏi "thiếu quyền" để không chỉ sai hướng sửa
    else if (reason === "BILLING_DISABLED" || /requires billing|billing (?:to be|must be) enabled|billing is disabled/i.test(msg)) out.kind = "billing";
    else if (status === 401 || gs === "UNAUTHENTICATED") out.kind = "auth";
    else if (reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || /insufficient authentication scopes/i.test(msg)) out.kind = "scope";
    else if (status === 403 || gs === "PERMISSION_DENIED") out.kind = "perm";
    else if (status === 429 || gs === "RESOURCE_EXHAUSTED") out.kind = "rate";
    else if (status === 400 || gs === "INVALID_ARGUMENT") out.kind = "bad";
    else out.kind = "other";
    return out;
  }

  // ── Định dạng ────────────────────────────────────────────────────────────────────────────────────────────
  function fmtDuration(ms) {
    var m = Math.floor(Math.max(0, ms) / 60000), h = Math.floor(m / 60);
    if (m < 1) return "dưới 1 phút";
    return h ? h + " giờ" + (m % 60 ? " " + (m % 60) + " phút" : "") : m + " phút";
  }
  // Làm tròn LÊN về 1 / 2 / 2,5 / 5 × 10^k (đỉnh trục y gọn).
  function niceCeil(x) {
    if (!(x > 0)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(x))), r = x / mag;
    var step = [1, 2, 2.5, 5, 10].filter(function (s) { return s >= r - 1e-9; })[0];
    return Math.round(step * mag * 1e6) / 1e6;
  }

  return {
    KINDS: KINDS, DEFAULTS: DEFAULTS, mergeConfig: mergeConfig, fill: fill,
    tzOffsetMs: tzOffsetMs, dayStart: dayStart, nextDayStart: nextDayStart, prevDayStart: prevDayStart, dayKey: dayKey, windows: windows,
    seriesUrl: seriesUrl, billingUrl: billingUrl, sumPoints: sumPoints, perDay: perDay,
    costUsd: costUsd, levelOf: levelOf, planOf: planOf, summarize: summarize,
    safeConsoleUrl: safeConsoleUrl, classifyError: classifyError, fmtDuration: fmtDuration, niceCeil: niceCeil
  };
});
