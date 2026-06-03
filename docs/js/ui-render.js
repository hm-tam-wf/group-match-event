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

// ── Hồ sơ người chơi ───────────────────────────────────────────────
// Đã có thông tin hợp lệ → thanh tóm tắt inline. Chưa có (token mới) → popup, không cho bỏ qua.
function renderProfile() {
  const box  = $("profile");

  // CỔNG chống trùng: MSNV đã đăng ký & chưa vào đội & không đang sửa → chặn cứng, không cho vào lưới.
  if (dupBlocked && !myIcon && !editing) {
    closeProfileModal();
    box.innerHTML = "";
    showDupBlockedModal();
    return;
  }

  const done = profileComplete() && !editing;

  if (done) {
    closeProfileModal();
    const metaBits = FIELDS.filter(f => f.key !== "name").map(f => me.fields[f.key]).filter(Boolean).join("  ·  ");
    box.innerHTML = `
      <div class="summary">
        <div class="ava" style="background:${myIcon ? byEmoji[myIcon].color : 'var(--accent)'}">${initial(me.fields.name)}</div>
        <div class="s-txt">
          <span class="nm">${esc(me.fields.name) || "Người chơi"}</span>
          <span class="meta">${esc(metaBits)}</span>
        </div>
        <div class="s-spacer"></div>
      </div>`;
    // Tính năng "Sửa thông tin" đã TẮT theo yêu cầu: điền xong là KHOÁ hồ sơ, không cho sửa nữa.
    // (Ngoại lệ: bị chặn trùng MSNV vẫn còn "Nhập mã khác" trong showDupBlockedModal để nhập lại,
    //  nếu không người gõ nhầm mã sẽ bị kẹt vĩnh viễn ở màn hình chặn.)
    return;
  }

  box.innerHTML = "";        // không còn form inline — dùng popup bên dưới
  showProfileModal();
}

function closeProfileModal() {
  const m = $("profileModal");
  if (m) m.remove();
}

// Popup nhập thông tin. canCancel = đang SỬA thông tin đã hợp lệ (cho phép quay lại);
// với token mới (chưa hợp lệ) thì KHÔNG có nút huỷ và KHÔNG đóng bằng click nền/Esc.
function showProfileModal() {
  if ($("profileModal")) return;          // tránh mở chồng
  const canCancel = profileComplete();

  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.id = "profileModal";
  bg.innerHTML = `
    <div class="modal profile-modal">
      <div class="pm-emoji">🐾</div>
      <h3>Chào bạn!</h3>
      <p>Điền một chút thông tin để bắt đầu tham gia đội của bạn nhé.</p>
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
        ${canCancel ? `<button class="cancel" id="pmCancel">Quay lại</button>` : ""}
        <button class="confirm" id="pmSave">Bắt đầu tham gia đội →</button>
      </div>
    </div>`;
  document.body.appendChild(bg);

  const save = async () => {
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
    apiSaveProfile({ playerId: me.id, fields: me.fields });   // đồng bộ hồ sơ lên server NGAY (kể cả khi chưa chọn đội / bị chặn trùng)

    // CỔNG chống trùng: MSNV đã được đăng ký rồi → KHÔNG cho vào trang chọn linh thú.
    const btn = $("pmSave");
    if (btn) { btn.disabled = true; btn.textContent = "Đang kiểm tra…"; }
    let taken = false;
    if (typeof apiDedupTaken === "function") {
      try { taken = await apiDedupTaken(me.fields[DEDUP_FIELD]); } catch (e) {}
    }
    if (btn) { btn.disabled = false; btn.textContent = "Bắt đầu tham gia đội →"; }
    if (taken) {
      dupBlocked = true;
      renderProfile();            // dupBlocked && !myIcon && !editing → hiện modal chặn
      return;
    }
    dupBlocked = false;

    closeDupBlockedModal();
    closeProfileModal();
    renderProfile();
    renderStateIfChanged(true);
    toast("Đã lưu thông tin. Giờ hãy chọn 1 đội để tham gia 👇");
  };

  $("pmSave").onclick = save;
  if (canCancel) $("pmCancel").onclick = () => { editing = false; closeProfileModal(); renderProfile(); };
  // CHỦ ĐÍCH: không gắn sự kiện click nền / Esc → popup không thể bỏ qua khi chưa hợp lệ.

  FIELDS.forEach(f => {
    const inp = $("f_" + f.key);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
    inp.addEventListener("input",   () => { $("m_" + f.key).textContent = ""; inp.classList.remove("bad"); });
  });
  const first = $("f_" + FIELDS[0].key);
  if (first) setTimeout(() => first.focus(), 40);
}

// Modal CHẶN khi MSNV đã đăng ký rồi — không thể bỏ qua (không click nền/Esc), chỉ cho "Nhập mã khác".
// Đây là cổng chặn vào trang chọn đội: trùng MSNV ⇒ không vào được lưới linh thú.
function showDupBlockedModal() {
  if ($("dupBlockedModal")) return;
  const lbl = labelOf(DEDUP_FIELD);
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.id = "dupBlockedModal";
  bg.innerHTML = `
    <div class="modal">
      <div class="mic">🔒</div>
      <h3>Mã này đã đăng ký rồi</h3>
      <p><b>${esc(lbl)}</b> bạn nhập đã được dùng để tham gia một đội (kể cả trên thiết bị khác).<br>
         Mỗi mã chỉ tham gia <b>một lần</b>.</p>
      <div class="row"><button class="confirm" id="dupBack">Nhập mã khác</button></div>
    </div>`;
  document.body.appendChild(bg);
  $("dupBack").onclick = () => { bg.remove(); editing = true; renderProfile(); };
}

function closeDupBlockedModal() {
  const m = $("dupBlockedModal");
  if (m) m.remove();
}

// ── Popup chúc mừng sau khi vào đội thành công ─────────────────────
// Giữ phong cách modal sẵn có (.modal-bg/.modal/.confirm) + confetti. Emoji con vật
// của đội (g.icon, loại cũ 🦊🐉…) hiển thị tốt nên giữ nguyên trong popup.
function showJoinedModal(g) {
  $("toast").classList.remove("show");   // dẹp toast "Đang ghi nhận…" dính trước đó (toast z-index cao hơn modal)

  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `
    <div class="modal joined-modal" style="--c:${g.color}">
      <div class="confetti">${"<i></i>".repeat(28)}</div>
      <div class="jm-icon">${g.icon}</div>
      <h3>Chúc mừng! 🎉</h3>
      <p>Bạn đã tham gia <b>đội ${esc(g.name)}</b>.<br>Hẹn gặp bạn cùng đồng đội nhé!</p>
      <div class="row"><button class="confirm" id="jmOk">Tuyệt vời!</button></div>
    </div>`;
  document.body.appendChild(bg);

  // confetti ngẫu nhiên màu/vị trí/thời gian
  const colors = ["#FF7AC0","#A98CFF","#7DD3FC","#4dd47a","#ffe14d","#ffb13d"];
  bg.querySelectorAll(".confetti i").forEach((p, i) => {
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = (1.2 + Math.random() * 1.2) + "s";
    p.style.animationDelay = (Math.random() * 0.4) + "s";
  });

  // close() gỡ CẢ listener keydown ở cả 3 lối đóng (nút / click nền / Esc) → không rò listener.
  const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
  function onKey(e) { if (e.key === "Escape") close(); }
  bg.querySelector("#jmOk").onclick = close;
  bg.addEventListener("click", e => { if (e.target === bg) close(); });
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
  const n = grid.children.length;
  const cs      = getComputedStyle(grid);
  const minTile = parseFloat(cs.getPropertyValue("--min-tile")) || 168;
  const gap     = parseFloat(cs.columnGap) || 16;
  const w       = grid.clientWidth;
  const maxFit  = Math.max(1, Math.floor((w + gap) / (minTile + gap)));
  // ≤ 1 hàng (n ≤ maxFit) → để CSS auto-fill: tile giữ bề ngang tự nhiên, canh trái — KHÔNG
  // kéo giãn 1–2 đội còn lại chiếm cả chiều ngang. Chỉ chia đều khi tràn sang nhiều hàng.
  if (n === 0 || n <= maxFit) { grid.style.gridTemplateColumns = ""; return; }
  const cols = balancedColumns(n, maxFit);
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
}

// Co giãn cửa sổ → tính lại số cột (debounce nhẹ). Số tile lấy từ DOM nên không cần state.
let _layoutTimer;
window.addEventListener("resize", () => {
  clearTimeout(_layoutTimer);
  _layoutTimer = setTimeout(layoutFreeGrid, 120);
});

function renderState() {
  // myIcon còn hợp lệ? Chỉ mở khoá khi ĐÃ tải được state thật từ server và đội đó thực sự rỗng
  // (tránh xoá nhầm khi state chưa tải xong / fetch lỗi lúc mới vào trang).
  if (!_skipSelfHeal && stateLoaded && myIcon && teamOf(myIcon).count === 0) { myIcon = null; saveMe(); renderProfile(); }

  // banner đội của mình
  const bw = $("bannerWrap");
  if (myIcon) {
    const g = byEmoji[myIcon];
    bw.innerHTML = `<div class="banner" style="--c:${g.color}">
        <span class="bi">${g.icon}</span>
        <div>
          <div class="bt">Bạn đang ở đội ${g.name} ${g.icon}</div>
          <div class="bs">Đã ghi nhận thông tin của bạn. Mỗi người chỉ tham gia 1 đội.</div>
        </div></div>`;
  } else {
    bw.innerHTML = "";
  }

  const ready = profileComplete() && !editing;

  // ── Đội còn chỗ (count < CAPACITY) ──
  const grid = $("grid"); grid.innerHTML = "";
  let open = 0;
  ICONS.forEach(g => {
    const tm = teamOf(g.icon);
    if (tm.count >= CAPACITY) return;        // đủ người → biến mất khỏi lưới này
    open++;
    const mine    = g.icon === myIcon;
    const canJoin = ready && !myIcon && !dupBlocked; // chưa có đội & không bị chặn trùng mới được tham gia
    const pct     = Math.round(tm.count / CAPACITY * 100);
    const avas    = tm.names.slice(0, 5).map(n => `<span class="mini">${esc(initial(n))}</span>`).join("")
                  + (tm.count > 5 ? `<span class="mini more">+${tm.count - 5}</span>` : "")
                  || `<span class="mini empty">·</span>`;
    const label   = !ready ? "Điền thông tin" : (myIcon ? (mine ? "Đội của bạn" : "Đã có đội") : "Tham gia");

    const t = document.createElement("div");
    t.className = "tile " + (canJoin ? "sel" : "disabled") + (mine ? " mine" : "");
    t.style.setProperty("--c", g.color);
    t.innerHTML = `
      <div class="ic">${g.icon}</div>
      <div class="nm">${g.name}</div>
      <div class="cap">${tm.count}/${CAPACITY}</div>
      <div class="cap-bar"><span style="width:${pct}%"></span></div>
      <div class="avas">${avas}</div>
      <button class="pick ${canJoin ? "" : "lock"}">${label}</button>`;
    if (canJoin) {
      const act = () => askConfirm(g);
      t.onclick = e => { if (!e.target.closest("button")) act(); };
      t.querySelector(".pick").onclick = e => { e.stopPropagation(); act(); };
    }
    grid.appendChild(t);
  });
  layoutFreeGrid();   // chia đều số cột theo số đội còn chỗ hiện tại (vd 10 → 5/5)
  $("freeCount").textContent = `${open}/${ICONS.length} đội`;
  $("freeHint").innerHTML    = (!profileComplete() && open > 0) ? `<div class="hint">→ Điền thông tin để mở khoá việc tham gia đội.</div>` : "";
  $("freeEmpty").innerHTML   = open === 0 ? `<div class="empty-note">${EMPTY_SVG}Tất cả các đội đều đã đủ người 🎉</div>` : "";

  // ── Đội đã đủ (count >= CAPACITY) — liệt kê đủ thành viên ──
  const tk = $("taken"); tk.innerHTML = "";
  let done = 0;
  ICONS.forEach(g => {
    const tm = teamOf(g.icon);
    if (tm.count < CAPACITY) return;
    done++;
    const mine = g.icon === myIcon;
    const lis  = tm.names.map((n, i) => `<li><span class="no">${i + 1}</span>${esc(n || "—")}</li>`).join("");
    const el = document.createElement("div");
    el.className = "full-team" + (mine ? " mine" : "");
    el.style.setProperty("--c", g.color);
    el.innerHTML = `
      <div class="ft-head">
        <span class="ti">${g.icon}</span>
        <div class="ft-meta"><div class="lab">Đội</div><div class="ft-name">${g.name}</div></div>
        <span class="ft-badge">${tm.count}/${CAPACITY}${mine ? " · bạn" : ""}</span>
      </div>
      <ol class="ft-list">${lis}</ol>`;
    tk.appendChild(el);
  });
  $("takenCount").textContent = `${done}/${ICONS.length} đội`;
  $("takenEmpty").innerHTML   = done === 0 ? `<div class="empty-note">${EMPTY_SVG}Chưa có đội nào đủ ${CAPACITY} người. Cùng rủ thêm bạn nào!</div>` : "";
}
