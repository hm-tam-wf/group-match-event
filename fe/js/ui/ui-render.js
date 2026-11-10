// Đám mây nhỏ cười (tông "Cloud Candy") cho khung rỗng — dùng SVG để LUÔN hiển thị,
// không phụ thuộc font emoji (emoji 🫧 quá mới, nhiều máy hiện thành ô vuông trống).
const EMPTY_SVG = `<svg class="empty-ic" viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M21 47a15 15 0 0 1-2.4-29.8A19 19 0 0 1 55 13.5 14 14 0 0 1 62 41H21z"
        fill="#EFE6FB" stroke="#C9B4FF" stroke-width="2.6" stroke-linejoin="round"/>
  <circle cx="32" cy="33" r="2.8" fill="#A98CFF"/>
  <circle cx="49" cy="33" r="2.8" fill="#A98CFF"/>
  <path d="M34 39c2.2 2.6 8 2.6 10.5 0" stroke="#A98CFF" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="27" cy="38" r="2.4" fill="#FFB3D1"/>
  <circle cx="55" cy="38" r="2.4" fill="#FFB3D1"/>
</svg>`;

// Ổ khoá cho đội ĐÃ ĐỦ (danh sách chốt) — SVG để LUÔN hiện (không phụ thuộc font emoji 🔒, hay lỗi ô vuông
// trên một số máy). currentColor → kế thừa màu nhãn .lab (xám ở base, cyan-glow ở theme tech).
const LOCK_SVG = `<svg class="ft-lock-ic" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.4" fill="currentColor"/>
  <path d="M7.75 10.5V7.25a4.25 4.25 0 0 1 8.5 0v3.25" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

// Tên phòng dạng "Phòng 1 · Team 1" ⇒ tách phần Team thành nhãn riêng (xuống dòng, tô màu theo team để nhận ra
// các phòng cùng team). Chỉ tách khi hậu tố bắt đầu bằng Team/Nhóm — tên khác giữ nguyên.
const TEAM_COLORS = ["#22d3ee", "#fbbf24", "#a78bfa", "#34d399", "#fb7185", "#60a5fa"];
function splitTeam(name) {
  const m = /^(.*?)\s*·\s*((?:team|nhóm)\b.*)$/i.exec(String(name || ""));
  return m ? { base: m[1], team: m[2] } : { base: String(name || ""), team: "" };
}
function teamTag(name, cls) {
  const { team } = splitTeam(name);
  if (!team) return "";
  const teams = [...new Set(ICONS.map(ic => splitTeam(ic.name).team).filter(Boolean))];
  const color = TEAM_COLORS[teams.indexOf(team) % TEAM_COLORS.length];
  return `<div class="${cls}" style="--t-c:${color}">${esc(team)}</div>`;
}

// Hằng số hiển thị (§4 — chống magic number)
const AVATAR_PREVIEW_MAX = 5;     // số avatar hiện ở mỗi tile trước khi gộp thành "+N"
const CONFETTI_COUNT     = 28;    // số mảnh confetti trong popup chúc mừng
const RESIZE_DEBOUNCE_MS = 120;   // debounce tính lại số cột lưới khi resize cửa sổ

// ── Chế độ "Xem đăng ký" xuyên thiết bị ─────────────────────────────────────
// remoteView = TRUE khi máy này KHÔNG tự chọn đội: người dùng đã đăng ký ở thiết bị khác, nhập đúng họ tên
// → tra dedup_keys ra icon (apiLookupRegistration) và hiện phòng/team + bạn cùng phòng thay cho lưới chọn.
// Chỉ có nghĩa khi có myIcon (tự vô hiệu nếu myIcon bị self-heal gỡ) ⇒ luôn đọc qua inRemoteView().
// KHÔNG ghi members/signups/reg_keys cho máy này (chỉ đọc) — danh tính pid ở máy này không phải thành viên.
let remoteView = false;
const inRemoteView = () => remoteView && !!myIcon;

// icon hợp lệ từ kết quả lookup/claim: có icon VÀ icon đó còn trong ICONS (tránh sập byEmoji[...] khi sự kiện đổi icon).
const lookupIcon = res => (res && res.icon && byEmoji[res.icon]) ? res.icon : null;

// Lý do chặn ĐẶC BIỆT khi dupBlocked (null = thông báo "đã đăng ký" chung): {ascii:true,name,icon} | {ambiguous:true}.
let dupNote = null;
// Chặn chọn phòng (dupBlocked) kèm lý do từ kết quả rvResolve (mode asciiTaken / ambiguous / block / null).
function blockDupWith(r) {
  dupBlocked = true;
  dupNote = !r ? null : r.mode === "asciiTaken" ? { ascii: true, name: r.name, icon: r.icon } : r.mode === "ambiguous" ? { ambiguous: true } : null;
}

// Đọc lại state teams từ SERVER (apiState(true) = get({source:"server"}), không lấy cache/listener trễ) để KIỂM CHỨNG phòng bằng dữ liệu
// mới nhất. Kết quả được dùng lại trong `maxAgeMs` (mặc định FRESH_STATE_TTL_MS) để các cổng trong CÙNG 1 thao tác không đọc lặp; chỗ cần
// tuyệt đối mới (vừa thua đua claim, revalidate remote view) truyền 0. Trả true nếu có state mới/đủ mới; lỗi mạng ⇒ false và giữ state cũ.
const FRESH_STATE_TTL_MS = 3000;
let _freshAt = 0;
async function freshState(maxAgeMs = FRESH_STATE_TTL_MS) {
  if (stateLoaded && maxAgeMs > 0 && Date.now() - _freshAt < maxAgeMs) return true;
  try { state = await apiState(true); stateLoaded = true; _freshAt = Date.now(); return true; } catch (e) { return false; }
}

// CHỐT MỀM "gõ thiếu một phần dấu" (2 phòng cho 1 người): "Nguyễn Văn Hùng" đã đăng ký (k1 + M), cùng người gõ "Nguyen Văn Hùng" / "Nguyễn Văn Hung"
// ⇒ k1 khác, F không có doc ⇒ transaction cho qua (và thứ tự ngược "Hung" rồi "Hùng" cũng vậy). KHÔNG thể phân biệt "gõ thiếu dấu" với "tên thật ít
// dấu hơn" ("Thanh" vs "Thành", "Anh" vs "Ánh" là NGƯỜI KHÁC) ⇒ KHÔNG chặn cứng mà HỎI người dùng bằng hộp xác nhận. Ứng viên = tên đã đăng ký trong
// teams[*].names (công khai, lấy từ server) mà 2 chiều _markSubset(typed,cand) || _markSubset(cand,typed) đúng và KHÔNG trùng hệt (trùng hệt đã có
// đường k1). Chọn ứng viên ⇒ chuẩn hoá me.fields về TÊN ĐÃ ĐĂNG KÝ rồi vào remote view; chọn "Không" ⇒ nhớ (me.softNo) theo _foldKey(tên) + tập
// ứng viên lúc đó, đi tiếp luồng thường (reserve + claim; chốt CỨNG của server vẫn áp dụng). Tập ứng viên đổi ⇒ hỏi lại.
// LƯU Ý: chỉ là chốt MỀM phía client (gọi thẳng API vẫn vượt được); chặn gian lận chủ đích là việc của allowlist.
function softCands(value) {
  const k1 = _dedupKey(value);
  if (!k1) return [];
  const r = [];
  for (const ic in state) if (byEmoji[ic]) (state[ic].names || []).forEach(n => { if (_dedupKey(n) !== k1 && (_markSubset(value, n) || _markSubset(n, value))) r.push({ icon: ic, name: n }); });
  return r;
}
const softSig = cands => cands.map(c => _dedupKey(c.name)).sort().join("|");
const roomBaseOf = icon => splitTeam((byEmoji[icon] || { name: "" }).name).base;

// Hộp xác nhận (mobile-first, class sẵn có .modal-bg/.modal/.row/.confirm/.cancel; KHÔNG đóng được bằng nền/Esc). Trả Promise<index ứng viên | -1 = "Không">.
function showSoftModal(typed, cands) {
  return new Promise(resolve => {
    // Modal có thể mở khi init() còn đang await (init gate): loader .boot-loader (z-index 100, chỉ fade-out ở cuối init) phủ kín, che modal (z-index 50)
    // ⇒ không bấm được nút ⇒ init không bao giờ xong. Ẩn loader theo đúng cơ chế fade-out sẵn có (pointer-events:none; visibility:hidden) TRƯỚC khi mở.
    const loaderEl = document.getElementById("appLoading");
    if (loaderEl) loaderEl.classList.add("fade-out");
    $("toast").classList.remove("show");   // dẹp toast "Đang ghi nhận…" dính (z-index 60, cao hơn modal) — giống showJoinedModal
    const L = TEXT.lookup || {};
    const modalBgEl = document.createElement("div");
    modalBgEl.className = "modal-bg";
    modalBgEl.id = "softConfirmModal";
    const one = cands.length === 1;
    const btns = cands.map((c, i) => `<button class="confirm" data-i="${i}" style="width:100%">${one ? esc(L.softYes(c.name)) : esc(L.softOpt(c.name, roomBaseOf(c.icon)))}</button>`).join("");
    modalBgEl.innerHTML = `
      <div class="modal">
        <div class="mic">🤔</div>
        <h3>${esc(L.softTitle)}</h3>
        <p>${one ? L.softAsk1(esc(cands[0].name), esc(roomBaseOf(cands[0].icon))) : L.softAskN}</p>
        <div class="row" style="flex-direction:column;gap:8px">${btns}<button class="cancel" id="softNo" style="width:100%">${esc(L.softNo(typed))}</button></div>
      </div>`;
    document.body.appendChild(modalBgEl);
    modalBgEl.querySelectorAll("button[data-i]").forEach(b => { b.onclick = () => dismissModal(modalBgEl, () => resolve(+b.dataset.i)); });
    $("softNo").onclick = () => dismissModal(modalBgEl, () => resolve(-1));
  });
}

// Cổng mềm TRƯỚC claim/reserve. Trả null ⇒ đi luồng thường; {mode:"room", icon, name} ⇒ người dùng chọn 1 ứng viên (me.fields đã chuẩn hoá).
// Chỉ khi dedup theo TÊN; state TỪ SERVER, lỗi mạng ⇒ fail-open. Không phụ thuộc cờ DEDUP_STORE_ICON (phòng lấy từ teams.names công khai).
async function softConfirm() {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || DEDUP_FIELD !== "name") return null;
  const typed = me.fields[DEDUP_FIELD] || "";
  if (!_dedupKey(typed) || !(await freshState())) return null;
  const cands = softCands(typed);
  if (!cands.length) return null;
  const fk = _foldKey(typed), sig = softSig(cands);
  if (me.softNo && me.softNo[fk] === sig) return null;                    // đã chọn "Không" với ĐÚNG tập ứng viên này
  const pick = await showSoftModal(typed, cands);
  if (pick < 0) { me.softNo = Object.assign({}, me.softNo, { [fk]: sig }); await saveMe(); return null; }
  me.fields[DEDUP_FIELD] = cands[pick].name;                              // chuẩn hoá về tên đã đăng ký ⇒ lần sau tra thẳng bằng k1
  try { await apiRegRelease(typed); } catch (e) {}                         // nhả chỗ giữ cũ của tên gõ sai (nếu có) để không chặn người có tên thật
  await saveMe();
  return { mode: "room", icon: cands[pick].icon, name: cands[pick].name };
}
// Dùng ngay trước apiClaim ở doClaim: pid KHÔNG phải member (null) mà tên gần giống người đã đăng ký ⇒ hỏi; chọn ứng viên ⇒ kết quả DUP giả mang `soft`.
async function softClaimGate() {
  if (MODE !== MODE_FIREBASE || !BLOCK_DUP || !me.id || typeof apiMyMembership !== "function") return null;
  if ((await apiMyMembership(me.id)) !== null) return null;       // member thật / không rõ ⇒ để apiClaim xử lý (ALREADY…)
  const sg = await softConfirm();
  return sg ? { ok: false, reason: REASON.DUP, soft: sg } : null;
}

// Xác định "người này đăng ký ở phòng nào" từ dữ liệu CÔNG KHAI teams[*].names (+ cờ doc dedup `hit` nếu có). Rules chỉ kiểm
// teams/{icon}.count +1, KHÔNG gắn với key ⇒ icon trong dedup_keys có thể giả/lỗi thời, nên LUÔN đối chiếu tên trong names.
// So BẤT ĐỐI XỨNG (xem _dedupPlan ở api.js): k1 = _dedupKey(N), F = _foldKey(N), ascii = (k1 === F).
//   hit.k1            → phòng của tên có _dedupKey(name) === k1 (chính người này)          ⇒ {mode:"room", icon}
//   N có dấu, hit.f   → có người đăng ký KHÔNG dấu (_dedupKey(name) === F), chưa chắc là bạn ⇒ {mode:"asciiTaken", icon, name}
//   N không dấu, hit.m→ ứng viên (softCands) = tên CÓ dấu cùng chữ gốc: đúng 1 ⇒ room ; ≥2 ⇒ {mode:"ambiguous"} ; 0 ⇒ block
//   còn lại           → {mode:"block"} (doc không khớp tên nào: icon giả / dữ liệu lệch)
// hit=null (kiểm lại từ state, không có cờ doc): thử k1, không khớp thì thử các nhánh còn lại.
// DEDUP_FIELD khác "name" (vd MSNV): names không chứa mã ⇒ chỉ kiểm hintIcon còn người.
function rvResolve(value, hit, hintIcon) {
  const k1 = _dedupKey(value), F = _foldKey(value);
  if (!k1) return { mode: "block" };
  const h = hit || { k1: true, f: true, m: true };
  if (DEDUP_FIELD !== "name") {
    return (h.k1 && hintIcon && byEmoji[hintIcon] && teamOf(hintIcon).count > 0) ? { mode: "room", icon: hintIcon } : { mode: "block" };
  }
  const all = pred => { const out = []; for (const ic in state) (state[ic].names || []).forEach(n => { if (pred(n)) out.push({ icon: ic, name: n }); }); return out; };
  if (h.k1) {
    const r = all(n => _dedupKey(n) === k1).filter(x => byEmoji[x.icon]);
    if (r.length) return { mode: "room", icon: r[0].icon, name: r[0].name };
    if (hit) return { mode: "block" };
  }
  if (k1 !== F) {                                   // tên CÓ dấu: người đăng ký không dấu cùng F
    if (h.f) { const r = all(n => _dedupKey(n) === F).filter(x => byEmoji[x.icon]); if (r.length) return { mode: "asciiTaken", icon: r[0].icon, name: r[0].name }; }
    return { mode: "block" };
  }
  if (h.m) {                                        // tên KHÔNG dấu: ứng viên = tên có dấu cùng chữ gốc (server DUP dù chọn gì ⇒ nhánh CỨNG)
    const c = softCands(value);
    if (c.length === 1) return { mode: "room", icon: c[0].icon, name: c[0].name };
    if (c.length >= 2) return { mode: "ambiguous" };
  }
  return { mode: "block" };
}

// remote view hiện tại còn đúng không (state-only): phòng tra lại từ names phải đúng là myIcon.
function rvValid(icon) {
  const r = rvResolve(me.fields[DEDUP_FIELD] || "", null, icon);
  return r.mode === "room" && r.icon === icon;
}

// Kết quả tra cứu/DUP (có icon + hit) → rvResolve bằng state TỪ SERVER. Không đọc được server ⇒ chỉ tạm tin khi doc k1 có icon hợp lệ
// (renderState kiểm lại khi state về), còn lại block — không đoán phòng từ M/F.
async function resolveReg(res) {
  if (!lookupIcon(res)) return { mode: "block" };   // doc không có icon hợp lệ (join trước khi bật DEDUP_STORE_ICON / cờ tắt) ⇒ KHÔNG hiện phòng, chặn như cũ
  const ok = await freshState(0);                   // vừa thua đua claim / vừa tra cứu: phải mới tuyệt đối
  if (!ok) return (res && res.hit && res.hit.k1 && lookupIcon(res)) ? { mode: "room", icon: res.icon, tentative: true } : { mode: "block" };
  return rvResolve(me.fields[DEDUP_FIELD] || "", (res && res.hit) || null, res && res.icon);
}

let _rvChecking = false;
// renderState thấy remote view không còn khớp state cục bộ ⇒ KHÔNG đặt dupBlocked ngay (state có thể là snapshot cũ của listener):
// đọc lại từ server rồi mới quyết. Không đọc được server ⇒ GIỮ remote view. Còn đúng ⇒ giữ; phòng đổi ⇒ chuyển; hết ⇒ thoát + chặn.
async function revalidateRemoteView() {
  if (_rvChecking) return;
  _rvChecking = true;
  try {
    if (!(await freshState(0)) || !inRemoteView()) return;
    if (rvValid(myIcon)) { renderStateIfChanged(false); return; }
    const r = rvResolve(me.fields[DEDUP_FIELD] || "", null, null);
    if (r.mode === "room") { myIcon = r.icon; await saveMe(); renderStateIfChanged(true); return; }   // admin chuyển phòng
    myIcon = null; remoteView = false; blockDupWith(r); await saveMe();
    renderProfile(); renderStateIfChanged(true);
  } finally { _rvChecking = false; }
}

// Vào chế độ xem đăng ký với icon đã tra được. Chỉ cập nhật state cục bộ + lưu máy này; KHÔNG gọi API ghi.
async function enterRemoteView(icon) {
  myIcon = icon;
  remoteView = true;
  dupBlocked = false;     // người này ĐÃ đăng ký hợp lệ — không phải "trùng mã" cần chặn
  dupNote = null;
  allowBlocked = false;
  await saveMe();
}

// ── Hồ sơ người chơi ───────────────────────────────────────────────
// Đã có thông tin hợp lệ → thanh tóm tắt inline. Chưa có (token mới) → popup, không cho bỏ qua.
function renderProfile() {
  const profileBoxEl = $("profile");

  // CỔNG chống trùng: MSNV đã đăng ký & chưa vào đội & không đang sửa → chặn cứng, không cho vào lưới.
  if (dupBlocked && !myIcon && !editing) {
    closeProfileModal();
    profileBoxEl.innerHTML = "";
    closeAllowBlockedModal();
    showDupBlockedModal();
    return;
  }

  // CỔNG danh sách cho phép: bật allowlist & MSNV không trong danh sách → chặn cứng, không cho vào lưới.
  if (allowBlocked && !myIcon && !editing) {
    closeProfileModal();
    profileBoxEl.innerHTML = "";
    closeDupBlockedModal();
    showAllowBlockedModal();
    return;
  }

  // Đã vào đội (myIcon) ⇒ hồ sơ đã KHOÁ → LUÔN hiện thanh tóm tắt, KHÔNG ép lại popup nhập (kể cả khi
  // hồ sơ lưu từ phiên cũ không qua được validate mới — vd sự kiện cũ để name không bắt buộc / tên 1 ký
  // tự). Người CHƯA vào đội vẫn phải hợp lệ mới vào lưới: renderState.ready/canJoin dùng profileValid && !myIcon.
  const done = (myIcon || profileValid()) && !editing;

  if (done) {
    closeProfileModal();
    // + giới tính THEO DANH SÁCH (khi bật "Check giới tính") — người chơi thấy hệ thống xếp mình vào giới nào; sai ⇒ báo BTC sửa file.
    const metaBits = FIELDS.filter(f => f.key !== "name").map(f => me.fields[f.key]).concat(myGender).filter(Boolean).join("  ·  ");
    profileBoxEl.innerHTML = `
      <div class="summary">
        <div class="ava" style="background:${(myIcon && byEmoji[myIcon] && byEmoji[myIcon].color) || 'var(--accent)'}">${initial(me.fields.name)}</div>
        <div class="s-txt">
          <span class="nm">${esc(me.fields.name) || TEXT.grid.player}</span>
          <span class="meta">${esc(metaBits)}</span>
        </div>
        <div class="s-spacer"></div>
      </div>`;
    // Tính năng "Sửa thông tin" đã TẮT theo yêu cầu: điền xong là KHOÁ hồ sơ, không cho sửa nữa.
    // (Ngoại lệ: bị chặn trùng MSNV vẫn còn "Nhập mã khác" trong showDupBlockedModal để nhập lại,
    //  nếu không người gõ nhầm mã sẽ bị kẹt vĩnh viễn ở màn hình chặn.)
    return;
  }

  profileBoxEl.innerHTML = "";        // không còn form inline — dùng popup bên dưới
  showProfileModal();
}

function closeProfileModal(callback) {
  const modalEl = $("profileModal");
  if (modalEl) dismissModal(modalEl, callback);
  else if (callback) callback();
}

// "Trang chủ" để quay về = referrer CÙNG ORIGIN là trang travel/home hoặc gốc site. Trước đây mọi referrer kết thúc bằng "/"
// (vd https://www.facebook.com/) cũng bị coi là trang chủ ⇒ bấm Huỷ đưa người chơi sang site khác.
function _homeReferrer() {
  try {
    if (!document.referrer) return "";
    const u = new URL(document.referrer);
    if (u.origin !== location.origin) return "";
    return (u.pathname.includes("travel") || u.pathname.endsWith("/")) ? u.href : "";
  } catch (e) { return ""; }
}
// Chuyển trang mượt mà khi quay lại trang chủ / trang travel (tránh giật và che màn hình bên trong)
function _travelSmoothBack() {
  document.body.style.transition = "opacity 0.16s ease-out";
  document.body.style.opacity = "0";
  setTimeout(() => {
    const home = _homeReferrer();
    if (home) window.location.href = home;
    else if (window.history.length > 1) window.history.back();
    else window.location.href = "travel.html";
  }, 150);
}
// Bấm Back sau khi _travelSmoothBack rời trang ⇒ trình duyệt KHÔI PHỤC trang từ bfcache nguyên trạng, kể cả opacity 0
// ⇒ trang trắng xoá. Trả lại hiển thị khi trang được khôi phục.
window.addEventListener("pageshow", e => {
  if (e.persisted) { document.body.style.opacity = ""; document.body.style.transition = ""; }
});

// Popup nhập thông tin. canCancel = đang SỬA thông tin đã hợp lệ (cho phép quay lại);
// với token mới (chưa hợp lệ) thì KHÔNG có nút huỷ và KHÔNG đóng bằng click nền/Esc.
function showProfileModal() {
  if ($("profileModal")) return;          // tránh mở chồng
  const canCancel = profileValid();
  const isTech = document.documentElement.getAttribute("data-theme") === "tech";
  const showBoot = isTech && !canCancel;
  const bootClass = showBoot ? " tech-booting" : "";

  const headerEl = document.querySelector("#appContent h1");
  const headerTitle = headerEl ? headerEl.textContent.trim() : "Group Match";

  const modalBgEl = document.createElement("div");
  modalBgEl.className = "modal-bg";
  modalBgEl.id = "profileModal";
  modalBgEl.innerHTML = `
    <div class="modal profile-modal${bootClass}">
      ${showBoot ? `
      <div class="terminal-boot">
        <div class="term-row">> ${TEXT.tech.terminalLine1}</div>
        <div class="term-row">> ${TEXT.tech.terminalLine2(esc(headerTitle))}</div>
        <div class="term-row">> ${TEXT.tech.terminalLine3}</div>
        <div class="term-row">> ${TEXT.tech.terminalLine4}</div>
      </div>
      ` : ""}
      <div class="modal-content-wrap">
        ${isTech ? `
        <div class="tech-logo-only" style="margin-top: 10px;">
          <div class="logo-wrap">
            <img src="themes/tech/img/LOGO.png" alt="Faraday Icon" class="logo-icon">
            <span class="logo-text">FARADAY</span>
          </div>
        </div>
        ` : `
        <div class="pm-emoji">🐾</div>
        `}
        <h3>${TEXT.profile.greeting}</h3>
        <p>${TEXT.profile.subtitle}</p>
        <div class="form" id="pmForm">
          ${FIELDS.map(f => `
            <div class="field full">
              <label>${esc(f.label)}${f.required ? " *" : ""}</label>
              <input id="f_${f.key}" type="${f.type}" placeholder="${esc(f.placeholder || "")}"
                     value="${esc(me.fields[f.key] || "")}" autocomplete="off" inputmode="text">
              <span class="msg" id="m_${f.key}"></span>
            </div>`).join("")}
        </div>
        <div class="row">
          ${canCancel ? `<button class="cancel" id="pmCancel">${TEXT.profile.back}</button>` : ""}
          <button class="confirm" id="pmSave">${TEXT.profile.start}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modalBgEl);

  // Chống tái-nhập: giữ phím Enter (auto-repeat) hoặc submit dồn sẽ chạy 2 luồng save() SONG SONG →
  // cả hai cùng vào apiRegReserve khi reservedKey CHƯA kịp ghi (đều thấy "chỗ mới") → 1 luồng bị
  // transaction retry thấy 'exists' → trả dup → tự chặn "trùng MSNV" CHÍNH MÌNH + xoá signup của mình.
  // Bọc 1 lớp khoá quanh logic lưu: chỉ cho 1 luồng chạy, finally nhả khoá ở MỌI lối thoát (gồm
  // name-mismatch giữ popup mở để sửa). Khoá đặt SAU khi đã có doSave để tránh TDZ ở lần gọi.
  let saving = false;
  const save = async () => {
    if (saving) return;                 // đã có 1 luồng save() đang chạy → bỏ lần gọi dồn
    saving = true;
    try { await doSave(); } finally { saving = false; }
  };
  const doSave = async () => {
    let ok = true;
    FIELDS.forEach(f => {
      const inp = $("f_" + f.key), msg = $("m_" + f.key);
      const err = fieldError(f, inp.value);
      msg.textContent = err;
      inp.classList.toggle("bad", !!err);
      if (err) ok = false;
    });
    if (!ok) return;
    FIELDS.forEach(f => me.fields[f.key] = $("f_" + f.key).value.trim());
    editing = false;
    await saveMe();

    // CỔNG chống trùng — KIỂM TRA TRƯỚC KHI GHI: MSNV đã đăng ký rồi → chặn & KHÔNG ghi signups.
    // (Trước đây ghi data trước cổng → cố nhập lại đúng mã đã có vẫn lưu được hồ sơ trùng → bug.)
    const btn = $("pmSave");
    if (btn) { btn.disabled = true; btn.textContent = TEXT.profile.checking; }
    let taken = false, looked = null;
    if (!myIcon && BLOCK_DUP && DEDUP_FIELD && typeof apiLookupRegistration === "function") {   // đã vào đội ⇒ mã dedup là của CHÍNH MÌNH, đừng tự coi là trùng rồi xoá hồ sơ
      // Tra cứu TRƯỚC reserve: reg_keys.profiled (apiRegReserve) sẽ chặn cả người đã join ở máy khác → phải biết họ là ai trước.
      try { looked = await apiLookupRegistration(me.fields[DEDUP_FIELD]); } catch (e) {}
      taken = !!(looked && looked.found);
    }
    if (!looked || looked.error) {                          // lookup không có / lỗi mạng ⇒ luồng cũ (apiDedupTaken)
      if (!myIcon && typeof apiDedupTaken === "function") {
        try { taken = await apiDedupTaken(me.fields[DEDUP_FIELD]); } catch (e) {}
      }
    }
    // Chốt MỀM gõ-thiếu-dấu (xem softConfirm): chưa có doc trùng nhưng tên gần giống 1 tên đã đăng ký ⇒ HỎI xác nhận (chọn ứng viên ⇒ remote view; "Không" ⇒ đi tiếp) TRƯỚC reserve/ghi hồ sơ.
    let soft = null;
    if (!taken && !myIcon && BLOCK_DUP && DEDUP_FIELD && !(looked && looked.error)) { try { soft = await softConfirm(); } catch (e) {} if (soft) taken = true; }
    if (btn) { btn.disabled = false; btn.textContent = TEXT.profile.start; }
    // Máy này có phải MEMBER thật không? (members/{pid}) — chỉ khi server nói rõ null mới được vào remote view / dọn signup.
    let mem;
    if (taken && typeof apiMyMembership === "function") { try { mem = await apiMyMembership(me.id); } catch (e) {} }
    const closeAfter = () => {
      closeDupBlockedModal();
      closeAllowBlockedModal();
      closeProfileModal(() => {
        renderProfile();
        renderStateIfChanged(true);
        toast((TEXT.lookup && TEXT.lookup.note) || TEXT.profile.saved);
      });
    };
    if (taken && mem && mem.icon && byEmoji[mem.icon]) {
      // pid máy này LÀ member thật (browser quên) — CHỈ khôi phục khi tên vừa gõ đúng là tên trong phòng của member này (không thì ghi
      // me.fields của người KHÁC vào hồ sơ của pid này). Không khớp ⇒ giữ hành vi chặn bên dưới (không dọn signup vì mem ≠ null).
      await freshState();
      const typed = _dedupKey(me.fields.name || me.fields[DEDUP_FIELD] || "");
      if (typed && teamOf(mem.icon).names.some(n => _dedupKey(n) === typed)) {
        myIcon = mem.icon; remoteView = false; dupBlocked = false; dupNote = null; allowBlocked = false; await saveMe();
        closeAfter();
        return;
      }
    }
    const rr = (taken && mem === null) ? (soft || await resolveReg(looked)) : null;
    if (rr && rr.mode === "room") {
      // Đã đăng ký ở thiết bị khác → vào chế độ XEM: không ghi hồ sơ, không đặt-chỗ, không cho chọn lại.
      await enterRemoteView(rr.icon);
      // Dọn signup mồ côi của pid máy này (nếu đã lỡ lưu ở phiên trước) — server đã xác nhận pid KHÔNG phải member (null).
      try { if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id); } catch (e) {}
      closeAfter();
      return;
    }
    if (taken) {
      blockDupWith(rr);           // rr = asciiTaken / ambiguous ⇒ modal có thông báo riêng; còn lại thông báo chung
      if (mem === null && typeof apiRemoveProfile === "function") apiRemoveProfile(me.id);   // dọn signup trùng nếu lỡ lưu ở phiên trước (lúc MSNV còn trống) — chỉ khi chắc chắn không phải member
      renderProfile();            // dupBlocked && !myIcon && !editing → hiện modal chặn (KHÔNG ghi data)
      return;
    }
    dupBlocked = false; dupNote = null;

    // CỔNG danh sách cho phép — SAU cổng dedup: MSNV không trong danh sách → chặn, KHÔNG ghi hồ sơ.
    // apiAllowlistInfo trả {allowed, name, gender}: name = tên đã đăng ký (để đối chiếu họ tên ngay bên dưới);
    // gender = giới tính theo danh sách (phân phòng theo giới — chỉ dùng khi ALLOWLIST_GENDERCHECK).
    let allow = { allowed: true, name: "", gender: "" };
    if (typeof apiAllowlistInfo === "function") {
      if (btn) { btn.disabled = true; btn.textContent = TEXT.profile.checking; }
      try { allow = await apiAllowlistInfo(me.fields[DEDUP_FIELD]); } catch (e) {}
      if (btn) { btn.disabled = false; btn.textContent = TEXT.profile.start; }
    }
    if (!allow.allowed) {
      allowBlocked = true;
      if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id);   // dọn hồ sơ nếu lỡ lưu trước đó
      renderProfile();            // allowBlocked && !myIcon && !editing → hiện modal chặn (KHÔNG ghi data)
      return;
    }
    allowBlocked = false;
    myGender = ALLOWLIST_GENDERCHECK ? (allow.gender || "") : "";   // lưới khoá phòng khác giới theo giá trị này

    // ĐỐI CHIẾU HỌ TÊN với danh sách — chỉ khi BẬT cờ ALLOWLIST_NAMECHECK & dòng CÓ lưu tên: tên nhập phải
    // khớp sau chuẩn hoá (bỏ dấu, gộp khoảng trắng, không phân biệt hoa/thường). Lệch → báo ngay ô họ tên,
    // GIỮ ở popup để sửa (KHÔNG ghi). Cờ tắt (mặc định) ⇒ bỏ qua bước này, chỉ kiểm có-trong-danh-sách.
    if (ALLOWLIST_NAMECHECK && allow.name && typeof _normName === "function" && _normName(me.fields.name) !== _normName(allow.name)) {
      const msg = $("m_name"), inp = $("f_name");
      if (msg) msg.textContent = TEXT.profile.nameMismatch;
      if (inp) inp.classList.add("bad");
      return;
    }

    // CỔNG đặt-chỗ TIỀN-JOIN — SAU mọi cổng trên, TRƯỚC khi ghi signups: giữ MSNV để KHÔNG ai tạo
    // dòng signup thứ hai cùng mã (kể cả khi chưa ai join). Người khác đã giữ ⇒ chặn như trùng MSNV.
    if (!myIcon && typeof apiRegReserve === "function") {   // đã vào đội ⇒ chỗ giữ là của mình, không cần đặt lại
      if (btn) { btn.disabled = true; btn.textContent = TEXT.profile.checking; }
      let reserved = { ok: true };
      try { reserved = await apiRegReserve(me.fields[DEDUP_FIELD]); } catch (e) {}
      if (btn) { btn.disabled = false; btn.textContent = TEXT.profile.start; }
      if (reserved && reserved.ok === false) {
        dupBlocked = true;
        if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id);   // dọn signup trùng nếu lỡ lưu trước đó
        renderProfile();            // dupBlocked && !myIcon && !editing → hiện modal chặn (KHÔNG ghi data)
        return;
      }
    }

    // Chỉ ghi khi MSNV hợp lệ (không trùng, có trong danh sách); đồng bộ ngay cả khi CHƯA chọn đội để admin có data.
    apiSaveProfile({ playerId: me.id, fields: me.fields });
    closeDupBlockedModal();
    closeAllowBlockedModal();
    closeProfileModal(() => {
      renderProfile();
      renderStateIfChanged(true);
      toast(TEXT.profile.saved);
    });
  };

  $("pmSave").onclick = save;
  if (canCancel) $("pmCancel").onclick = (e) => {
    if (e) e.preventDefault();
    editing = false;
    const wasBlocked = dupBlocked || allowBlocked;
    dupBlocked = false;
    allowBlocked = false;
    if (wasBlocked && !myIcon) {
      me.fields = {};
      saveMe();
    }
    const fromTravel = !!_homeReferrer();
    if (fromTravel || !myIcon || wasBlocked) {
      _travelSmoothBack();
      return;
    }
    closeProfileModal(() => {
      renderProfile();
      renderStateIfChanged(true);
    });
  };
  // CHỦ ĐÍCH: không gắn sự kiện click nền / Esc → popup không thể bỏ qua khi chưa hợp lệ.

  FIELDS.forEach(f => {
    const inp = $("f_" + f.key);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
    inp.addEventListener("input",   () => { $("m_" + f.key).textContent = ""; inp.classList.remove("bad"); });
  });
  if (showBoot) {
    // Thời gian giữ màn terminal: theme/biến thể khai --boot-hold-ms (vd TNT 5000); mặc định 4000 khớp nhịp CSS tech.
    const bootHoldMs = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--boot-hold-ms"), 10) || 4000;
    setTimeout(() => {
      const modalEl = modalBgEl.querySelector(".profile-modal");
      if (modalEl) modalEl.classList.remove("tech-booting");
      const firstInputEl = $("f_" + FIELDS[0].key);
      if (firstInputEl) firstInputEl.focus();
    }, bootHoldMs);
  } else {
    const firstInputEl = $("f_" + FIELDS[0].key);
    if (firstInputEl) setTimeout(() => firstInputEl.focus(), 40);
  }
}

// Modal CHẶN khi MSNV đã đăng ký rồi — không thể bỏ qua (không click nền/Esc), chỉ cho "Nhập mã khác".
// Đây là cổng chặn vào trang chọn đội: trùng MSNV ⇒ không vào được lưới linh thú.
function showDupBlockedModal() {
  if ($("dupBlockedModal")) return;
  const fieldLabel = labelOf(DEDUP_FIELD);
  const modalBgEl = document.createElement("div");
  modalBgEl.className = "modal-bg";
  modalBgEl.id = "dupBlockedModal";
  modalBgEl.innerHTML = `
    <div class="modal">
      <div class="mic">🔒</div>
      <h3>${TEXT.dup.title}</h3>
      <p>${dupNote && dupNote.ascii ? TEXT.lookup.asciiTaken(esc(dupNote.name), esc(splitTeam((byEmoji[dupNote.icon] || { name: "" }).name).base))
          : dupNote && dupNote.ambiguous ? TEXT.lookup.ambiguous : TEXT.dup.body(esc(fieldLabel))}</p>
      <div class="row">
        <button class="cancel" id="dupCancel">${(TEXT.profile && TEXT.profile.back) || "Quay lại"}</button>
        <button class="confirm" id="dupBack">${TEXT.dup.btn}</button>
      </div>
    </div>`;
  document.body.appendChild(modalBgEl);
  $("dupBack").onclick = () => { dismissModal(modalBgEl, () => { editing = true; renderProfile(); }); };
  $("dupCancel").onclick = (e) => {
    if (e) e.preventDefault();
    dupBlocked = false;
    dupNote = null;
    allowBlocked = false;
    if (!myIcon) { me.fields = {}; saveMe(); }
    _travelSmoothBack();
  };
}

function closeDupBlockedModal() {
  const modalEl = $("dupBlockedModal");
  if (modalEl) dismissModal(modalEl);
}

// Modal CHẶN khi MSNV KHÔNG nằm trong danh sách cho phép — không thể bỏ qua, chỉ cho "Nhập mã khác".
// Cổng chặn vào trang chọn đội khi sự kiện bật "danh sách cho phép" mà mã không có trong danh sách.
function showAllowBlockedModal() {
  if ($("allowBlockedModal")) return;
  const fieldLabel = labelOf(DEDUP_FIELD);
  const modalBgEl = document.createElement("div");
  modalBgEl.className = "modal-bg";
  modalBgEl.id = "allowBlockedModal";
  modalBgEl.innerHTML = `
    <div class="modal">
      <div class="mic">🔒</div>
      <h3>${TEXT.allow.title}</h3>
      <p>${TEXT.allow.body(esc(fieldLabel))}</p>
      <div class="row">
        <button class="cancel" id="allowCancel">${(TEXT.profile && TEXT.profile.back) || "Quay lại"}</button>
        <button class="confirm" id="allowBack">${TEXT.allow.btn}</button>
      </div>
    </div>`;
  document.body.appendChild(modalBgEl);
  $("allowBack").onclick = () => { dismissModal(modalBgEl, () => { editing = true; renderProfile(); }); };
  $("allowCancel").onclick = (e) => {
    if (e) e.preventDefault();
    allowBlocked = false;
    dupBlocked = false;
    if (!myIcon) { me.fields = {}; saveMe(); }
    _travelSmoothBack();
  };
}

function closeAllowBlockedModal() {
  const modalEl = $("allowBlockedModal");
  if (modalEl) dismissModal(modalEl);
}

// ── Popup chúc mừng sau khi vào đội thành công ─────────────────────
// Giữ phong cách modal sẵn có (.modal-bg/.modal/.confirm) + confetti. Emoji con vật
// của đội (iconDef.icon, loại cũ 🦊🐉…) hiển thị tốt nên giữ nguyên trong popup.
function showJoinedModal(iconDef) {
  $("toast").classList.remove("show");   // dẹp toast "Đang ghi nhận…" dính trước đó (toast z-index cao hơn modal)

  const modalBgEl = document.createElement("div");
  modalBgEl.className = "modal-bg";
  modalBgEl.innerHTML = `
    <div class="modal joined-modal" style="--c:${iconDef.color}">
      <div class="confetti">${"<i></i>".repeat(CONFETTI_COUNT)}</div>
      <div class="jm-icon">${iconDef.icon}</div>
      <h3>${TEXT.celebrate.title}</h3>
      <p>${TEXT.celebrate.body(esc(iconDef.name))}</p>
      <div class="row"><button class="confirm" id="jmOk">${TEXT.celebrate.ok}</button></div>
    </div>`;
  document.body.appendChild(modalBgEl);

  // confetti ngẫu nhiên màu/vị trí/thời gian
  const colors = ["#FF7AC0","#A98CFF","#7DD3FC","#4dd47a","#ffe14d","#ffb13d"];
  modalBgEl.querySelectorAll(".confetti i").forEach((pieceEl, i) => {
    pieceEl.style.left = Math.random() * 100 + "%";
    pieceEl.style.background = colors[i % colors.length];
    pieceEl.style.animationDuration = (1.2 + Math.random() * 1.2) + "s";
    pieceEl.style.animationDelay = (Math.random() * 0.4) + "s";
  });

  // close() gỡ CẢ listener keydown ở cả 3 lối đóng (nút / click nền / Esc) → không rò listener.
  const close = () => { dismissModal(modalBgEl); document.removeEventListener("keydown", onKey); };
  function onKey(e) { if (e.key === "Escape") close(); }
  modalBgEl.querySelector("#jmOk").onclick = close;
  modalBgEl.addEventListener("click", e => { if (e.target === modalBgEl) close(); });
  document.addEventListener("keydown", onKey);
}

// ── Bảng đội (vẽ lại mỗi khi dữ liệu đổi) ──────────────────────────
function teamOf(icon) { return state[icon] || { count: 0, names: [] }; }

// Chọn SỐ CỘT để chia đều tile thành các hàng cân nhau (vd 10 → 5/5, không phải 6/4).
// maxFit = số cột nhiều nhất còn vừa bề ngang. Duyệt mọi số cột ≤ maxFit, chấm điểm theo:
//   • ô trống ở HÀNG CUỐI (0 = hàng cuối đầy, đẹp nhất — tránh kiểu 6/4 hay lẻ loi 1 ô)
//   • "phình" = maxFit − cột (ít cột hơn mức khít → tile to ra; phạt để tile không quá to)
// Điểm thấp nhất thắng; hoà thì ưu tiên NHIỀU cột (ít hàng, tile vừa). Tự cân lại khi đổi số đội.
function balancedColumns(count, maxFit) {
  if (count <= 1) return 1;
  const hi = Math.min(Math.max(1, maxFit), count);
  let best = hi, bestScore = Infinity;
  for (let c = hi; c >= 1; c--) {
    const rows    = Math.ceil(count / c);
    const lastRow = count - (rows - 1) * c;   // số tile ở hàng cuối (1..c)
    const score   = (c - lastRow) + (hi - c); // ô trống hàng cuối + độ phình
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// Ghi số cột chia đều lên lưới "Đội còn chỗ". Đọc --min-tile + gap thật từ CSS (đổi theo
// breakpoint) nên điện thoại/laptop/desktop đều tính đúng. Gọi sau mỗi lần render & khi resize.
function layoutFreeGrid() {
  const grid = $("grid");
  if (!grid) return;
  const tileCount = grid.children.length;
  const gridStyle = getComputedStyle(grid);
  const minTile   = parseFloat(gridStyle.getPropertyValue("--min-tile")) || 168;
  const gap       = parseFloat(gridStyle.columnGap) || 16;
  const gridWidth = grid.clientWidth;
  const maxFit    = Math.max(1, Math.floor((gridWidth + gap) / (minTile + gap)));
  // ≤ 1 hàng (tileCount ≤ maxFit) → để CSS auto-fill: tile giữ bề ngang tự nhiên, canh trái — KHÔNG
  // kéo giãn 1–2 đội còn lại chiếm cả chiều ngang. Chỉ chia đều khi tràn sang nhiều hàng.
  if (tileCount === 0 || tileCount <= maxFit) { grid.style.gridTemplateColumns = ""; return; }
  const cols = balancedColumns(tileCount, maxFit);
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}

// Co giãn cửa sổ → tính lại số cột (debounce nhẹ). Số tile lấy từ DOM nên không cần state.
let _layoutTimer;
window.addEventListener("resize", () => {
  clearTimeout(_layoutTimer);
  _layoutTimer = setTimeout(layoutFreeGrid, RESIZE_DEBOUNCE_MS);
});

function renderState() {
  // myIcon còn hợp lệ? Chỉ mở khoá khi ĐÃ tải được state thật từ server và đội đó thực sự rỗng
  // (tránh xoá nhầm khi state chưa tải xong / fetch lỗi lúc mới vào trang).
  if (!_skipSelfHeal && stateLoaded && myIcon) {
    if (inRemoteView()) {
      // Remote view không còn khớp state cục bộ (phòng hết người / tên không còn trong names: admin un-join, icon giả, hoặc chỉ là snapshot cũ):
      // đọc lại SERVER rồi mới thoát + chặn (revalidateRemoteView). Trong lúc chờ, myIcon vẫn đặt ⇒ canJoin=false ⇒ lưới KHÔNG mở lại
      // (nếu mở: bấm join ⇒ DUP ⇒ vào lại remote view ⇒ lặp vô tận).
      if (!rvValid(myIcon)) revalidateRemoteView();
    } else if (teamOf(myIcon).count === 0) { myIcon = null; saveMe(); renderProfile(); }
  }

  // banner đội của mình
  const bannerWrapEl = $("bannerWrap");
  if (myIcon) {
    // myIcon (từ localStorage / server) có thể KHÔNG còn trong cấu hình (admin đổi icon, doc tra cứu sai) ⇒ dựng tạm
    // từ chính icon để vẫn hiện banner thay vì ném TypeError làm hỏng cả trang.
    const iconDef = byEmoji[myIcon] || { icon: myIcon, name: myIcon, color: "var(--accent)" };
    if (inRemoteView()) {
      // Xem đăng ký (đã chọn ở thiết bị khác): banner "Bạn đã đăng ký" + khối phòng/team + bạn cùng phòng.
      // Chỉ hiện tên người cùng phòng (đã công khai ở teams) — không PII nào khác ngoài tên vừa nhập.
      const L = TEXT.lookup || {};
      const rvTeam = teamOf(myIcon);
      let rvMe = false;
      const rvRes = rvResolve(me.fields[DEDUP_FIELD] || me.fields.name || "", null, myIcon) || {};
      const rvName = rvRes.name;
      // Khớp qua tên KHÁC với tên vừa gõ (thiếu dấu / không dấu) ⇒ luôn kèm ghi chú, không để người dùng tưởng đó chắc chắn là mình.
      const rvNote = (rvName && _dedupKey(rvName) !== _dedupKey(me.fields[DEDUP_FIELD] || me.fields.name || ""))
        ? `<div class="bs" style="margin-top:6px">${(TEXT.lookup && TEXT.lookup.asNote) ? TEXT.lookup.asNote(esc(rvName)) : ""}</div>` : "";   // đúng TÊN đã đăng ký (so bất đối xứng, xem rvResolve): "Hùng" không tô nhầm "Hưng"
      const mates = rvTeam.names.map((n, j) => {
        const isMe = !rvMe && !!rvName && n === rvName;
        if (isMe) rvMe = true;
        return `<li class="${isMe ? "is-me" : ""}"><span class="no">${j + 1}</span>${esc(n || "—")}</li>`;
      }).join("");
      bannerWrapEl.innerHTML = `<div class="banner" style="--c:${iconDef.color}">
          <span class="bi">${iconDef.icon}</span>
          <div>
            <div class="bt">${esc(L.title || "")}</div>
            <div class="bs">${esc(L.note || "")}</div>
            ${rvNote}
          </div></div>
        <div class="full-team mine" style="--c:${iconDef.color};margin-top:12px">
          <div class="ft-head">
            <span class="ti">${iconDef.icon}</span>
            <div class="ft-meta"><div class="lab">${esc(L.room || "")}</div><div class="ft-name">${esc(splitTeam(iconDef.name).base)}</div>${teamTag(iconDef.name, "nm-team ft-team")}</div>
            <span class="ft-badge">${rvTeam.count}/${capOf(myIcon)}</span>
          </div>
          <div style="font-weight:800;font-size:12.5px;color:var(--muted);margin:12px 0 6px">${esc(L.roommates || "")}</div>
          <ol class="ft-list">${mates}</ol>
        </div>
        <button type="button" id="rvNotMe" style="margin-top:12px;width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;font:inherit;cursor:pointer">${esc(L.notMe || "Không phải tôi / nhập tên khác")}</button>`;
      // Lối thoát: gõ nhầm / trùng tên người khác ⇒ thoát xem, nhập lại tên. Không mở lại quyền chọn (lookup cùng tên vẫn ra remote view).
      // me.fields = {} ⇒ profileValid()=false ⇒ popup KHÔNG có nút Huỷ (canCancel) và lưới khoá (ready=false): nếu giữ hồ sơ cũ thì Huỷ ⇒ editing=false ⇒ lần render realtime kế tiếp mở lại 7 tile cho tên ĐÃ đăng ký.
      $("rvNotMe").onclick = () => { remoteView = false; myIcon = null; me.fields = {}; editing = true; saveMe(); renderProfile(); renderState(); };
    } else {
      bannerWrapEl.innerHTML = `<div class="banner" style="--c:${iconDef.color}">
        <span class="bi">${iconDef.icon}</span>
        <div>
          <div class="bt">${TEXT.banner.title(iconDef.name)}</div>
          <div class="bs">${TEXT.banner.sub}</div>
        </div></div>`;
    }
  } else {
    bannerWrapEl.innerHTML = "";
  }

  const ready = profileValid() && !editing;

  // ── Đội còn chỗ (count < CAPACITY) ──
  const grid = $("grid"); grid.innerHTML = "";
  let open = 0;
  let openForMe = 0;   // đội còn chỗ mà mình vào ĐƯỢC theo giới tính (phòng đúng giới hoặc phòng chung)
  let tileIndex = 0;
  // Đã biết giới & chưa vào phòng ⇒ phòng ĐÚNG giới lên đầu, phòng chung ở giữa, phòng khác giới (bị khoá) xuống cuối.
  const genderRank = ic => { const g = roomGender(ic.icon); return !g ? 1 : (g === myGender ? 0 : 2); };
  const shownIcons = (myGender && !myIcon) ? ICONS.slice().sort((a, b) => genderRank(a) - genderRank(b)) : ICONS;
  shownIcons.forEach(iconDef => {
    const team = teamOf(iconDef.icon);
    const cap  = capOf(iconDef.icon);          // sĩ số RIÊNG của đội (nếu có) ngược lại CAPACITY chung
    if (team.count >= cap) return;             // đủ người → biến mất khỏi lưới này
    open++;
    const mine    = iconDef.icon === myIcon;
    // PHÂN PHÒNG THEO GIỚI: phòng gắn giới KHÁC giới của mình (theo danh sách cho phép) ⇒ khoá. myGender chỉ có
    // giá trị khi bật ALLOWLIST_GENDERCHECK; phòng không gắn giới / mình chưa rõ giới ⇒ không khoá (fail-open).
    const roomG   = roomGender(iconDef.icon);
    const gLocked = !myIcon && !!myGender && !!roomG && roomG !== myGender;
    if (!gLocked) openForMe++;
    const canJoin = ready && !myIcon && !inRemoteView() && !dupBlocked && !allowBlocked && !gLocked; // chưa có đội & không bị chặn (trùng / ngoài danh sách / khác giới) mới được tham gia
    const pct     = Math.round(team.count / cap * 100);
    const avatarChips = team.names.slice(0, AVATAR_PREVIEW_MAX).map(n => `<span class="mini">${esc(initial(n))}</span>`).join("")
                  + (team.count > AVATAR_PREVIEW_MAX ? `<span class="mini more">+${team.count - AVATAR_PREVIEW_MAX}</span>` : "")
                  || `<span class="mini empty">·</span>`;
    const label   = !ready ? TEXT.grid.tileFill
                  : myIcon ? (mine ? TEXT.grid.tileMine : TEXT.grid.tileOther)
                  : gLocked ? TEXT.grid.tileGender(roomG)
                  : TEXT.grid.tileJoin;

    const tileEl = document.createElement("div");
    tileEl.className = "tile " + (canJoin ? "sel" : "disabled") + (mine ? " mine" : "") + (gLocked ? " gender-lock" : "");
    tileEl.style.setProperty("--c", iconDef.color);
    tileEl.style.animationDelay = (tileIndex * 0.035) + "s";
    tileIndex++;
    const genderTag = (ALLOWLIST_GENDERCHECK && roomG)
      ? `<div class="g-tag ${roomG === GENDER_OPTIONS[0] ? "g-m" : "g-f"}">${esc(TEXT.grid.roomTag(roomG))}</div>` : "";
    tileEl.innerHTML = `${genderTag}
      <div class="ic">${iconDef.icon}</div>
      <div class="nm">${splitTeam(iconDef.name).base}</div>${teamTag(iconDef.name, "nm-team")}
      <div class="cap">${team.count}/${cap}</div>
      <div class="cap-bar"><span style="width:${pct}%"></span></div>
      <div class="avas">${avatarChips}</div>
      <button class="pick ${canJoin ? "" : "lock"}">${label}</button>`;
    if (canJoin) {
      const act = () => askConfirm(iconDef);
      tileEl.onclick = e => { if (!e.target.closest("button")) act(); };
      tileEl.querySelector(".pick").onclick = e => { e.stopPropagation(); act(); };
    }
    grid.appendChild(tileEl);
  });
  layoutFreeGrid();   // chia đều số cột theo số đội còn chỗ hiện tại (vd 10 → 5/5)
  $("freeHead").textContent  = TEXT.grid.headOpen;
  $("freeCount").textContent = TEXT.grid.count(open, ICONS.length);
  $("freeHint").innerHTML    = (!profileComplete() && open > 0) ? `<div class="hint">${TEXT.grid.hint}</div>`
    // Còn đội trống nhưng KHÔNG đội nào hợp giới của mình → nói rõ (thay vì để lưới toàn ô bị khoá không lời giải thích).
    : (ready && !myIcon && myGender && open > 0 && openForMe === 0) ? `<div class="hint">${TEXT.grid.genderFull(myGender)}</div>`
    : "";
  // open === 0 ⇒ MỌI đội đã đủ người → màn hình "hoàn thành" nổi bật (chỉ khi đã tải state thật
  // từ server, tránh chớp nhoáng lúc mới vào trang khi state chưa về).
  $("freeEmpty").innerHTML = (stateLoaded && open === 0)
    ? `<div class="all-full" role="status">
         <div class="af-burst">
           <svg class="af-check" viewBox="0 0 80 80" fill="none" aria-hidden="true">
             <circle cx="40" cy="40" r="36" fill="#E7F8EE" stroke="#16A34A" stroke-width="3"/>
             <path d="M25 41.5 35.5 52 56 30" stroke="#16A34A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
           <span class="af-spark s1">✦</span><span class="af-spark s2">✧</span>
           <span class="af-spark s3">✦</span><span class="af-spark s4">✧</span>
         </div>
         <div class="af-title">${TEXT.grid.allFullTitle}</div>
         <div class="af-sub">${TEXT.grid.allFullSub(ICONS.length)}</div>
       </div>`
    : "";

  // ── Đội đã có người (count >= 1) — hiện CẢ đội ĐANG GHÉP lẫn ĐÃ ĐỦ ──
  // Trước đây chỉ liệt kê đội đủ người; nay có người join là roster hiện ngay ở đây.
  // Sắp xếp: đủ người (full) lên trước, rồi theo số thành viên giảm dần; hoà điểm thì
  // giữ thứ tự ICONS gốc (ổn định — không nhảy chỗ mỗi lần render).
  const takenEl = $("taken"); takenEl.innerHTML = "";
  const withMembers = ICONS
    .map((iconDef, idx) => ({ iconDef, idx, team: teamOf(iconDef.icon) }))
    .filter(o => o.team.count >= 1)
    .sort((a, b) => {
      const af = a.team.count >= capOf(a.iconDef.icon), bf = b.team.count >= capOf(b.iconDef.icon);
      if (af !== bf) return af ? -1 : 1;                                    // đủ người lên đầu
      if (b.team.count !== a.team.count) return b.team.count - a.team.count; // đông hơn lên trước
      return a.idx - b.idx;                                                 // bằng nhau → giữ thứ tự gốc
    });
  withMembers.forEach(({ iconDef, team }, i) => {
    const mine = iconDef.icon === myIcon;
    const cap  = capOf(iconDef.icon);                    // sĩ số riêng đội (nếu có) ngược lại CAPACITY chung
    const full = team.count >= cap;                      // đủ người = "đã đủ"; còn lại = "đang ghép"
    let highlightedMe = false;
    const memberItems = team.names.map((n, j) => {
      const isMe = mine && me.fields.name && n === me.fields.name && !highlightedMe;
      if (isMe) highlightedMe = true;
      return `<li class="${isMe ? 'is-me' : ''}"><span class="no">${j + 1}</span>${esc(n || "—")}</li>`;
    }).join("");
    const teamEl = document.createElement("div");
    teamEl.className = "full-team " + (full ? "is-full" : "is-forming") + (mine ? " mine" : "");
    teamEl.style.setProperty("--c", iconDef.color);
    teamEl.style.animationDelay = (i * 0.045) + "s";
    const ftG = ALLOWLIST_GENDERCHECK ? roomGender(iconDef.icon) : "";
    const ftGenderTag = ftG ? ` <span class="g-tag ${ftG === GENDER_OPTIONS[0] ? "g-m" : "g-f"}">${esc(TEXT.grid.roomTag(ftG))}</span>` : "";
    teamEl.innerHTML = `
      <div class="ft-head">
        <span class="ti">${iconDef.icon}</span>
        <div class="ft-meta"><div class="lab">${full ? `${LOCK_SVG}${TEXT.grid.ftLocked}` : TEXT.grid.ftForming}</div><div class="ft-name">${splitTeam(iconDef.name).base}${ftGenderTag}</div>${teamTag(iconDef.name, "nm-team ft-team")}</div>
        <span class="ft-badge">${team.count}/${cap}${mine ? TEXT.grid.ftYou : ""}</span>
      </div>
      <ol class="ft-list">${memberItems}</ol>`;
    takenEl.appendChild(teamEl);
  });
  $("takenHead").textContent  = TEXT.grid.headFull;
  $("takenCount").textContent = TEXT.grid.count(withMembers.length, ICONS.length);   // đếm đội CÓ người (gồm đang ghép)
  $("takenEmpty").innerHTML   = withMembers.length === 0 ? `<div class="empty-note">${EMPTY_SVG}${TEXT.grid.takenEmpty(CAPACITY)}</div>` : "";
}
