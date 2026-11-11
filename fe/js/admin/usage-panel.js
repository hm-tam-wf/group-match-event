/* UsagePanel — thẻ "Mức dùng Firestore" ở tab Tổng quan của admin: lượt đọc / ghi / xoá THẬT của cả project (Cloud Monitoring)
 * so với free quota ngày, lịch sử theo ngày quota, gói Spark/Blaze (Cloud Billing) và chi phí ước tính.
 * Đăng nhập Google RIÊNG qua Google Identity Services (token model, CHỈ quyền đọc) — không đụng phiên Firebase Auth của admin.
 * Token chỉ nằm trong bộ nhớ tab (không localStorage / sessionStorage), hết hạn ~1 giờ; "Ngắt kết nối" thu hồi ngay.
 * Script Google chỉ tải khi người dùng có ý định kết nối (rê chuột / focus / bấm nút) ⇒ mở trang admin không gọi ra ngoài.
 * Cần: UsageCore (usage-core.js) · cấu hình window.ADMIN_USAGE_CONFIG (usage-config.js) · hướng dẫn: documentation/USAGE-MONITORING.md */
(function (root) {
  "use strict";
  var Core = root.UsageCore;
  if (!Core) return;

  var KLABEL = { reads: "Đọc", writes: "Ghi", deletes: "Xoá" };
  var KUNIT = { reads: "lượt đọc", writes: "lượt ghi", deletes: "lượt xoá" };
  var WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  var nf = new Intl.NumberFormat("vi-VN"), nf1 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
  var fmtN = function (n) { return nf.format(Math.round(+n || 0)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  function fmtCompact(n) {
    n = +n || 0;
    if (n < 1000) return fmtN(n);
    return n >= 1e6 ? nf1.format(n / 1e6) + "M" : nf1.format(n / 1e3) + "K";
  }
  function fmtPct(r) { return !(r > 0) ? "0%" : r < 0.01 ? "<1%" : nf.format(Math.round(r * 100)) + "%"; }
  function fmtUsd(v) { return !(v > 0) ? "$0" : v < 0.01 ? "< $0.01" : "$" + v.toFixed(2); }
  function fmtClock(t) { return new Date(t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); }
  function dayLabel(key) { var p = String(key).split("-"); return p[2] + "/" + p[1]; }
  function weekday(key) { var p = String(key).split("-"); return WD[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()]; }
  function dayName(d) { return d.today ? "Hôm nay (đến giờ)" : weekday(d.key) + " " + dayLabel(d.key); }

  var IC = {
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5v5h-5"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
  };

  var S = null;                                   // trạng thái của lần mount hiện tại (mount lại ⇒ object mới, callback cũ tự bỏ)
  var gisP = null;
  var api = { mount: mount, refresh: refresh, unmount: unmount };
  var EVENTS = [["click", onClick], ["pointerover", onIntent], ["touchstart", onIntent], ["focusin", onFocusIn],
    ["focusout", onFocusOut], ["pointermove", onMove], ["pointerleave", hideTip], ["keydown", onKey]];

  function mount(el, opts) {
    unmount();
    if (!el) return null;
    opts = opts || {};
    var cfg = Core.mergeConfig(opts.config || root.ADMIN_USAGE_CONFIG || {});
    S = { el: el, cfg: cfg, projectId: String(opts.projectId || "").trim(), fetch: opts.fetch || null,   // null ⇒ window.fetch lúc gọi
      phase: "", token: "", exp: 0, billingScope: false, data: null, err: null, billingErr: null, note: "", seq: 0, at: 0, tick: 0 };
    S.phase = S.projectId && String(cfg.oauthClientId || "").trim() ? "ready" : "unconfigured";
    el.innerHTML = '<section class="card us-card" aria-labelledby="usTitle">'
      + '<div class="card-head us-head"><div class="us-title"><h3 id="usTitle">Mức dùng Firestore</h3>'
      + '<span class="hint">Số liệu thật của cả project, lấy từ Cloud Monitoring</span></div><div class="us-head-r" data-us-slot="head"></div></div>'
      + '<div class="us-body" data-us-slot="body"></div><p class="sr-only" role="status" aria-live="polite" data-us-slot="live"></p></section>';
    EVENTS.forEach(function (x) { el.addEventListener(x[0], x[1], x[0] === "touchstart" ? { passive: true } : false); });
    S.tick = setInterval(tickCountdown, 30000);
    render();
    return api;
  }
  function unmount() {
    if (!S) return;
    clearInterval(S.tick);
    var el = S.el;
    EVENTS.forEach(function (x) { el.removeEventListener(x[0], x[1], false); });
    S = null;
  }

  // ── Sự kiện ────────────────────────────────────────────────────────────────────────────────────────────
  function onClick(e) {
    var b = S && e.target.closest ? e.target.closest("[data-us]") : null;
    if (!b || !S.el.contains(b) || b.disabled) return;
    var a = b.getAttribute("data-us");
    if (a === "connect") connect();
    else if (a === "refresh" || a === "retry") refresh();
    else if (a === "disconnect") disconnect();
  }
  // Có ý định kết nối ⇒ tải sẵn script Google để lúc bấm mở được popup ngay (popup phải mở trong cú bấm).
  function onIntent(e) {
    if (!S || S.phase === "unconfigured" || tokenValid() || !e.target.closest) return;
    if (e.target.closest('[data-us="connect"],[data-us="refresh"],[data-us="retry"]')) ensureGis().catch(function () {});
  }
  function colOf(t) { return t && t.closest ? t.closest(".us-col") : null; }
  function onFocusIn(e) { onIntent(e); var c = colOf(e.target); if (c) showTip(c); }
  function onFocusOut(e) { if (colOf(e.target)) hideTip(); }
  function onMove(e) { var c = colOf(e.target); if (c) showTip(c); else hideTip(); }
  // Biểu đồ: 1 điểm dừng Tab, mũi tên / Home / End đi giữa các cột (roving tabindex), Esc ẩn tooltip.
  function onKey(e) {
    var c = colOf(e.target);
    if (!c || !S) return;
    var cols = Array.prototype.slice.call(S.el.querySelectorAll(".us-col")), i = cols.indexOf(c), j;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = Math.min(cols.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = Math.max(0, i - 1);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = cols.length - 1;
    else { if (e.key === "Escape") hideTip(); return; }
    e.preventDefault();
    cols.forEach(function (x, k) { x.tabIndex = k === j ? 0 : -1; });
    cols[j].focus();
  }
  function showTip(col) {
    if (!S || !S.data) return;
    var d = S.data.days[+col.getAttribute("data-i")], chart = S.el.querySelector(".us-chart"), tip = chart && chart.querySelector(".us-tip");
    if (!d || !tip) return;
    tip.textContent = "";                                   // nội dung dựng bằng textContent (không innerHTML)
    [["span", dayName(d)], ["b", fmtN(d.reads) + " lượt đọc"], ["span", fmtN(d.writes) + " ghi, " + fmtN(d.deletes) + " xoá"]].forEach(function (x) {
      var n = document.createElement(x[0]); n.textContent = x[1]; tip.appendChild(n);
    });
    tip.hidden = false;
    var cr = chart.getBoundingClientRect(), br = (col.querySelector(".us-col-bar") || col).getBoundingClientRect();
    var half = tip.offsetWidth / 2, x = br.left + br.width / 2 - cr.left;
    tip.style.left = Math.max(half - 36, Math.min(cr.width - half, x)) + "px";
    tip.style.top = (Math.min(br.top, cr.bottom) - cr.top) + "px";
    S.el.querySelectorAll(".us-col.is-hover").forEach(function (n) { n.classList.remove("is-hover"); });
    col.classList.add("is-hover");
  }
  function hideTip() {
    if (!S) return;
    var tip = S.el.querySelector(".us-tip");
    if (tip) tip.hidden = true;
    S.el.querySelectorAll(".us-col.is-hover").forEach(function (n) { n.classList.remove("is-hover"); });
  }

  // ── Google Identity Services (token) ─────────────────────────────────────────────────────────────────────
  function gisReady() { var g = root.google; return !!(g && g.accounts && g.accounts.oauth2 && typeof g.accounts.oauth2.initTokenClient === "function"); }
  function ensureGis() {
    if (gisReady()) return Promise.resolve();
    if (gisP) return gisP;
    var src = S ? S.cfg.gisSrc : Core.DEFAULTS.gisSrc;
    gisP = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.setAttribute("data-us-gis", "");
      s.onload = function () { if (gisReady()) resolve(); else { gisP = null; reject(new Error("gis-missing")); } };
      s.onerror = function () { gisP = null; s.remove(); reject(new Error("gis-load")); };
      document.head.appendChild(s);
    });
    return gisP;
  }
  function tokenValid() { return !!(S && S.token) && Date.now() < S.exp; }
  function hasScope(resp, scope) {
    var o2 = root.google && root.google.accounts && root.google.accounts.oauth2;
    if (o2 && typeof o2.hasGrantedAllScopes === "function") { try { return !!o2.hasGrantedAllScopes(resp, scope); } catch (e) { /* rơi xuống tự kiểm */ } }
    return (" " + ((resp && resp.scope) || "") + " ").indexOf(" " + scope + " ") >= 0;
  }
  function connect() {
    if (!S || S.phase === "unconfigured") return;
    var st = S;
    if (gisReady()) { requestToken(st); return; }
    setPhase("connecting");
    ensureGis().then(function () { if (st === S) requestToken(st); }, function () { if (st === S) fail({ kind: "gis" }); });
  }
  function requestToken(st) {
    var cfg = st.cfg, mine = ++st.seq;
    var scopes = [cfg.scopes.monitoring].concat(cfg.checkBilling ? [cfg.scopes.billing] : []);
    setPhase("connecting");
    try {
      root.google.accounts.oauth2.initTokenClient({
        client_id: String(cfg.oauthClientId).trim(),
        scope: scopes.join(" "),
        prompt: "",                                       // chỉ hỏi đồng ý lần đầu
        login_hint: cfg.loginHint || undefined,
        callback: function (resp) {
          if (st !== S || mine !== st.seq) return;
          if (!resp || resp.error || !resp.access_token) {
            fail({ kind: "oauth", reason: (resp && resp.error) || "", message: (resp && (resp.error_description || resp.error)) || "" });
            return;
          }
          if (!hasScope(resp, cfg.scopes.monitoring)) { fail({ kind: "scope" }); return; }
          st.token = resp.access_token;
          st.exp = Date.now() + Math.max(60, (+resp.expires_in || 3600) - 60) * 1000;
          st.billingScope = !!cfg.checkBilling && hasScope(resp, cfg.scopes.billing);
          load();
        },
        error_callback: function (err) {
          if (st !== S || mine !== st.seq) return;
          var type = err && err.type;
          if (type === "popup_closed") {
            st.note = "Đã đóng cửa sổ Google. Nếu cửa sổ báo lỗi (vd origin_mismatch, access_denied), xem mục Sự cố trong hướng dẫn.";
            setPhase(st.data ? "data" : "ready");
            return;
          }
          fail({ kind: type === "popup_failed_to_open" ? "popup" : "oauth", message: (err && err.message) || "" });
        }
      }).requestAccessToken();
    } catch (e) { fail({ kind: "oauth", message: (e && e.message) || String(e) }); }
  }
  function disconnect() {
    if (!S) return;
    var t = S.token, o2 = root.google && root.google.accounts && root.google.accounts.oauth2;
    S.token = ""; S.exp = 0; S.data = null; S.err = null; S.seq++;
    if (t && o2 && typeof o2.revoke === "function") { try { o2.revoke(t, function () {}); } catch (e) { /* token tự hết hạn */ } }
    S.note = "Đã ngắt kết nối Google (token đã thu hồi).";
    setPhase("ready", S.note);
  }

  // ── Lấy số liệu ──────────────────────────────────────────────────────────────────────────────────────────
  function refresh(opts) {
    if (!S || S.phase === "unconfigured") return;
    if (tokenValid()) { load(); return; }
    if (opts && opts.silent) {                            // nút "Tải lại" chung của trang: không bao giờ bật popup
      if (S.token || S.data) {
        S.token = ""; S.exp = 0;
        S.note = "Phiên Google đã hết hạn — bấm Kết nối Google để xem số mới.";
        setPhase(S.data ? "data" : "ready");
      }
      return;
    }
    connect();                                            // từ cú bấm của người dùng ⇒ được phép mở popup
  }
  function gget(st, url) {
    var f = st.fetch || (typeof root.fetch === "function" ? root.fetch.bind(root) : null);
    if (!f) return Promise.reject({ kind: "net", message: "trình duyệt không có fetch" });
    return f(url, { headers: { Authorization: "Bearer " + st.token }, cache: "no-store" }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok) throw Core.classifyError(res.status, body);
        return body || {};
      });
    }, function (e) { throw { kind: "net", message: (e && e.message) || "" }; });
  }
  function getAll(st, url) {                              // gộp các trang (nextPageToken) của timeSeries.list
    var acc = { timeSeries: [] }, pages = 0;
    var step = function (u) {
      return gget(st, u).then(function (j) {
        Array.prototype.push.apply(acc.timeSeries, j.timeSeries || []);
        return j.nextPageToken && ++pages < 20 ? step(url + "&pageToken=" + encodeURIComponent(j.nextPageToken)) : acc;
      });
    };
    return step(url);
  }
  function load() {
    var st = S;
    if (!st) return;
    var mine = ++st.seq, cfg = st.cfg, pid = st.projectId, now = Date.now(), w = Core.windows(now, cfg), today = {}, history = {};
    st.err = null; st.note = "";
    setPhase("loading");
    var jobs = Core.KINDS.map(function (k) {
      return Promise.all([
        getAll(st, Core.seriesUrl(cfg, pid, k, w.todayStart, now, (now - w.todayStart) / 1000)).then(function (j) { today[k] = Core.sumPoints(j); }),
        w.days.length ? getAll(st, Core.seriesUrl(cfg, pid, k, w.histStart, w.histEnd, 3600)).then(function (j) { history[k] = Core.perDay(j, cfg.quotaTimeZone); }) : null
      ]);
    });
    var bill = st.billingScope
      ? gget(st, Core.billingUrl(cfg, pid)).then(function (j) { return { ok: j }; }, function (e) { return { err: e }; })
      : Promise.resolve(null);
    Promise.all([Promise.all(jobs), bill]).then(function (r) {
      if (st !== S || mine !== st.seq) return;
      var b = r[1];
      st.billingErr = b ? (b.err || null) : { kind: cfg.checkBilling ? "noscope" : "off" };
      st.data = Core.summarize({ cfg: cfg, win: w, today: today, history: history, billing: b && b.ok });
      st.at = Date.now();
      setPhase("data", "Đã cập nhật mức dùng Firestore lúc " + fmtClock(st.at) + ".");
    }, function (e) {
      if (st !== S || mine !== st.seq) return;
      if (e && e.kind === "auth") { st.token = ""; st.exp = 0; }
      fail(e);
    });
  }
  function fail(e) {
    if (!S) return;
    S.err = e || { kind: "other" };
    setPhase("error", errText(S.err).title);
  }
  function setPhase(p, live) {
    S.phase = p;
    render();
    if (live != null) { var l = S.el.querySelector('[data-us-slot="live"]'); if (l) l.textContent = live; }
  }

  // ── Hiển thị ─────────────────────────────────────────────────────────────────────────────────────────────
  function extLink(href, label) {
    return '<a class="us-a" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(label) + IC.ext + '</a>';
  }
  function consoleUrl() { return S.projectId ? Core.fill(S.cfg.consoleUsageUrl, { projectId: S.projectId }) : "https://console.firebase.google.com/"; }
  function errText(e) {
    var cfg = S.cfg, pid = S.projectId;
    switch (e.kind) {
      case "gis": return { title: "Không tải được Google Identity Services.", body: "Kiểm tra mạng hoặc tiện ích chặn script của trình duyệt, rồi thử lại." };
      case "popup": return { title: "Trình duyệt chặn cửa sổ đăng nhập Google.", body: "Cho phép popup với trang admin rồi bấm Kết nối Google lại." };
      case "oauth": return { title: "Google không cấp quyền" + (e.reason ? " (" + e.reason + ")" : "") + ".",
        body: esc(e.reason === "access_denied" ? "Bạn đã bấm Huỷ, hoặc tài khoản chưa có trong Test users." : "Kiểm tra Client ID và Authorized JavaScript origins.") + " " + extLink(cfg.setupDocUrl, "Xem hướng dẫn") };
      case "scope": return { title: "Chưa cấp quyền xem số liệu Cloud Monitoring.", body: "Bấm Kết nối Google lại và giữ dấu tick ở quyền xem dữ liệu giám sát (monitoring)." };
      case "disabled": {
        var svc = e.serviceTitle || e.service || "API";
        return { title: svc + " chưa bật cho project.", body: "Bật API, đợi 1–2 phút rồi bấm Thử lại. "
          + extLink(e.activationUrl || Core.fill(cfg.apiLibraryUrl, { service: e.service || "monitoring.googleapis.com", projectId: pid }), "Bật " + svc) };
      }
      case "perm": return { title: "Tài khoản Google này không có quyền đọc số liệu của project.",
        body: "Cần vai trò Monitoring Viewer (hoặc Viewer / Owner) trên project <code>" + esc(pid) + "</code>. " + extLink(Core.fill(cfg.iamUrl, { projectId: pid }), "Mở IAM") };
      case "billing": return { title: "Google yêu cầu project bật billing mới cho đọc số liệu qua API.",
        body: "Project đang ở gói Spark. Vẫn xem được số liệu miễn phí ở " + extLink(consoleUrl(), "Usage and billing") + "." };
      case "auth": return { title: "Phiên Google đã hết hạn.", body: "Bấm Kết nối Google để đăng nhập lại." };
      case "rate": return { title: "Cloud Monitoring đang giới hạn số yêu cầu.", body: "Đợi một lát rồi thử lại." };
      case "net": return { title: "Không kết nối được tới Google.", body: "Kiểm tra mạng rồi thử lại." };
      default: return { title: "Cloud Monitoring báo lỗi" + (e.status ? " " + e.status : "") + ".", body: esc(String(e.message || "").slice(0, 240)) };
    }
  }
  function render() {
    if (!S) return;
    var f = document.activeElement, keep = "";
    if (f && S.el.contains(f)) keep = f.getAttribute("data-us") || (colOf(f) ? "col:" + f.getAttribute("data-i") : "");
    S.el.querySelector('[data-us-slot="head"]').innerHTML = headRight();
    var body = S.el.querySelector('[data-us-slot="body"]');
    body.innerHTML = viewBody();
    if (S.phase === "loading" || S.phase === "connecting") body.setAttribute("aria-busy", "true"); else body.removeAttribute("aria-busy");
    if (keep) {                                           // vẽ lại không làm mất focus bàn phím
      var t = keep.indexOf("col:") === 0 ? S.el.querySelector('.us-col[data-i="' + keep.slice(4) + '"]') : S.el.querySelector('[data-us="' + keep + '"]');
      if (t && !t.disabled) {
        if (colOf(t)) S.el.querySelectorAll(".us-col").forEach(function (x) { x.tabIndex = x === t ? 0 : -1; });
        t.focus();
      }
    }
  }
  function headRight() {
    var h = "", d = S.data;
    if (d) {
      var P = {
        spark: ["Gói Spark (miễn phí)", "Project chưa bật billing: không bao giờ bị tính tiền, vượt quota thì bị chặn tới lúc reset"],
        blaze: ["Gói Blaze (trả theo mức dùng)", "Project đã bật billing: chỉ tính phần vượt quota miễn phí mỗi ngày"],
        unknown: ["Gói chưa rõ", "Chưa đọc được trạng thái billing của project"]
      }[d.plan];
      h += '<span class="pill us-plan" data-plan="' + d.plan + '" title="' + esc(P[1]) + '">' + esc(P[0]) + '</span>';
    }
    if (S.phase !== "unconfigured" && (S.token || S.data)) {
      var busy = S.phase === "loading" || S.phase === "connecting";
      h += '<button type="button" class="icon-btn' + (busy ? " is-spinning" : "") + '" data-us="refresh" aria-label="Làm mới mức dùng Firestore" title="Làm mới">' + IC.refresh + '</button>';
    }
    return h;
  }
  function viewBody() {
    var ph = S.phase;
    if (ph === "unconfigured") return viewSetup();
    if (S.data) return (ph === "error" ? viewAlert() : "") + viewData();
    if (ph === "loading") return viewSkeleton();
    if (ph === "error") return viewError();
    return viewConnect();
  }
  function viewSetup() {
    var why = !S.projectId ? "Thiếu <code>projectId</code> trong <code>js/config/firebase-config.js</code>."
      : "Cần tạo một OAuth Client ID (miễn phí, làm 1 lần trong Google Cloud) rồi dán vào <code>js/admin/usage-config.js</code>.";
    return '<div class="us-empty"><span class="us-ic">' + IC.info + '</span><div class="us-empty-tx">'
      + '<p><b>Chưa bật.</b> ' + why + '</p>'
      + '<p class="hint">Trong lúc chờ, xem số liệu ở ' + extLink(consoleUrl(), "Usage and billing") + '.</p>'
      + '<p class="us-actions">' + extLink(S.cfg.setupDocUrl, "Xem hướng dẫn bật") + '</p></div></div>';
  }
  function viewConnect() {
    var busy = S.phase === "connecting";
    return '<div class="us-empty"><span class="us-ic">' + IC.chart + '</span><div class="us-empty-tx">'
      + '<p>Kết nối tài khoản Google có quyền xem project <code>' + esc(S.projectId) + '</code> để xem lượt <b>đọc / ghi / xoá</b> hôm nay so với quota miễn phí, '
      + esc(S.cfg.historyDays) + ' ngày gần nhất và chi phí ước tính.</p>'
      + '<p class="hint">Chỉ xin quyền <b>đọc</b> số liệu giám sát' + (S.cfg.checkBilling ? ' và trạng thái billing' : '') + '. Token chỉ giữ trong tab này, tự hết hạn sau khoảng 1 giờ.</p>'
      + (S.note ? '<p class="us-note">' + esc(S.note) + '</p>' : '')
      + '<p class="us-actions"><button type="button" class="btn-pri btn-sm' + (busy ? ' is-loading' : '') + '" data-us="connect"' + (busy ? ' disabled' : '') + '>'
      + (busy ? 'Đang chờ Google…' : 'Kết nối Google') + '</button></p></div></div>';
  }
  function viewSkeleton() {
    var m = '<li class="us-m"><span class="skel" style="width:42%"></span><span class="skel us-sk-bar"></span><span class="skel" style="width:28%;height:10px"></span></li>';
    var cols = "";
    for (var i = 0; i <= S.cfg.historyDays; i++) cols += '<span class="skel" style="height:' + (28 + (i * 37) % 58) + '%"></span>';
    return '<div class="us-grid"><ul class="us-meters">' + m + m + m + '</ul><div class="us-sk-cols">' + cols + '</div></div>';
  }
  function viewError() {
    var e = S.err || {}, t = errText(e), relog = /^(popup|oauth|scope|auth)$/.test(e.kind);
    return '<div class="us-empty is-err" role="alert"><span class="us-ic">' + IC.warn + '</span><div class="us-empty-tx">'
      + '<p><b>' + esc(t.title) + '</b> ' + t.body + '</p><p class="us-actions">'
      + (relog ? '<button type="button" class="btn-pri btn-sm" data-us="connect">Kết nối Google</button>'
        : '<button type="button" class="btn-ghost btn-sm" data-us="retry">Thử lại</button>') + '</p></div></div>';
  }
  function viewAlert() {                                  // lỗi khi đã có số cũ: giữ số cũ, báo lỗi phía trên
    var t = errText(S.err || {});
    return '<div class="us-alert" role="alert">' + IC.warn + '<p><b>' + esc(t.title) + '</b> ' + t.body
      + ' Đang hiện số liệu lúc ' + esc(fmtClock(S.at)) + '.</p></div>';
  }
  function viewData() {
    var d = S.data, reset = esc(fmtClock(d.resetAt));
    return '<div class="us-grid">'
      + '<div class="us-today"><div class="us-sub"><h4>Hôm nay</h4><span class="hint">reset lúc ' + reset + ', còn <b data-us-countdown>' + esc(countdown()) + '</b></span></div>'
      + '<ul class="us-meters">' + d.meters.map(meterHtml).join("") + '</ul></div>'
      + '<div class="us-hist"><div class="us-sub"><h4>Lượt đọc theo ngày</h4><span class="hint">mỗi cột là 1 ngày quota, đổi ngày lúc ' + reset
      + (d.maxReads >= S.cfg.freeQuota.reads * 0.4 ? ', nét đứt là mức quota ' + esc(fmtN(S.cfg.freeQuota.reads)) : '') + '</span></div>'
      + chartHtml(d) + tableHtml(d) + '</div></div>' + footHtml(d);
  }
  function meterHtml(m) {
    var st = m.level === "over" ? '<span class="us-st">' + IC.warn + 'Vượt quota ' + fmtN(m.over) + '</span>'
      : m.level === "danger" ? '<span class="us-st">' + IC.warn + 'Gần hết, còn ' + fmtN(m.left) + '</span>'
      : m.level === "warn" ? '<span class="us-st">' + IC.warn + 'Sắp hết, còn ' + fmtN(m.left) + '</span>'
      : '<span>còn ' + fmtN(m.left) + '</span>';
    var w = m.used > 0 ? Math.max(0.8, Math.min(100, m.ratio * 100)) : 0;
    var vt = fmtN(m.used) + " trên " + fmtN(m.free) + " " + KUNIT[m.kind] + " miễn phí (" + fmtPct(m.ratio) + ")";
    return '<li class="us-m" data-kind="' + m.kind + '" data-level="' + m.level + '">'
      + '<div class="us-m-row"><span class="us-m-k">' + KLABEL[m.kind] + '</span><span class="us-m-v"><b>' + fmtN(m.used) + '</b> / ' + fmtN(m.free) + '</span></div>'
      + '<div class="us-m-bar" role="meter" aria-label="' + esc(KLABEL[m.kind] + " hôm nay") + '" aria-valuemin="0" aria-valuemax="' + m.free
      + '" aria-valuenow="' + Math.min(m.used, m.free) + '" aria-valuetext="' + esc(vt) + '"><span style="width:' + w.toFixed(2) + '%"></span></div>'
      + '<div class="us-m-foot"><span>' + fmtPct(m.ratio) + ' quota ngày</span>' + st + '</div></li>';
  }
  function chartHtml(d) {
    var q = +S.cfg.freeQuota.reads || 0, max = d.maxReads, showQ = q > 0 && max >= q * 0.4;
    var top = Core.niceCeil(showQ ? Math.max(q, max) * 1.08 : Math.max(max * 1.15, 10));
    var pct = function (v) { return Math.min(100, v / top * 100); };
    var gl = [0, 0.5, 1].map(function (f) { return '<div class="us-gl" style="bottom:' + f * 100 + '%"><span>' + fmtCompact(top * f) + '</span></div>'; }).join("");
    var maxI = -1, last = d.days.length - 1;
    d.days.forEach(function (x, i) { if (x.reads > 0 && (maxI < 0 || x.reads > d.days[maxI].reads)) maxI = i; });
    var cols = d.days.map(function (x, i) {
      var p = pct(x.reads), label = (i === maxI || (i === last && x.reads > 0))       // nhãn số chọn lọc: ngày cao nhất + hôm nay
        ? '<span class="us-col-v" style="bottom:calc(' + p.toFixed(2) + '% + 4px)">' + fmtCompact(x.reads) + '</span>' : "";
      var aria = dayName(x) + ": " + fmtN(x.reads) + " lượt đọc, " + fmtN(x.writes) + " ghi, " + fmtN(x.deletes) + " xoá";
      return '<div class="us-col' + (x.today ? " is-today" : "") + '" data-i="' + i + '" role="img" tabindex="' + (i === last ? 0 : -1) + '" aria-label="' + esc(aria) + '">'
        + '<span class="us-col-bar" style="height:' + (x.reads > 0 ? "max(3px," + p.toFixed(2) + "%)" : "0") + '"></span>' + label
        + '<span class="us-col-x" aria-hidden="true">' + (x.today ? "Hôm nay" : dayLabel(x.key)) + '</span></div>';
    }).join("");
    return '<div class="us-chart" role="group" aria-label="' + esc("Lượt đọc " + d.days.length + " ngày quota gần nhất, cột cuối là hôm nay") + '">'
      + '<div class="us-plot">' + gl + (showQ ? '<div class="us-ql" style="bottom:' + pct(q).toFixed(2) + '%"></div>' : "")
      + '<div class="us-cols">' + cols + '</div></div><div class="us-tip" hidden></div></div>'
      + (showQ || !q ? "" : '<p class="hint us-chart-note">Cao nhất ' + fmtN(max) + ' lượt/ngày = ' + fmtPct(max / q) + ' quota miễn phí.</p>');
  }
  function tableHtml(d) {
    var rows = d.days.slice().reverse().map(function (x) {
      return '<tr><td>' + esc(dayName(x)) + '</td><td class="us-n">' + fmtN(x.reads) + '</td><td class="us-n">' + fmtN(x.writes) + '</td><td class="us-n">' + fmtN(x.deletes) + '</td></tr>';
    }).join("");
    return '<details class="us-table"><summary>Bảng số liệu theo ngày</summary><div class="table-wrap"><table class="reg-table">'
      + '<thead><tr><th>Ngày quota</th><th class="us-n">Đọc</th><th class="us-n">Ghi</th><th class="us-n">Xoá</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
  }
  function footHtml(d) {
    var cfg = S.cfg, c = d.cost, line;
    var over = d.meters.filter(function (m) { return m.level === "over"; }).map(function (m) { return KLABEL[m.kind].toLowerCase(); });
    var est = 'hôm nay ≈ <b>' + fmtUsd(c.today) + '</b>, cả ' + d.days.length + ' ngày ≈ <b>' + fmtUsd(c.period) + '</b>';
    if (d.plan === "spark") {
      line = '<b>Chi phí: 0 ₫.</b> Gói Spark không tính tiền — vượt quota thì Firestore từ chối yêu cầu tới lúc reset.'
        + (over.length ? ' <span class="us-warn">Hôm nay đã vượt quota ' + over.join(", ") + ': trang sự kiện có thể lỗi tới lúc reset.</span>' : "");
    } else if (d.plan === "blaze") {
      line = '<b>Ước tính:</b> ' + est + '. Chỉ tính phần vượt quota miễn phí, theo giá trong cấu hình (' + extLink(cfg.pricingUrl, "bảng giá")
        + '); chưa gồm lưu trữ và băng thông.';
    } else {
      line = '<b>Chi phí:</b> gói Spark thì 0 ₫; gói Blaze thì ' + est + '. ' + billingHint();
    }
    return '<div class="us-foot"><p class="us-cost">' + line + '</p>'
      + (S.note ? '<p class="us-note">' + esc(S.note) + '</p>' : "")
      + (!tokenValid() ? '<p class="us-actions"><button type="button" class="btn-ghost btn-sm" data-us="connect">Kết nối Google lại</button></p>' : "")
      + '<p class="hint us-meta"><span>Cập nhật lúc ' + esc(fmtClock(S.at)) + ', số liệu Cloud Monitoring trễ vài phút</span>'   // các mục cách nhau bằng gap (CSS), không dùng dấu "·"
      + extLink(consoleUrl(), "Usage and billing")
      + (tokenValid() ? '<button type="button" class="us-link" data-us="disconnect">Ngắt kết nối Google</button>' : "") + '</p></div>';
  }
  function billingHint() {
    var e = S.billingErr;
    if (!e || e.kind === "off") return "";
    if (e.kind === "noscope") return "Chưa biết gói vì chưa cấp quyền xem billing khi kết nối.";
    if (e.kind === "disabled") return "Chưa biết gói vì Cloud Billing API chưa bật — "
      + extLink(e.activationUrl || Core.fill(S.cfg.apiLibraryUrl, { service: "cloudbilling.googleapis.com", projectId: S.projectId }), "bật API") + ".";
    if (e.kind === "perm") return "Chưa biết gói vì tài khoản không có quyền xem billing của project.";
    return "Chưa đọc được trạng thái billing.";
  }
  function countdown() {
    var ms = S.data.resetAt - Date.now();
    return ms > 0 ? Core.fmtDuration(ms) : "0 phút (đã reset, bấm làm mới)";
  }
  function tickCountdown() {
    if (!S || !S.data) return;
    var el = S.el.querySelector("[data-us-countdown]");
    if (el) el.textContent = countdown();
  }

  root.UsagePanel = api;
})(typeof window !== "undefined" ? window : this);
