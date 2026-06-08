// ============================================================================
//  STRINGS theo THEME — text CHỈ dùng cho 1 theme cụ thể (KHÔNG dùng-chung)
// ----------------------------------------------------------------------------
//  Tách RIÊNG khỏi config.js để chuỗi riêng-theo-theme không lẫn với registry
//  dùng-chung (boot/profile/grid…). Merge vào STRINGS hiện có → dùng qua
//  TEXT.<theme>.* ở ui-render/app (TEXT là tham chiếu tới STRINGS[LANG] nên
//  thấy ngay phần merge thêm).
//
//  THỨ TỰ NẠP: ngay SAU config.js (cần STRINGS đã tồn tại), TRƯỚC ui-render.js.
//  Chỉ index.html nạp file này — admin.html KHÔNG dùng terminal boot.
//
//  Quy ước i18n giữ nguyên ([[i18n-system]]): chuỗi tĩnh = string; chuỗi nội
//  suy = HÀM đối số rõ ràng. en/vi PHẢI cùng shape (parity).
// ============================================================================
(function () {
  if (typeof STRINGS === "undefined") return;   // an toàn nếu nạp sai thứ tự / ngoài browser

  // Theme `tech`: màn "khởi động terminal" của popup nhập thông tin.
  // Chỉ render khi data-theme="tech" và token chưa hợp lệ (xem showProfileModal).
  STRINGS.en.tech = {
    appTitle: "Pick Your Squad — Faraday",   // brand hiển thị của theme tech (tab title + H1 mặc định); app.js boot áp khi data-theme=tech
    terminalLine1: "Hellow world...",
    terminalLine2: (title) => `Welcome to ${title}`,
    terminalLine3: "Establishing secure protocols...",
    terminalLine4: "STATUS: READY [ACCESS GRANTED]",
  };
  STRINGS.vi.tech = {
    appTitle: "Pick Your Squad — Faraday",   // brand không dịch — giữ nguyên ở mọi ngôn ngữ
    terminalLine1: "Hellow world...",
    terminalLine2: (title) => `Xin chào bạn đến với ${title}`,
    terminalLine3: "Đang thiết lập giao thức bảo mật...",
    terminalLine4: "STATUS: READY [ACCESS GRANTED]",
  };
})();
