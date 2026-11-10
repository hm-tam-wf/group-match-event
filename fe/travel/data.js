// ============================================================================
// fe/travel/data.js — NGUỒN DỮ LIỆU TẬP TRUNG CHO TRANG CHUYẾN ĐI (TRAVEL)
// ----------------------------------------------------------------------------
// Toàn bộ nội dung chuyến đi (tiêu đề, thời gian, lịch trình từng ngày,
// lưu ý, dress code, xe cộ, liên hệ) đặt tập trung tại đây.
// Khi cần thay đổi thông tin chuyến đi, CHỈ CẦN SỬA FILE NÀY, không đụng HTML.
// ============================================================================

window.TRAVEL_DATA = {
  tripInfo: {
    badge: "COMPANY TRIP 2026",
    title: "TRẠM NGHỈ DƯỠNG TNT",
    tagline: "Hành Trình Bứt Phá — Gắn Kết & Tái Tạo Năng Lượng",
    dates: "15.04 – 17.04.2026",
    duration: "3 Ngày 2 Đêm",
    location: "Phan Thiết — Mũi Né",
    resort: "Centara Mirage Resort Mui Ne"
  },

  cta: {
    schedule: {
      text: "Full lịch trình",
      icon: "calendar",
      target: "#schedule"
    },
    rooms: {
      text: "Chọn phòng",
      icon: "bed",
      url: "index.html"
    }
  },

  nav: [
    { id: "sec-timeline", label: "Lịch trình tổng", icon: "🗓️" },
    { id: "sec-notes", label: "Lưu ý chuyến đi", icon: "📌" },
    { id: "sec-dresscode", label: "Lưu ý trang phục", icon: "👕" },
    { id: "sec-transport", label: "Thông tin di chuyển", icon: "🚌" }
  ],

  // 1. LỊCH TRÌNH TỔNG (TIMELINE) THEO NGÀY
  timeline: [
    {
      id: "day-1",
      dayLabel: "NGÀY 01",
      date: "15/04/2026",
      title: "Khởi Hành & Check-in Resort",
      summary: "Tập trung tại trụ sở, di chuyển đến Phan Thiết, thưởng thức ẩm thực miền biển và nhận phòng nghỉ ngơi.",
      events: [
        {
          time: "05:30",
          title: "Tập trung tại công ty",
          desc: "Tập trung tại sảnh chính, điểm danh theo danh sách phòng, nhận bánh mì & nước suối ăn sáng.",
          tag: "Tập trung",
          icon: "📍"
        },
        {
          time: "06:00",
          title: "Xe khởi hành đi Phan Thiết",
          desc: "Bắt đầu hành trình qua cao tốc Dầu Giây - Phan Thiết. Giao lưu, minigame nhận quà khởi động trên xe.",
          tag: "Di chuyển",
          icon: "🚌"
        },
        {
          time: "08:30",
          title: "Dừng chân nghỉ ngơi & Vệ sinh cá nhân",
          desc: "Nghỉ ngơi 20 phút tại trạm dừng chân cao tốc.",
          tag: "Nghỉ ngơi",
          icon: "☕"
        },
        {
          time: "11:30",
          title: "Đến Phan Thiết — Dùng bữa trưa",
          desc: "Thưởng thức set menu hải sản tươi sống tại Nhà hàng Cây Bàng Mũi Né.",
          tag: "Ẩm thực",
          icon: "🍽️"
        },
        {
          time: "14:00",
          title: "Check-in Centara Mirage Resort",
          desc: "Nhận chìa khóa phòng theo danh sách đã đăng ký trên hệ thống. Tự do sắp xếp hành lý và nghỉ ngơi.",
          tag: "Khách sạn",
          icon: "🏖️"
        },
        {
          time: "16:00",
          title: "Tự do trải nghiệm tiện ích Resort",
          desc: "Tắm biển riêng, check-in hồ bơi vô cực tràn bờ 3 tầng, công viên nước hoặc chèo thuyền kayak.",
          tag: "Tự do",
          icon: "🏊"
        },
        {
          time: "18:30",
          title: "Tiệc BBQ Nướng bờ biển",
          desc: "Thưởng thức tiệc buffet BBQ hải sản ngoài trời ngắm hoàng hôn, âm nhạc acoustic nhẹ nhàng.",
          tag: "Tiệc tối",
          icon: "🔥"
        },
        {
          time: "21:00",
          title: "Tự do khám phá Mũi Né về đêm",
          desc: "Trải nghiệm phố hải sản Bờ Kè Mũi Né, cà phê ngắm biển hoặc quẩy cùng cạ cứng tại phòng.",
          tag: "Nghỉ ngơi",
          icon: "🌙"
        }
      ]
    },
    {
      id: "day-2",
      dayLabel: "NGÀY 02",
      date: "16/04/2026",
      title: "Teambuilding Bãi Biển & Gala Dinner",
      summary: "Ngày tâm điểm với chuỗi trò chơi Teambuilding bùng nổ năng lượng và đêm dạ tiệc Gala Dinner sắc màu.",
      events: [
        {
          time: "06:30 – 08:00",
          title: "Buffet sáng tại nhà hàng Mundo",
          desc: "Nạp năng lượng với buffet Á - Âu đa dạng tại nhà hàng chính của resort.",
          tag: "Ẩm thực",
          icon: "🍳"
        },
        {
          time: "08:30",
          title: "Check-in Đồi Cát Bay (Đồi Cát Đỏ)",
          desc: "Xe đưa đoàn tham quan, trượt cát, trải nghiệm mô tô địa hình và chụp ảnh lưu niệm toàn công ty.",
          tag: "Khám phá",
          icon: "📸"
        },
        {
          time: "11:30",
          title: "Dùng bữa trưa tại nhà hàng địa phương",
          desc: "Thưởng thức đặc sản lẩu thả Phan Thiết và nghỉ trưa tại resort.",
          tag: "Ẩm thực",
          icon: "🍲"
        },
        {
          time: "15:00",
          title: "Tập trung tại bãi biển resort",
          desc: "Khởi động và phổ biến luật chơi Teambuilding bãi biển.",
          tag: "Teambuilding",
          icon: "⚡"
        },
        {
          time: "15:30 – 17:30",
          title: "Teambuilding: 'VƯỢT SÓNG ĐẠI DƯƠNG'",
          desc: "Chuỗi 4 trạm game đồng đội: Tiếp Sức Vượt Cạn, Bánh Xe Thần Tốc, Mạng Nhện Siêu Đẳng, Chiến Hạm Khải Hoàn.",
          tag: "Teambuilding",
          icon: "🏆"
        },
        {
          time: "18:30",
          title: "Đón khách & Check-in thảm đỏ Gala Dinner",
          desc: "Chụp ảnh photobooth theo concept 'Neon Cyber Night', nhận vé may mắn Lucky Draw.",
          tag: "Gala Dinner",
          icon: "✨"
        },
        {
          time: "19:00 – 22:00",
          title: "Đêm tiệc GALA DINNER: BỪNG SẮC ĐÊM NAY",
          desc: "Khai mạc tiệc, trao giải Teambuilding, các tiết mục văn nghệ cây nhà lá vườn bùng nổ, Lucky Draw giải thưởng giá trị.",
          tag: "Gala Dinner",
          icon: "🎤"
        }
      ]
    },
    {
      id: "day-3",
      dayLabel: "NGÀY 03",
      date: "17/04/2026",
      title: "Thư Giãn, Mua Quà & Khởi Hành Về",
      summary: "Thảnh thơi đón bình minh, mua sắm đặc sản Phan Thiết và trở về điểm xuất phát an toàn.",
      events: [
        {
          time: "07:00 – 08:30",
          title: "Buffet sáng & Thư giãn tự do",
          desc: "Thưởng thức bữa sáng, dạo biển sớm, tắm hồ bơi hoặc spa thư giãn.",
          tag: "Nghỉ ngơi",
          icon: "☕"
        },
        {
          time: "09:30 – 10:30",
          title: "Dọn dẹp hành lý & Check-out",
          desc: "Kiểm tra kỹ tư trang cá nhân, gửi lại chìa khóa phòng tại quầy lễ tân.",
          tag: "Check-out",
          icon: "🧳"
        },
        {
          time: "11:00",
          title: "Mua sắm đặc sản Mũi Né",
          desc: "Dừng chân tại trung tâm đặc sản: nước mắm Phan Thiết truyền thống, mực một nắng, thanh long sấy.",
          tag: "Mua sắm",
          icon: "🛍️"
        },
        {
          time: "12:00",
          title: "Bữa trưa chia tay",
          desc: "Dùng bữa trưa ấm cúng trước khi lên xe về lại TP.HCM.",
          tag: "Ẩm thực",
          icon: "🥗"
        },
        {
          time: "13:30",
          title: "Khởi hành về TP.HCM",
          desc: "Đoàn lên xe về lại điểm đón ban đầu. Nghỉ ngơi trên xe.",
          tag: "Di chuyển",
          icon: "🚌"
        },
        {
          time: "17:30",
          title: "Về đến trụ sở — Kết thúc chuyến đi",
          desc: "Xe về đến điểm đón ban đầu. Chia tay các đồng nghiệp và hẹn gặp lại trong những hành trình tiếp theo!",
          tag: "Kết thúc",
          icon: "🎉"
        }
      ]
    }
  ],

  // 2. LƯU Ý CHUYẾN ĐI (TRIP NOTES)
  notes: [
    {
      icon: "🪪",
      badge: "Bắt buộc",
      title: "Giấy tờ tùy thân",
      desc: "Mang theo CCCD/Hộ chiếu bản gốc còn hạn để làm thủ tục nhận phòng resort và bảo hiểm du lịch."
    },
    {
      icon: "💊",
      badge: "Sức khỏe",
      title: "Thuốc men & Y tế cá nhân",
      desc: "BTC có chuẩn bị túi y tế cơ bản. Tuy nhiên bạn nên chủ động thuốc say xe (uống trước 30p), thuốc dị ứng, men tiêu hóa nếu bụng yếu."
    },
    {
      icon: "☀️",
      badge: "Chống nắng",
      title: "Vật dụng đi biển & Chống nắng",
      desc: "Thời tiết Phan Thiết nhiều nắng gió: nên mang kem chống nắng (SPF 50+), kính râm, nón rộng vành, dép lê hoặc sandal chống trơn trượt."
    },
    {
      icon: "🔋",
      badge: "Thiết bị",
      title: "Sạc dự phòng & Phụ kiện",
      desc: "Mang sạc dự phòng, túi chống nước cho điện thoại khi tham gia teambuilding và tắm biển."
    },
    {
      icon: "⏰",
      badge: "Kỷ luật",
      title: "Quy tắc giờ giấc",
      desc: "Luôn có mặt trước giờ xuất phát 15 phút. Theo dõi liên tục thông báo từ Ban Tổ Chức trên nhóm chung sự kiện."
    },
    {
      icon: "🤝",
      badge: "Văn hóa",
      title: "An toàn & Tinh thần đồng đội",
      desc: "Tuyệt đối tuân thủ chỉ dẫn cứu hộ khi tắm biển; giữ gìn vệ sinh chung, tôn trọng không gian nghỉ dưỡng của các bạn cùng phòng."
    }
  ],

  // 3. LƯU Ý TRANG PHỤC (DRESS CODE)
  dresscode: [
    {
      day: "Ngày 1: Khởi hành & Di chuyển",
      time: "Cả ngày 15/04",
      highlight: "Thoải Mái & Năng Động",
      desc: "Quần áo nhẹ mát (áo thun, quần jean/kaki mềm hoặc quần short), giày thể thao/sneaker êm chân thuận tiện đi lại trên xe.",
      colors: [
        { name: "Trắng Sáng", hex: "#FFFFFF", border: true },
        { name: "Xanh Denim / Navy", hex: "#15458E" },
        { name: "Be / Sand", hex: "#D9C9B4" }
      ],
      tip: "Nên mang theo 1 áo khoác mỏng vì điều hòa trên xe du lịch có thể khá lạnh."
    },
    {
      day: "Ngày 2 (Chiều): Teambuilding Bãi Biển",
      time: "15:00 – 17:30 ngày 16/04",
      highlight: "Áo Đồng Phục Công Ty + Quần Short",
      desc: "Mặc áo thun đồng phục Teambuilding do BTC phát vào sáng Ngày 1. Kết hợp quần short thể thao mau khô, dép có quai hoặc đi chân trần trên cát.",
      colors: [
        { name: "Cyan Electric (Áo Cty)", hex: "#55E8FF" },
        { name: "Navy Tối", hex: "#0F193D" }
      ],
      tip: "Mang sẵn đồ bơi bên trong hoặc chuẩn bị đồ thay ngay sau khi chơi xong."
    },
    {
      day: "Ngày 2 (Tối): Gala Dinner Party",
      time: "18:30 – 22:00 ngày 16/04",
      highlight: "Concept: 'Neon Cyber Glow & White'",
      desc: "Trang phục dạ tiệc bán trang trọng (Smart Casual / Party Dress). Tông màu chủ đạo là Trắng phối cùng điểm nhấn phụ kiện màu Neon phát sáng.",
      colors: [
        { name: "Trắng Chủ Đạo (70%)", hex: "#FFFFFF", border: true },
        { name: "Neon Cyan (15%)", hex: "#55E8FF" },
        { name: "Neon Magenta (15%)", hex: "#FF5CA8" }
      ],
      tip: "BTC sẽ phát vòng dạ quang và phụ kiện glow-in-the-dark tại cổng đón khách."
    },
    {
      day: "Ngày 3: Dạo Biển & Trở Về",
      time: "Cả ngày 17/04",
      highlight: "Tự Do Phong Cách Nghỉ Dưỡng",
      desc: "Váy maxi, áo sơ mi họa tiết nhiệt đới (Hawaii), trang phục thoải mái để chụp hình sống ảo và lên xe về lại thành phố.",
      colors: [
        { name: "Pastel Xanh Biển", hex: "#82B2EA" },
        { name: "Vàng Nắng", hex: "#FFE17D" },
        { name: "Trắng Tự Nhiên", hex: "#FFFFFF", border: true }
      ],
      tip: "Đừng quên để dành một góc vali đựng đặc sản bánh rế, thanh long và nước mắm mua về làm quà nhé!"
    }
  ],

  // 4. THÔNG TIN DI CHUYỂN & LIÊN HỆ (TRANSPORT & CONTACTS)
  transport: {
    vehicle: {
      type: "Đoàn Xe Du Lịch Universe 45 Chỗ Đời Mới",
      features: "Điều hòa 2 chiều, ghế bật ngả bọc da cao cấp, wifi tốc độ cao, cổng sạc USB từng hàng ghế, dàn âm thanh karaoke giải trí."
    },
    schedule: {
      gatheringTime: "05:30 sáng — Thứ Sáu, ngày 15/04/2026",
      departureTime: "06:00 sáng đúng giờ xuất phát (Không chờ đợi trường hợp trễ quá 10 phút)",
      pickupPoint: "Sảnh Chính Tòa Nhà Trụ Sở Công Ty (Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM)",
      returnEst: "17:30 chiều Chủ Nhật, ngày 17/04/2026 tại điểm đón ban đầu"
    },
    busList: [
      {
        busNo: "Xe 01",
        label: "Xe Leader & Khối Công Nghệ",
        plate: "51B - 294.88",
        lead: "Mr. Minh Trí (0901 888 111)"
      },
      {
        busNo: "Xe 02",
        label: "Khối Vận Hành & Sự Kiện TNT",
        plate: "51B - 302.15",
        lead: "Ms. Thu Hà (0902 999 222)"
      },
      {
        busNo: "Xe 03",
        label: "Khối Kinh Doanh & Marketing",
        plate: "51B - 198.76",
        lead: "Mr. Tuấn Anh (0903 777 333)"
      }
    ],
    hotlines: [
      {
        role: "Trưởng Ban Tổ Chức",
        name: "Mr. Hoàng Nam",
        phone: "0908 123 456",
        duty: "Điều phối chung toàn chuyến đi"
      },
      {
        role: "Phụ trách Xe & Di chuyển",
        name: "Mr. Minh Trí",
        phone: "0901 888 111",
        duty: "Điểm danh, kiểm tra quân số các xe"
      },
      {
        role: "Hậu cần & Phân Phòng Khách Sạn",
        name: "Ms. Bích Thảo",
        phone: "0912 345 678",
        duty: "Hỗ trợ thủ tục phòng, đổi thẻ phòng, cạ ngủ"
      },
      {
        role: "Y tế & Cứu Hộ",
        name: "Ms. Lan Anh",
        phone: "0934 567 890",
        duty: "Sơ cấp cứu, phát thuốc, chăm sóc sức khỏe"
      }
    ]
  }
};
