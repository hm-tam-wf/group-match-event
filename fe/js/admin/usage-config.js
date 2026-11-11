// Cấu hình thẻ "Mức dùng Firestore" ở tab Tổng quan của admin — cách bật: documentation/USAGE-MONITORING.md
//
// oauthClientId: OAuth 2.0 Client ID loại "Web application" của Google Cloud project (dạng 123-abc.apps.googleusercontent.com).
//   KHÔNG phải bí mật (trang nào có nút Đăng nhập Google cũng lộ ra): chỉ dùng được trên các origin đã khai trong Google Cloud,
//   với tài khoản được cho phép, và chỉ xem được project mà tài khoản đó có quyền. Để trống ⇒ thẻ hiện hướng dẫn, không gọi Google.
//
// Khoá tuỳ chọn — ghi đè mặc định trong js/admin/usage-core.js (DEFAULTS), ví dụ:
//   pricePer100k: { reads: 0.06, writes: 0.18, deletes: 0.02 },  // USD / 100.000 thao tác. Mặc định là mức TRẦN phổ biến của
//                                                                // Firestore, CHƯA xác minh cho vùng asia-southeast1 của project:
//                                                                // sửa theo https://cloud.google.com/firestore/pricing (chọn Singapore)
//   historyDays: 7,          // số ngày quota đã qua trên biểu đồ
//   checkBilling: true,      // false ⇒ không xin quyền billing, không biết gói Spark/Blaze
//   loginHint: "",           // email Google gợi ý sẵn khi kết nối
window.ADMIN_USAGE_CONFIG = {
  oauthClientId: ""
};
