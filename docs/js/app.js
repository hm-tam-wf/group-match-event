function askConfirm(g) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" style="--c:${g.color}">
      <div class="mic">${g.icon}</div>
      <h3>Tham gia đội ${esc(g.name)}?</h3>
      <p>Mỗi người chỉ tham gia 1 đội (tối đa ${CAPACITY} người/đội). Xác nhận xong sẽ ghi nhận thông tin của bạn.</p>
      <div class="row">
        <button class="cancel"  id="c0">Quay lại</button>
        <button class="confirm" id="c1">Xác nhận</button>
      </div>
    </div>`;
  document.body.appendChild(bg);
  bg.querySelector("#c0").onclick   = () => bg.remove();
  bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); });
  bg.querySelector("#c1").onclick   = async () => { bg.remove(); await doClaim(g); };
}

async function doClaim(g) {
  if (busy) { toast("Đang xử lý lượt tham gia của bạn…"); return; }   // bấm lúc đang ghi nhận → báo, không câm
  busy = true;
  document.body.classList.add("claiming");      // khoá mọi tile trong lúc ghi nhận
  toast("Đang ghi nhận…", true);                // toast dính: apiClaim có thể retry vài giây
  try {
    const res = await apiClaim({ icon: g.icon, playerId: me.id, fields: me.fields });
    if (res && res.ok) {
      myIcon = g.icon;
      _skipSelfHeal = true;
      await saveMe();
      showJoinedModal(g);         // popup chúc mừng + confetti (thay toast nhỏ)
      renderProfile();            // khoá "Sửa thông tin" ngay lập tức
      renderStateIfChanged(true); // khoá toàn bộ tile ngay lập tức
    } else {
      const r = res && res.reason;
      if      (r === "full")      toast(`Đội ${g.name} vừa đủ ${CAPACITY} người rồi!`);
      else if (r === "already")   toast("Bạn đã tham gia một đội rồi.");
      else if (r === "dup")     { dupBlocked = true; toast(`${labelOf(DEDUP_FIELD)} này đã được đăng ký rồi (kể cả trên thiết bị khác). Mỗi mã chỉ tham gia một lần.`); }
      // apiClaim đã retry vài lần mới tới đây → KHÔNG đổ "đội đầy", chỉ là mạng đang đông.
      else                        toast("Mạng hơi đông, chưa tham gia được. Bạn thử lại nhé.");
    }
    await refresh(true);
    renderProfile();
  } catch (err) {
    // mạng trục trặc — kiểm tra lại bằng poll
    toast("Đang kiểm tra kết quả…");
    await refresh(true);
  } finally {
    document.body.classList.remove("claiming");
    _skipSelfHeal = false;
    busy = false;
  }
}

// Chữ ký dữ liệu: chỉ render lại khi sĩ số/tên đội/myIcon/editing/hồ-sơ thực sự đổi → chống nhấp nháy
function computeSig() {
  const t = Object.keys(state).sort()
    .map(ic => ic + ":" + state[ic].count + ":" + (state[ic].names || []).join(","))
    .join("|");
  return t + "||" + (myIcon || "") + "|" + (editing ? 1 : 0) + "|" + (profileComplete() ? 1 : 0) + "|" + (stateLoaded ? 1 : 0);
}
function renderStateIfChanged(force) {
  const sig = computeSig();
  if (force || sig !== lastSig) { lastSig = sig; renderState(); }
}

async function refresh(force) {
  // fetch lỗi (mạng chập chờn / Apps Script khởi động nguội) → GIỮ NGUYÊN state lần trước,
  // KHÔNG coi là rỗng → tránh xoá nhầm đội đã tham gia khi tải lại trang.
  try { state = await apiState(); stateLoaded = true; } catch (e) { /* giữ state cũ */ }
  renderStateIfChanged(force);
}

async function loadMe() {
  try {
    const raw = await sGet("me", false);
    if (raw) { const o = JSON.parse(raw); me = o.me || me; myIcon = o.myIcon || null; }
  } catch (e) {}
}

async function saveMe() {
  await sSet("me", JSON.stringify({ me, myIcon }), false);
}

// ── Hàm init(): chạy SAU KHI boot() đã nạp xong config từ Firestore ──────────
async function init() {
  await loadMe();
  // token định danh: tạo 1 lần, lưu localStorage → nhớ qua các lần tải lại trang
  if (!me.id) { me.id = "u" + Math.random().toString(36).slice(2, 10); me.fields = me.fields || {}; await saveMe(); }

  // CỔNG chống trùng NGAY KHI VÀO TRANG: đã có hồ sơ nhưng CHƯA vào đội & MSNV đã đăng ký rồi
  // → chặn vào lưới chọn linh thú (kể cả khi đăng ký ở thiết bị khác). apiClaim vẫn là chốt cuối.
  if (MODE === "firebase" && !myIcon && profileComplete()
      && BLOCK_DUP && DEDUP_FIELD && typeof apiDedupTaken === "function") {
    dupBlocked = await apiDedupTaken(me.fields[DEDUP_FIELD]);
  }

  // Người đã điền thông tin từ trước (kể cả CHƯA/không chọn đội) → đồng bộ lên server để admin có data.
  if (MODE === "firebase" && profileComplete() && typeof apiSaveProfile === "function") {
    apiSaveProfile({ playerId: me.id, fields: me.fields });
  }

  renderProfile();         // token mới → bật popup; đã thông tin → tóm tắt / banner; trùng MSNV → modal chặn
  await refresh(true);
  if (MODE === "firebase" && typeof apiSubscribe === "function") {
    // realtime: server tự ĐẨY thay đổi của các đội → KHÔNG poll. onSnapshot tự kết nối lại
    // và đồng bộ khi online trở lại, nên rẻ nhất mà vẫn tức thì.
    apiSubscribe(teams => { if (busy) return; state = teams; stateLoaded = true; renderStateIfChanged(false); });
  } else {
    setInterval(() => { if (!busy) refresh(); }, POLL_MS); // poll ngầm 3s (sheet/demo)
  }
}

// ── boot(): điểm vào duy nhất — nạp config Firestore rồi mới chạy init() ─────
(async function boot() {
  if (MODE !== "firebase") {
    // Demo/sheet: dùng DEFAULT_* đã có sẵn, chạy thẳng
    rebuildByEmoji();
    await init();
    return;
  }

  // Hiện trạng thái loading
  const appLoading  = document.getElementById("appLoading");
  const noEvent     = document.getElementById("noEvent");
  const appError    = document.getElementById("appError");
  const appContent  = document.getElementById("appContent");

  function showMsg(el, html) {
    if (appLoading) appLoading.hidden = true;
    if (noEvent)    noEvent.hidden    = true;
    if (appError)   appError.hidden   = true;
    if (appContent) appContent.hidden = true;
    if (el) { el.hidden = false; if (html) el.innerHTML = html; }
  }

  try {
    // ── Bước 1: lấy sự kiện đang mở ──
    const activeSnap = await db.collection("config").doc("active").get();
    if (!activeSnap.exists || !activeSnap.data().eventId) {
      showMsg(noEvent);
      return;
    }
    EVENT_ID = String(activeSnap.data().eventId).trim();
    if (!EVENT_ID) { showMsg(noEvent); return; }

    // ── Bước 2: lấy cấu hình sự kiện ──
    const cfgSnap = await db.collection("events").doc(EVENT_ID)
                             .collection("meta").doc("config").get();
    if (!cfgSnap.exists) { showMsg(noEvent); return; }

    const cfg = cfgSnap.data();
    if (Array.isArray(cfg.fields)   && cfg.fields.length)   FIELDS      = cfg.fields;
    if (Array.isArray(cfg.icons)    && cfg.icons.length)    ICONS       = cfg.icons;
    if (typeof cfg.capacity   === "number")                 CAPACITY    = cfg.capacity;
    if (typeof cfg.dedupField === "string")                 DEDUP_FIELD = cfg.dedupField;
    if (typeof cfg.blockDup   === "boolean")                BLOCK_DUP   = cfg.blockDup;

    // Đổ title / subtitle vào DOM
    if (cfg.title) {
      const h1 = document.querySelector("#appContent h1");
      if (h1) h1.textContent = cfg.title;
    }
    if (cfg.subtitle) {
      const sub = document.querySelector("#appContent .sub");
      if (sub) sub.innerHTML = cfg.subtitle;
    }

    rebuildByEmoji();

    // ── Hiện nội dung chính, chạy app ──
    if (appLoading) appLoading.hidden = true;
    if (appContent) appContent.hidden = false;
    await init();

  } catch (e) {
    // Lỗi mạng hoặc Firestore không phản hồi
    const msg = "Lỗi tải cấu hình sự kiện. Vui lòng thử lại.";
    showMsg(appError, msg);
  }
})();
