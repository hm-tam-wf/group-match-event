// ============================================================================
// home-strings.js — chữ TĨNH của trang home (fe/home.html) theo ngôn ngữ.
// Nội dung sự kiện (tiêu đề, lịch trình…) KHÔNG ở đây — nằm trong events/{id}/meta/home.
// Ngôn ngữ chọn theo ?lang= → meta/config.profile.lang → defaultLang của biến thể → "en" (xem home.js).
// en/vi PHẢI cùng bộ key. Chuỗi có tham số = hàm. Chỉ lộ 1 tên toàn cục: HomeStrings.
// ============================================================================
(function (root) {
  'use strict';
  root.HomeStrings = {
    vi: {
      docTitle: 'Thông tin sự kiện',
      loaderBrand: 'THÔNG TIN SỰ KIỆN',
      loaderSteps: ['Đang tìm sự kiện...', 'Đang tải lịch trình...', 'Đang chuẩn bị nội dung...'],
      loaderReady: 'Sẵn sàng! 🚀',
      navAria: 'Mục lục trang',
      scheduleCta: 'Xem lịch trình',
      roomsCta: 'Vào trang đăng ký',
      backToTop: 'Đầu trang',
      backToTopAria: 'Lên đầu trang',
      colorsLabel: 'Tone màu gợi ý:',
      tipLabel: 'Mẹo:',
      infoTitle: 'Phương tiện & điểm tập trung',
      contactsTitle: 'Liên hệ Ban Tổ Chức',
      callTitle: name => `Gọi ${name}`,
      msg: {
        noEventTitle: 'Không tìm thấy sự kiện',
        noEventText: 'Liên kết không đúng hoặc sự kiện chưa được mở. Hãy kiểm tra lại đường dẫn Ban Tổ Chức gửi.',
        noHomeTitle: 'Chưa có trang thông tin',
        noHomeText: 'Ban Tổ Chức chưa đăng nội dung cho sự kiện này.',
        noHomeCta: 'Đến trang đăng ký',
        netTitle: 'Không tải được dữ liệu',
        netText: 'Kiểm tra kết nối mạng rồi thử lại.',
        retry: 'Thử lại',
      },
    },
    en: {
      docTitle: 'Event information',
      loaderBrand: 'EVENT GUIDE',
      loaderSteps: ['Finding the event...', 'Loading the schedule...', 'Preparing the page...'],
      loaderReady: 'Ready! 🚀',
      navAria: 'Page contents',
      scheduleCta: 'Full schedule',
      roomsCta: 'Go to sign-up',
      backToTop: 'Top',
      backToTopAria: 'Back to top',
      colorsLabel: 'Suggested colors:',
      tipLabel: 'Tip:',
      infoTitle: 'Transport & meeting point',
      contactsTitle: 'Organizer contacts',
      callTitle: name => `Call ${name}`,
      msg: {
        noEventTitle: 'Event not found',
        noEventText: 'The link is wrong or the event is not open yet. Please check the link from the organizers.',
        noHomeTitle: 'No information page yet',
        noHomeText: 'The organizers have not published this page yet.',
        noHomeCta: 'Go to the event page',
        netTitle: 'Could not load data',
        netText: 'Check your connection and try again.',
        retry: 'Try again',
      },
    },
  };
})(typeof self !== 'undefined' ? self : this);
