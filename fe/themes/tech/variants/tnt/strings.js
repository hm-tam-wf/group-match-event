// ============================================================================
//  BIẾN THỂ "tnt" của theme tech — COPY (chữ) cho sự kiện Mini Outing · TNT
// ----------------------------------------------------------------------------
//  Nguồn: file BTC "MINI MINI MINI.pdf" (chuỗi của PDF giữ NGUYÊN VĂN) + đề xuất cho chỗ PDF không nhắc
//  (mọi "Squad/đội" → "phòng"). Chỉ chạy khi ACTIVE_VARIANT === "tnt" (theme.js: cờ DEFAULT_VARIANT
//  hoặc ?variant=tnt) ⇒ INERT với mọi sự kiện khác.
//
//  THỨ TỰ NẠP: ngay SAU themes/tech/strings.js (cần STRINGS.vi.tech), TRƯỚC firebase-config/ui-*/app.
//  Làm 2 việc:
//   1) Chuyển cả trang sang TIẾNG VIỆT (trừ khi URL chỉ định ?lang=en|vi): gán lại LANG/TEXT (config.js khai `let`).
//   2) Ghi đè copy trong STRINGS.vi theo từng namespace (key không nhắc tới giữ nguyên bản gốc).
//  QUY TẮC: key gốc là HÀM thì bản ghi đè cũng phải là HÀM (call site gọi TEXT.x.y(args)) — truyền string sẽ
//  TypeError làm vỡ popup. Chuỗi còn được gán qua textContent (profile.start) phải là text thuần: "&" chứ không "&amp;".
// ============================================================================
(function () {
  if (typeof STRINGS === "undefined" || typeof ACTIVE_VARIANT === "undefined" || ACTIVE_VARIANT !== "tnt") return;

  // 1) Sự kiện này chạy tiếng Việt. ?lang=en|vi trên URL vẫn thắng (để test/so sánh).
  try {
    const langParam = new URLSearchParams(location.search).get("lang");
    if (langParam !== "en" && langParam !== "vi") {
      LANG = "vi";
      TEXT = STRINGS.vi;
      document.documentElement.lang = "vi";
    }
  } catch (e) {}

  // Tên phòng do admin đặt có thể đã mở đầu bằng "Phòng" (vd "Phòng 101") → tránh "phòng Phòng 101".
  const hasRoomWord = (name) => /^phòng\s/i.test(String(name || "").trim());
  const room = (name) => hasRoomWord(name) ? name : `phòng ${name}`;   // giữa câu
  const Room = (name) => hasRoomWord(name) ? name : `Phòng ${name}`;   // đầu câu

  const COPY = {
    tech: {
      appTitle:      "Trạm Tìm Bạn Chung Chăn Gối — TNT",                // ĐX: tab trình duyệt (H1 do admin đặt)
      terminalLine1: "Hello các công nhân sự kiện Shinichi...",          // PDF
      terminalLine2: () => "Welcome to Tìm người chung chăn gối!",       // PDF — HÀM (gốc nhận title), cố ý bỏ qua title
      terminalLine3: "Hệ thống đang thiết lập tìm kiếm Roommate...",     // PDF
      terminalLine4: "Trạng thái: Sẵn sàng [Đã cấp quyền truy cập]",     // PDF
    },
    profile: {
      greeting: "Welcome to Trạm Tìm Bạn Chung Chăn Gối!",               // PDF
      subtitle: "Định danh công nhân sự kiện để được cấp quyền lựa chọn Roommate.",   // PDF
      start:    "Xác Nhận & Chọn Phòng Ngay!",                           // PDF
      saved:    "Đã định danh xong! Giờ chọn phòng thôi 👇",             // ĐX
    },
    confirm: {
      title: (name) => `Chốt kèo Roommate ${room(name)}?`,              // PDF
      body:  () => "Mỗi công nhân sự kiện chỉ được gửi gắm thân xác 1 lần duy nhất. Bấm xác nhận đồng nghĩa với việc chấp nhận mọi tật xấu, tiếng ngáy hay nết ngủ của cạ này mà không được trả hàng!",   // PDF
      back:  "Từ Từ, Sợ Quá",                                            // PDF
      ok:    "Chốt liền luôn",                                           // PDF
    },
    celebrate: {
      title: "Thành công tìm bạn chung chăn!",                           // PDF
      body:  () => "Hệ thống đã ghi nhận danh tính của bạn, hãy tỏa ra aura bá khí thật vững vàng để gặp gỡ roommate của mình và tuyệt đối không được khiếu nại hay đổi trả người.",   // PDF
      ok:    "Lên Đồ Đi Mini Outing Thôi!",                              // PDF
    },
    banner: {
      title: (name) => `Bạn đã chốt ${room(name)}`,                     // ĐX
      sub:   "Đã chốt cạ cứng — không thể quay đầu.",                    // ĐX
    },
    grid: {                                                              // ĐX (PDF không nhắc) — "đội" → "phòng"
      headOpen:     "Phòng còn giường",
      headFull:     "Danh sách roommate",
      count:        (shown, total) => `${shown}/${total} phòng`,
      hint:         "→ Định danh để mở khoá chọn phòng.",
      tileMine:     "Phòng của bạn",
      tileOther:    "Đã có phòng",
      tileJoin:     "Chọn phòng",
      allFullTitle: "Tất cả phòng đã kín giường! 🎉",
      allFullSub:   (total) => `Cả ${total} phòng đều đã khoá cửa. Hẹn gặp ở Mini Outing nhé!`,
      ftForming:    "Đang gom người",
      ftLocked:     "Đã khoá cửa",
      takenEmpty:   () => "Chưa phòng nào có người. Nhanh tay chốt cạ nào!",   // bỏ tham số capacity: mỗi phòng có số giường riêng
      tileGender:   (gender) => `Chỉ dành cho ${gender}`,
      genderFull:   (gender) => `Các phòng ${gender} đã kín giường — liên hệ BTC nếu cần hỗ trợ.`,
    },
    toast: {                                                             // ĐX
      already:        "Bạn đã chốt phòng rồi — không thể quay đầu.",
      full:           (name) => `${Room(name)} vừa đủ người — đã khoá cửa!`,
      genderMismatch: (gender) => `Phòng này chỉ dành cho ${gender}.`,
    },
    dup: {                                                               // ĐX — như bản gốc, "đội" → "phòng"
      body: (label) => `<b>${label}</b> bạn nhập đã được dùng để chốt phòng — <b>có thể ở thiết bị hoặc trình duyệt khác</b>. Mỗi mã chỉ chốt <b>một lần</b>.<br>Nếu là bạn, hãy mở lại trên thiết bị đã đăng ký.`,
    },
  };
  Object.keys(COPY).forEach(ns => { STRINGS.vi[ns] = Object.assign(STRINGS.vi[ns] || {}, COPY[ns]); });
})();
