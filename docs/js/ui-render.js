// ── Hồ sơ người chơi ───────────────────────────────────────────────
// Đã có thông tin hợp lệ → thanh tóm tắt inline. Chưa có (token mới) → popup, không cho bỏ qua.
function renderProfile() {
  const box  = $("profile");
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
        ${myIcon ? "" : `<button class="linkbtn" id="editBtn">Sửa thông tin</button>`}
      </div>`;
    const eb = $("editBtn");
    if (eb) eb.onclick = () => { editing = true; renderProfile(); };
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

// ── Bảng đội (vẽ lại mỗi khi dữ liệu đổi) ──────────────────────────
function teamOf(icon) { return state[icon] || { count: 0, names: [] }; }

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
    const canJoin = ready && !myIcon;        // chưa có đội mới được tham gia
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
  $("freeCount").textContent = `${open}/${ICONS.length} đội`;
  $("freeHint").innerHTML    = (!profileComplete() && open > 0) ? `<div class="hint">→ Điền thông tin để mở khoá việc tham gia đội.</div>` : "";
  $("freeEmpty").innerHTML   = open === 0 ? `<div class="empty-note">Tất cả các đội đều đã đủ người 🎉</div>` : "";

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
  $("takenEmpty").innerHTML   = done === 0 ? `<div class="empty-note">Chưa có đội nào đủ ${CAPACITY} người. Cùng rủ thêm bạn nào!</div>` : "";
}
