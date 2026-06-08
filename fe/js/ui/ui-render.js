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

// Hằng số hiển thị (§4 — chống magic number)
const AVATAR_PREVIEW_MAX = 5;     // số avatar hiện ở mỗi tile trước khi gộp thành "+N"
const CONFETTI_COUNT     = 28;    // số mảnh confetti trong popup chúc mừng
const RESIZE_DEBOUNCE_MS = 120;   // debounce tính lại số cột lưới khi resize cửa sổ

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
    const metaBits = FIELDS.filter(f => f.key !== "name").map(f => me.fields[f.key]).filter(Boolean).join("  ·  ");
    profileBoxEl.innerHTML = `
      <div class="summary">
        <div class="ava" style="background:${myIcon ? byEmoji[myIcon].color : 'var(--accent)'}">${initial(me.fields.name)}</div>
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
    let taken = false;
    if (!myIcon && typeof apiDedupTaken === "function") {   // đã vào đội ⇒ mã dedup là của CHÍNH MÌNH, đừng tự coi là trùng rồi xoá hồ sơ
      try { taken = await apiDedupTaken(me.fields[DEDUP_FIELD]); } catch (e) {}
    }
    if (btn) { btn.disabled = false; btn.textContent = TEXT.profile.start; }
    if (taken) {
      dupBlocked = true;
      if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id);   // dọn signup trùng nếu lỡ lưu ở phiên trước (lúc MSNV còn trống)
      renderProfile();            // dupBlocked && !myIcon && !editing → hiện modal chặn (KHÔNG ghi data)
      return;
    }
    dupBlocked = false;

    // CỔNG danh sách cho phép — SAU cổng dedup: MSNV không trong danh sách → chặn, KHÔNG ghi hồ sơ.
    // apiAllowlistInfo trả {allowed, name}: name = tên đã đăng ký (để đối chiếu họ tên ngay bên dưới).
    let allow = { allowed: true, name: "" };
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
  if (canCancel) $("pmCancel").onclick = () => { editing = false; closeProfileModal(() => renderProfile()); };
  // CHỦ ĐÍCH: không gắn sự kiện click nền / Esc → popup không thể bỏ qua khi chưa hợp lệ.

  FIELDS.forEach(f => {
    const inp = $("f_" + f.key);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
    inp.addEventListener("input",   () => { $("m_" + f.key).textContent = ""; inp.classList.remove("bad"); });
  });
  if (showBoot) {
    setTimeout(() => {
      const modalEl = modalBgEl.querySelector(".profile-modal");
      if (modalEl) modalEl.classList.remove("tech-booting");
      const firstInputEl = $("f_" + FIELDS[0].key);
      if (firstInputEl) firstInputEl.focus();
    }, 1050);
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
      <p>${TEXT.dup.body(esc(fieldLabel))}</p>
      <div class="row"><button class="confirm" id="dupBack">${TEXT.dup.btn}</button></div>
    </div>`;
  document.body.appendChild(modalBgEl);
  $("dupBack").onclick = () => { dismissModal(modalBgEl, () => { editing = true; renderProfile(); }); };
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
      <div class="row"><button class="confirm" id="allowBack">${TEXT.allow.btn}</button></div>
    </div>`;
  document.body.appendChild(modalBgEl);
  $("allowBack").onclick = () => { dismissModal(modalBgEl, () => { editing = true; renderProfile(); }); };
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
  if (!_skipSelfHeal && stateLoaded && myIcon && teamOf(myIcon).count === 0) { myIcon = null; saveMe(); renderProfile(); }

  // banner đội của mình
  const bannerWrapEl = $("bannerWrap");
  if (myIcon) {
    const iconDef = byEmoji[myIcon];
    bannerWrapEl.innerHTML = `<div class="banner" style="--c:${iconDef.color}">
        <span class="bi">${iconDef.icon}</span>
        <div>
          <div class="bt">${TEXT.banner.title(iconDef.name)}</div>
          <div class="bs">${TEXT.banner.sub}</div>
        </div></div>`;
  } else {
    bannerWrapEl.innerHTML = "";
  }

  const ready = profileValid() && !editing;

  // ── Đội còn chỗ (count < CAPACITY) ──
  const grid = $("grid"); grid.innerHTML = "";
  let open = 0;
  let tileIndex = 0;
  ICONS.forEach(iconDef => {
    const team = teamOf(iconDef.icon);
    if (team.count >= CAPACITY) return;        // đủ người → biến mất khỏi lưới này
    open++;
    const mine    = iconDef.icon === myIcon;
    const canJoin = ready && !myIcon && !dupBlocked && !allowBlocked; // chưa có đội & không bị chặn (trùng / ngoài danh sách) mới được tham gia
    const pct     = Math.round(team.count / CAPACITY * 100);
    const avatarChips = team.names.slice(0, AVATAR_PREVIEW_MAX).map(n => `<span class="mini">${esc(initial(n))}</span>`).join("")
                  + (team.count > AVATAR_PREVIEW_MAX ? `<span class="mini more">+${team.count - AVATAR_PREVIEW_MAX}</span>` : "")
                  || `<span class="mini empty">·</span>`;
    const label   = !ready ? TEXT.grid.tileFill : (myIcon ? (mine ? TEXT.grid.tileMine : TEXT.grid.tileOther) : TEXT.grid.tileJoin);

    const tileEl = document.createElement("div");
    tileEl.className = "tile " + (canJoin ? "sel" : "disabled") + (mine ? " mine" : "");
    tileEl.style.setProperty("--c", iconDef.color);
    tileEl.style.animationDelay = (tileIndex * 0.035) + "s";
    tileIndex++;
    tileEl.innerHTML = `
      <div class="ic">${iconDef.icon}</div>
      <div class="nm">${iconDef.name}</div>
      <div class="cap">${team.count}/${CAPACITY}</div>
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
  $("freeHint").innerHTML    = (!profileComplete() && open > 0) ? `<div class="hint">${TEXT.grid.hint}</div>` : "";
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

  // ── Đội đã đủ (count >= CAPACITY) — liệt kê đủ thành viên ──
  const takenEl = $("taken"); takenEl.innerHTML = "";
  let done = 0;
  let doneIndex = 0;
  ICONS.forEach(iconDef => {
    const team = teamOf(iconDef.icon);
    if (team.count < CAPACITY) return;
    done++;
    const mine = iconDef.icon === myIcon;
    const memberItems = team.names.map((n, i) => `<li><span class="no">${i + 1}</span>${esc(n || "—")}</li>`).join("");
    const teamEl = document.createElement("div");
    teamEl.className = "full-team" + (mine ? " mine" : "");
    teamEl.style.setProperty("--c", iconDef.color);
    teamEl.style.animationDelay = (doneIndex * 0.045) + "s";
    doneIndex++;
    teamEl.innerHTML = `
      <div class="ft-head">
        <span class="ti">${iconDef.icon}</span>
        <div class="ft-meta"><div class="lab">${TEXT.grid.ftLabel}</div><div class="ft-name">${iconDef.name}</div></div>
        <span class="ft-badge">${team.count}/${CAPACITY}${mine ? TEXT.grid.ftYou : ""}</span>
      </div>
      <ol class="ft-list">${memberItems}</ol>`;
    takenEl.appendChild(teamEl);
  });
  $("takenHead").textContent  = TEXT.grid.headFull;
  $("takenCount").textContent = TEXT.grid.count(done, ICONS.length);
  $("takenEmpty").innerHTML   = done === 0 ? `<div class="empty-note">${EMPTY_SVG}${TEXT.grid.takenEmpty(CAPACITY)}</div>` : "";
}
