function askConfirm(iconDef) {
  const modalBgEl = document.createElement("div");
  modalBgEl.className = "modal-bg";
  modalBgEl.innerHTML = `<div class="modal" style="--c:${iconDef.color}">
      <div class="mic">${iconDef.icon}</div>
      <h3>${TEXT.confirm.title(esc(iconDef.name))}</h3>
      <p>${TEXT.confirm.body(CAPACITY)}</p>
      <div class="row">
        <button class="cancel"  id="c0">${TEXT.confirm.back}</button>
        <button class="confirm" id="c1">${TEXT.confirm.ok}</button>
      </div>
    </div>`;
  document.body.appendChild(modalBgEl);
  modalBgEl.querySelector("#c0").onclick   = () => dismissModal(modalBgEl);
  modalBgEl.addEventListener("click", e => { if (e.target === modalBgEl) dismissModal(modalBgEl); });
  modalBgEl.querySelector("#c1").onclick   = () => { dismissModal(modalBgEl, () => doClaim(iconDef)); };
}

// Hoạt ảnh "vào" của popup mừng (jmPop .6s là dài nhất — xem styles.css §181). Việc vẽ
// lại nền (lấy state thật + rebuild lưới) bị HOÃN tới sau mốc này để khung hình popup
// không bị giật do reflow đè lên lớp backdrop-blur (xem ghi chú trong nhánh join OK).
const JOIN_POPUP_SETTLE_MS = 600;

async function doClaim(iconDef) {
  if (busy) { toast(TEXT.toast.processing); return; }   // bấm lúc đang ghi nhận → báo, không câm
  busy = true;
  document.body.classList.add("claiming");      // khoá mọi tile trong lúc ghi nhận
  toast(TEXT.toast.saving, true);                // toast dính: apiClaim có thể retry vài giây
  let joined = false;   // join OK ⇒ nhánh tự quản hoãn-render & nhả-khoá → finally BỎ QUA
  try {
    const res = await apiClaim({ icon: iconDef.icon, playerId: me.id, fields: me.fields });
    if (res && res.ok) {
      myIcon = iconDef.icon;
      _skipSelfHeal = true;
      await saveMe();
      // Vẽ lưới/banner về trạng thái ĐÃ KHOÁ *trước* khi mở popup: lúc này chưa có lớp
      // .modal-bg{backdrop-filter:blur} phủ lên, nên reflow của renderState (layoutFreeGrid
      // đọc clientWidth/getComputedStyle = ép layout đồng bộ) KHÔNG phải đua với hoạt ảnh
      // → triệt nhịp giật thứ nhất.
      renderProfile();            // khoá "Sửa thông tin" ngay lập tức
      renderStateIfChanged(true); // khoá toàn bộ tile ngay lập tức
      // Popup vẽ ĐÈ lên nền đã tĩnh → entrance (fade/popIn/jmPop) chạy mượt.
      showJoinedModal(iconDef);         // popup chúc mừng + confetti (thay toast nhỏ)
      joined = true;              // từ đây nhánh join tự nhả khoá trong setTimeout bên dưới
      // HOÃN lấy state thật + vẽ lại tới SAU khi popup vào xong: rebuild lưới lần 2 sau lớp
      // backdrop-blur giữa chừng chính là nhịp giật thứ hai. Giữ busy=true suốt cửa sổ này
      // để chặn luôn render realtime (apiSubscribe). Lưới bị popup che ⇒ cập nhật trễ vô hình.
      setTimeout(async () => {
        try {
          await refresh(true);      // state thật từ server (sĩ số chuẩn)
          renderProfile();
        } finally {
          document.body.classList.remove("claiming");
          _skipSelfHeal = false;
          busy = false;
        }
      }, JOIN_POPUP_SETTLE_MS);
    } else {
      const reason = res && res.reason;
      if      (reason === REASON.FULL)      toast(TEXT.toast.full(iconDef.name, CAPACITY));
      else if (reason === REASON.ALREADY)   toast(TEXT.toast.already);
      else if (reason === REASON.DUP)     { dupBlocked = true; if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id); toast(TEXT.toast.dup(labelOf(DEDUP_FIELD))); }   // thua đua join → dọn signup trùng của mình
      else if (reason === REASON.NOT_ALLOWED) { allowBlocked = true; if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id); toast(TEXT.toast.notAllowed); }   // ngoài danh sách → bật cổng chặn + dọn hồ sơ (renderProfile bên dưới hiện modal)
      else if (reason === REASON.NAME_MISMATCH) { editing = true; toast(TEXT.toast.nameMismatch); }   // tên lệch danh sách → mở lại popup để sửa (renderProfile cuối doClaim)
      else if (reason === REASON.DEDUP_CONFIG) toast(TEXT.toast.dupConfig);   // chống trùng bật mà không lấy được giá trị để dedup (cấu hình sai) → báo rõ, KHÔNG cho join trùng
      else if (reason === REASON.MISSING)   toast(TEXT.toast.missing);   // claim thiếu name (vd cấu hình sai key) → báo rõ, KHÔNG đổ "mạng đông"
      // apiClaim đã retry vài lần mới tới đây → KHÔNG đổ "đội đầy", chỉ là mạng đang đông.
      else                        toast(TEXT.toast.network);
      await refresh(true);
      renderProfile();
    }
  } catch (err) {
    // mạng trục trặc — kiểm tra lại bằng poll
    toast(TEXT.toast.checkingResult);
    await refresh(true);
  } finally {
    if (!joined) {            // nhánh join OK tự nhả khoá trong setTimeout ở trên
      document.body.classList.remove("claiming");
      _skipSelfHeal = false;
      busy = false;
    }
  }
}

// Chữ ký dữ liệu: chỉ render lại khi sĩ số/tên đội/myIcon/editing/hồ-sơ thực sự đổi → chống nhấp nháy
function computeSig() {
  const teamsSig = Object.keys(state).sort()
    .map(ic => ic + ":" + state[ic].count + ":" + (state[ic].names || []).join(","))
    .join("|");
  return teamsSig + "||" + (myIcon || "") + "|" + (editing ? 1 : 0) + "|" + (profileComplete() ? 1 : 0) + "|" + (stateLoaded ? 1 : 0);
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
    const raw = await sGet(SK.ME, false);
    if (raw) { const saved = JSON.parse(raw); me = saved.me || me; myIcon = saved.myIcon || null; }
  } catch (e) {}
}

async function saveMe() {
  await sSet(SK.ME, JSON.stringify({ me, myIcon }), false);
}

// ── Hàm init(): chạy SAU KHI boot() đã nạp xong config từ Firestore ──────────
async function init() {
  await loadMe();
  // (Nút đổi theme đã CHUYỂN sang admin.html — trang công khai không cho end-user đổi giao diện.)
  // RESET THEO "THẾ HỆ" DỮ LIỆU: admin "Xóa dữ liệu" sẽ tăng meta/config.dataEpoch. Nếu server MỚI HƠN lần ghé
  // trước ⇒ localStorage cũ (RESERVED_KEY giữ chỗ + myIcon đã chọn đội) đã LỖI THỜI: khóa chống trùng trên server
  // đã bị xóa nhưng máy này vẫn tưởng "chỗ của mình". Nhả hết để vào lại như mới (GIỮ me.fields — khỏi gõ lại).
  // Bịt lỗ: sau khi Xóa dữ liệu, máy chủ cũ short-circuit "chỗ mình" cho qua mà MSNV bỏ ngỏ → máy khác đăng ký trùng.
  if (MODE === MODE_FIREBASE) {
    const seenEpoch = Number(await sGet(SK.DATA_EPOCH, false)) || 0;
    if (DATA_EPOCH > seenEpoch) {
      myIcon = null;                          // đội cũ đã bị xóa ⇒ bỏ chọn (người dùng chọn lại)
      await sDel(SK.RESERVED_KEY, false);     // nhả chỗ giữ cũ ⇒ apiRegReserve sẽ TẠO LẠI khóa thật trên server
      await saveMe();
      await sSet(SK.DATA_EPOCH, String(DATA_EPOCH), false);
    }
  }

  // token định danh: tạo 1 lần, lưu localStorage → nhớ qua các lần tải lại trang
  if (!me.id) { me.id = "u" + Math.random().toString(36).slice(2, 10); me.fields = me.fields || {}; await saveMe(); await sDel(SK.RESERVED_KEY, false); }   // danh tính MỚI ⇒ NHẢ reservedKey cũ (bịt lỗ H2: nếu "me" bị xoá nhưng reservedKey còn sót → cổng trùng short-circuit "chỗ của mình" cho qua nhầm)

  // CỔNG chống trùng NGAY KHI VÀO TRANG: đã có hồ sơ nhưng CHƯA vào đội & MSNV đã đăng ký rồi
  // → chặn vào lưới chọn linh thú (kể cả khi đăng ký ở thiết bị khác). apiClaim vẫn là chốt cuối.
  // Hai lớp: dedup_keys (đã JOIN) HOẶC reg_keys (đã GIỮ CHỖ lúc điền form, không phải chỗ của mình).
  if (MODE === MODE_FIREBASE && !myIcon && profileComplete() && BLOCK_DUP && DEDUP_FIELD) {
    if (typeof apiDedupTaken === "function")
      dupBlocked = await apiDedupTaken(me.fields[DEDUP_FIELD]);
    if (!dupBlocked && typeof apiRegTaken === "function")
      dupBlocked = await apiRegTaken(me.fields[DEDUP_FIELD]);
  }

  // CỔNG danh sách cho phép NGAY KHI VÀO TRANG: bật allowlist & MSNV KHÔNG nằm trong danh sách
  // → chặn vào lưới chọn đội (giống cổng chống trùng). apiClaim vẫn là chốt cuối.
  if (MODE === MODE_FIREBASE && !myIcon && !dupBlocked && profileComplete()
      && ALLOWLIST_MODE && DEDUP_FIELD && typeof apiAllowlistAllowed === "function") {
    allowBlocked = !(await apiAllowlistAllowed(me.fields[DEDUP_FIELD]));
  }

  // Đồng bộ hồ sơ lên server để admin có data (kể cả CHƯA chọn đội). NHƯNG nếu bị chặn (trùng MSNV
  // hoặc ngoài danh sách cho phép) thì KHÔNG lưu — và DỌN bản ghi của mình nếu đã lỡ lưu ở phiên
  // trước. Khớp với cổng chặn ở save()/doClaim.
  if (MODE === MODE_FIREBASE && profileComplete()) {
    if (dupBlocked || allowBlocked) {
      if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id);
    } else {
      // ĐẶT-CHỖ TRƯỚC KHI GHI (giống save()) — đóng lỗ: trước đây init() ghi signup qua apiSaveProfile
      // mà KHÔNG đặt-chỗ → hồ sơ điền ở phiên trước (vd trước khi deploy) được ghi lại không có reg_keys
      // → người trùng MSNV sau đó không bị chặn. Đã join (myIcon) thì bỏ qua, chỉ đồng bộ lại hồ sơ.
      let reserved = { ok: true };
      if (!myIcon && BLOCK_DUP && DEDUP_FIELD && typeof apiRegReserve === "function") {
        try { reserved = await apiRegReserve(me.fields[DEDUP_FIELD]); } catch (e) {}
      }
      if (reserved && reserved.ok === false) {
        dupBlocked = true;                                                  // người khác đã giữ MSNV này
        if (typeof apiRemoveProfile === "function") apiRemoveProfile(me.id);
      } else if (typeof apiSaveProfile === "function") {
        apiSaveProfile({ playerId: me.id, fields: me.fields });
      }
    }
  }

  renderProfile();         // token mới → bật popup; đã thông tin → tóm tắt / banner; trùng MSNV → modal chặn
  await refresh(true);
  if (MODE === MODE_FIREBASE && typeof apiSubscribe === "function") {
    // realtime: server tự ĐẨY thay đổi của các đội → KHÔNG poll. onSnapshot tự kết nối lại
    // và đồng bộ khi online trở lại, nên rẻ nhất mà vẫn tức thì.
    apiSubscribe(teams => { if (busy) return; state = teams; stateLoaded = true; renderStateIfChanged(false); });
  } else {
    setInterval(() => { if (!busy) refresh(); }, POLL_MS); // poll ngầm 3s (sheet/demo)
  }

  // Remove initial-load class after entrance animations complete
  setTimeout(() => {
    document.body.classList.remove("initial-load");
  }, 1200);
}

// ── boot(): điểm vào duy nhất — nạp config Firestore rồi mới chạy init() ─────
(async function boot() {
  if (MODE !== MODE_FIREBASE) {
    // Cấu hình CÓ projectId (định chạy firebase) nhưng SDK chưa nạp được (CDN lỗi/offline) → FIREBASE_ON
    // false ⇒ âm thầm rơi về DEMO (đội + dedup chỉ còn cục bộ per-browser ⇒ MẤT chống trùng cross-browser).
    // FAIL-CLOSED: báo lỗi rõ thay vì degrade lặng lẽ. (Muốn chạy demo/sheet thật thì để TRỐNG projectId.)
    if (typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG.projectId && !FIREBASE_ON) {
      const appLoadingEl = document.getElementById("appLoading");
      const appErrorEl   = document.getElementById("appError");
      if (appLoadingEl) appLoadingEl.hidden = true;
      if (appErrorEl) { appErrorEl.hidden = false; appErrorEl.innerHTML = TEXT.boot.errLoad; }
      return;
    }
    // Demo/sheet: dùng DEFAULT_* đã có sẵn, chạy thẳng
    rebuildByEmoji();
    // Demo/sheet KHÔNG qua bước nạp config Firestore (nơi nhánh firebase ẩn loading + hiện nội dung) →
    // tự tay làm ở đây, nếu không demo kẹt vĩnh viễn ở màn "Loading event…" với #appContent vẫn hidden.
    const demoLoadingEl = document.getElementById("appLoading");
    const demoContentEl = document.getElementById("appContent");
    if (demoLoadingEl) demoLoadingEl.hidden = true;
    if (demoContentEl) demoContentEl.hidden = false;
    await init();
    return;
  }

  // Hiện trạng thái loading
  const appLoading  = document.getElementById("appLoading");
  const noEvent     = document.getElementById("noEvent");
  const appError    = document.getElementById("appError");
  const appContent  = document.getElementById("appContent");

  // i18n: đồng bộ chữ màn boot theo LANG (HTML tĩnh trong index.html là fallback pre-JS)
  if (appLoading) appLoading.textContent = TEXT.boot.loading;
  if (noEvent)    noEvent.innerHTML      = TEXT.boot.noEvent;

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
    if (typeof cfg.dataEpoch  === "number")                 DATA_EPOCH  = cfg.dataEpoch;
    if (typeof cfg.allowlistMode === "boolean")             ALLOWLIST_MODE = cfg.allowlistMode;
    if (typeof cfg.allowlistNameCheck === "boolean")        ALLOWLIST_NAMECHECK = cfg.allowlistNameCheck;

    // CHẶN CỨNG cấu hình lỗi: app cần MỘT field key "name" (apiClaim + ui-render dùng me.fields.name
    // để hiển thị tên trong danh sách đội). Thiếu → người chơi vào được lưới nhưng KHÔNG join được
    // (claim trả "missing"). Báo rõ NGAY thay vì để lỗi khó hiểu ở bước chọn đội.
    if (!FIELDS.some(f => f && f.key === "name")) {
      showMsg(appError, TEXT.boot.errNoName);
      return;
    }

    // CHẶN CỨNG cấu hình chống trùng SAI: bật chống trùng (blockDup) mà dedupField KHÔNG trỏ tới field nhập
    // nào → apiClaim sẽ có dedupVal rỗng ⇒ chốt trùng bị BỎ QUA (đúng lỗ khiến 2 trình duyệt cùng MSNV cùng
    // lọt). FAIL-CLOSED: báo lỗi cấu hình, KHÔNG cho vào lưới (an toàn hơn là để lọt đăng ký trùng).
    if (BLOCK_DUP && DEDUP_FIELD && !FIELDS.some(f => f && f.key === DEDUP_FIELD)) {
      showMsg(appError, TEXT.boot.errDedupField);
      return;
    }

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
    const msg = TEXT.boot.errLoad;
    showMsg(appError, msg);
  }
})();
