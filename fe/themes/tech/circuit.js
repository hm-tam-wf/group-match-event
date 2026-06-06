/**
 * circuit.js (fe/themes/tech/)
 * Hiệu ứng Canvas xung điện chạy sáng (glowing circuit pulses) trên nền ảnh bo mạch.
 * Thiết kế cho theme "tech" của Group Match.
 */
(function () {
  // --- Màu lấy TỪ palette CSS của theme 'tech' (1 nguồn chân lý: tech.css --c-*) ---
  // resolveColors() đọc biến CSS rồi đổi hex→"r, g, b" cho ctx; nếu var rỗng thì giữ
  // fallback dưới (đúng giá trị palette). Tránh nhân đôi bảng màu giữa CSS và JS.
  let COLOR_CYAN = "85, 232, 255"; // --c-accent-cyan #55E8FF (Accent Cyan)
  let COLOR_BLUE = "34, 100, 187"; // --c-electric    #2264BB (Electric Blue)
  let COLOR_PINK = "255, 92, 168"; // --c-magenta     #FF5CA8 (Accent Magenta)
  function hexToRgb(hex) {
    const h = hex.trim().replace(/^#/, "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const int = parseInt(full, 16);
    if (full.length !== 6 || Number.isNaN(int)) return null;
    return ((int >> 16) & 255) + ", " + ((int >> 8) & 255) + ", " + (int & 255);
  }
  function resolveColors() {
    const cs = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => hexToRgb(cs.getPropertyValue(name) || "") || fallback;
    COLOR_CYAN = pick("--c-accent-cyan", COLOR_CYAN);
    COLOR_BLUE = pick("--c-electric", COLOR_BLUE);
    COLOR_PINK = pick("--c-magenta", COLOR_PINK);
  }

  const IMG_ASPECT = 16 / 9; // Tỉ lệ ảnh nền gốc
  let canvas, ctx;
  let animationFrameId = null;
  let active = false;

  // Kích thước vẽ ảnh nền dạng 'cover'
  let drawWidth = 0, drawHeight = 0, offsetX = 0, offsetY = 0;

  // --- Định nghĩa tọa độ tương đối các đường mạch (relative x, y từ 0 đến 1) ---
  const paths = [
    // 1. Mạch trung tâm sang trái bên dưới
    [
      { x: 0.44, y: 0.50 },
      { x: 0.40, y: 0.50 },
      { x: 0.36, y: 0.54 },
      { x: 0.30, y: 0.54 },
      { x: 0.26, y: 0.58 },
      { x: 0.16, y: 0.58 },
      { x: 0.12, y: 0.62 },
      { x: 0.05, y: 0.62 },
      { x: 0.02, y: 0.65 },
      { x: 0.00, y: 0.65 }
    ],
    // 2. Mạch trung tâm sang trái bên trên
    [
      { x: 0.44, y: 0.48 },
      { x: 0.40, y: 0.48 },
      { x: 0.36, y: 0.44 },
      { x: 0.30, y: 0.44 },
      { x: 0.26, y: 0.40 },
      { x: 0.16, y: 0.40 },
      { x: 0.12, y: 0.36 },
      { x: 0.05, y: 0.36 },
      { x: 0.02, y: 0.33 },
      { x: 0.00, y: 0.33 }
    ],
    // 3. Mạch trung tâm sang phải bên dưới
    [
      { x: 0.56, y: 0.50 },
      { x: 0.60, y: 0.50 },
      { x: 0.64, y: 0.54 },
      { x: 0.70, y: 0.54 },
      { x: 0.74, y: 0.58 },
      { x: 0.84, y: 0.58 },
      { x: 0.88, y: 0.62 },
      { x: 0.95, y: 0.62 },
      { x: 0.98, y: 0.65 },
      { x: 1.00, y: 0.65 }
    ],
    // 4. Mạch trung tâm sang phải bên trên
    [
      { x: 0.56, y: 0.48 },
      { x: 0.60, y: 0.48 },
      { x: 0.64, y: 0.44 },
      { x: 0.70, y: 0.44 },
      { x: 0.74, y: 0.40 },
      { x: 0.84, y: 0.40 },
      { x: 0.88, y: 0.36 },
      { x: 0.95, y: 0.36 },
      { x: 0.98, y: 0.33 },
      { x: 1.00, y: 0.33 }
    ],
    // 5. Mạch ngang rìa trái chéo xuống
    [
      { x: 0.00, y: 0.25 },
      { x: 0.15, y: 0.25 },
      { x: 0.20, y: 0.20 },
      { x: 0.35, y: 0.20 },
      { x: 0.40, y: 0.25 },
      { x: 0.43, y: 0.25 },
      { x: 0.45, y: 0.28 },
      { x: 0.45, y: 0.36 }
    ],
    // 6. Mạch ngang rìa phải chéo xuống
    [
      { x: 1.00, y: 0.25 },
      { x: 0.85, y: 0.25 },
      { x: 0.80, y: 0.20 },
      { x: 0.65, y: 0.20 },
      { x: 0.60, y: 0.25 },
      { x: 0.57, y: 0.25 },
      { x: 0.55, y: 0.28 },
      { x: 0.55, y: 0.36 }
    ],
    // 7. Nhánh dọc trung tâm đi lên lệch trái
    [
      { x: 0.48, y: 0.42 },
      { x: 0.48, y: 0.34 },
      { x: 0.46, y: 0.32 },
      { x: 0.46, y: 0.12 }
    ],
    // 8. Nhánh dọc trung tâm đi lên lệch phải
    [
      { x: 0.52, y: 0.42 },
      { x: 0.52, y: 0.34 },
      { x: 0.54, y: 0.32 },
      { x: 0.54, y: 0.12 }
    ],
    // 9. Mạch chéo dưới trái đi lên trung tâm
    [
      { x: 0.12, y: 0.88 },
      { x: 0.22, y: 0.88 },
      { x: 0.28, y: 0.82 },
      { x: 0.38, y: 0.82 },
      { x: 0.44, y: 0.74 },
      { x: 0.48, y: 0.74 },
      { x: 0.50, y: 0.71 }
    ],
    // 10. Mạch chéo dưới phải đi lên trung tâm
    [
      { x: 0.88, y: 0.88 },
      { x: 0.78, y: 0.88 },
      { x: 0.72, y: 0.82 },
      { x: 0.62, y: 0.82 },
      { x: 0.56, y: 0.74 },
      { x: 0.52, y: 0.74 },
      { x: 0.50, y: 0.71 }
    ],
    // 11. Mạch viền trái bên dưới
    [
      { x: 0.00, y: 0.82 },
      { x: 0.08, y: 0.82 },
      { x: 0.14, y: 0.76 },
      { x: 0.20, y: 0.76 },
      { x: 0.25, y: 0.70 },
      { x: 0.25, y: 0.64 }
    ],
    // 12. Mạch viền phải bên dưới
    [
      { x: 1.00, y: 0.82 },
      { x: 0.92, y: 0.82 },
      { x: 0.86, y: 0.76 },
      { x: 0.80, y: 0.76 },
      { x: 0.75, y: 0.70 },
      { x: 0.75, y: 0.64 }
    ]
  ];

  // Các điểm tụ sáng trang trí (pulsing status nodes)
  const decorativeNodes = [
    { x: 0.14, y: 0.55 }, // Khu vực icon trái
    { x: 0.78, y: 0.33 }, // Khu vực icon phải
    { x: 0.44, y: 0.49 }, // Trung tâm trái
    { x: 0.56, y: 0.49 }, // Trung tâm phải
    { x: 0.50, y: 0.28 }, // Đỉnh trung tâm
    { x: 0.50, y: 0.71 }  // Đáy trung tâm
  ];

  // Danh sách các tia điện và hạt bụi điện tử đang hoạt động
  let pulses = [];
  let particles = [];
  let lastTriggerTime = new Array(paths.length).fill(0);

  // --- Khởi tạo Canvas ---
  function initCanvas() {
    if (canvas) return;

    canvas = document.createElement("canvas");
    canvas.id = "circuit-canvas";
    document.body.prepend(canvas);
    ctx = canvas.getContext("2d");
    resolveColors(); // đồng bộ màu với palette CSS hiện hành

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("visibilitychange", handleVisibility);
    handleResize();

    // Tự động sinh ra tia điện ngẫu nhiên theo chu kỳ
    setInterval(spawnRandomPulse, 2000);
  }

  // --- Tính toán lại kích thước và tỉ lệ Cover ---
  function handleResize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Kích thước CSS canvas
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    // Kích thước vẽ pixel thực tế (retina-sharp)
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Tính toán khung hình bao phủ (background-size: cover)
    const screenAspect = w / h;
    if (screenAspect > IMG_ASPECT) {
      drawWidth = w;
      drawHeight = w / IMG_ASPECT;
      offsetX = 0;
      offsetY = (h - drawHeight) / 2;
    } else {
      drawWidth = h * IMG_ASPECT;
      drawHeight = h;
      offsetX = (w - drawWidth) / 2;
      offsetY = 0;
    }
  }

  // --- Lấy tọa độ điểm trên đường mạch dựa theo tiến trình (0 -> 1) ---
  function getPointOnPath(path, progress) {
    const t = Math.max(0, Math.min(1, progress));
    if (t <= 0) return { ...path[0] };
    if (t >= 1) return { ...path[path.length - 1] };

    const totalSegments = path.length - 1;
    const rawIndex = t * totalSegments;
    const index = Math.floor(rawIndex);
    const segmentProgress = rawIndex - index;

    const p1 = path[index];
    const p2 = path[index + 1];

    if (!p2) return { ...p1 };

    return {
      x: p1.x + (p2.x - p1.x) * segmentProgress,
      y: p1.y + (p2.y - p1.y) * segmentProgress
    };
  }

  // --- Sinh tia điện mới ---
  function createPulse(pathIndex, direction = 1, color = COLOR_CYAN) {
    pulses.push({
      pathIndex: pathIndex,
      progress: direction === 1 ? 0 : 1,
      direction: direction,
      speed: (0.0035 + Math.random() * 0.003) * 1.32, // Tăng tốc độ ~32% (20% gốc + 10%)
      size: 1.5 + Math.random() * 1.5,      // Độ dày tia điện
      length: 0.08 + Math.random() * 0.12,   // Độ dài đuôi
      colorRgb: color
    });
  }

  // --- Tự động kích hoạt ngẫu nhiên các đường mạch ---
  const PULSES_PER_SPAWN = 3; // số tia sinh mỗi nhịp (trước đây 1)

  function spawnRandomPulse() {
    if (!active || document.hidden) return; // tab ẩn → ngừng sinh tia (tránh dồn cục)
    // Tìm đường đi ngẫu nhiên không có tia điện đang chạy hoặc lâu chưa kích hoạt
    const availablePaths = [];
    const now = Date.now();
    for (let i = 0; i < paths.length; i++) {
      if (now - lastTriggerTime[i] > 3000) {
        availablePaths.push(i);
      }
    }

    const colors = [COLOR_CYAN, COLOR_BLUE, COLOR_PINK];
    // Sinh tối đa PULSES_PER_SPAWN tia trên các đường KHÁC NHAU (loại dần khỏi danh sách).
    const count = Math.min(PULSES_PER_SPAWN, availablePaths.length);
    for (let n = 0; n < count; n++) {
      const pick = Math.floor(Math.random() * availablePaths.length);
      const idx = availablePaths.splice(pick, 1)[0];
      const dir = Math.random() > 0.5 ? 1 : -1;
      const randColor = colors[Math.floor(Math.random() * colors.length)];
      createPulse(idx, dir, randColor);
      lastTriggerTime[idx] = now;
    }
  }

  // --- Cảm ứng tương tác khi di chuột ---
  function handleMouseMove(e) {
    if (!active) return;
    const mx = e.clientX;
    const my = e.clientY;
    const now = Date.now();

    // Kiểm tra xem chuột có di chuyển gần bất kỳ nút mạch nào không
    for (let i = 0; i < paths.length; i++) {
      if (now - lastTriggerTime[i] < 1000) continue; // Giới hạn tần suất kích hoạt

      const path = paths[i];
      for (let j = 0; j < path.length; j++) {
        const nx = offsetX + path[j].x * drawWidth;
        const ny = offsetY + path[j].y * drawHeight;

        const dx = mx - nx;
        const dy = my - ny;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Nếu chuột cách điểm nối dưới 50px
        if (dist < 50) {
          // Xác định hướng chạy dựa theo điểm di chuột gần đầu hay cuối
          const dir = j < path.length / 2 ? 1 : -1;
          createPulse(i, dir, COLOR_CYAN);
          lastTriggerTime[i] = now;

          // Tạo một vụ nổ hạt nhỏ ngay tại điểm kích hoạt
          for (let k = 0; k < 12; k++) {
            particles.push({
              x: nx,
              y: ny,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              size: Math.random() * 2 + 0.5,
              colorRgb: COLOR_CYAN,
              life: 20 + Math.random() * 20,
              maxLife: 40
            });
          }
          break; // Chỉ kích hoạt 1 tia trên đường này
        }
      }
    }
  }

  // --- Vòng lặp cập nhật và vẽ hoạt ảnh ---
  function animate() {
    if (!active || document.hidden) { animationFrameId = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = window.innerWidth;
    const h = window.innerHeight;

    // 1. Vẽ các điểm nối nhấp nháy tĩnh (Decorative Nodes)
    decorativeNodes.forEach(node => {
      const nx = offsetX + node.x * drawWidth;
      const ny = offsetY + node.y * drawHeight;

      // Nhịp đập sáng theo thời gian
      const pulseVal = Math.sin(Date.now() * 0.0035 + node.x * 12) * 0.35 + 0.65;
      
      ctx.beginPath();
      ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${COLOR_CYAN}, ${pulseVal})`;
      ctx.shadowColor = `rgba(${COLOR_CYAN}, 0.8)`;
      ctx.shadowBlur = 8 * pulseVal;
      ctx.fill();
      ctx.shadowBlur = 0; // Reset
    });

    // 2. Cập nhật và vẽ các xung tia điện (Pulses)
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.progress += p.direction * p.speed;

      // Kiểm tra tia điện hoàn thành hành trình
      if (p.progress > 1.15 || p.progress < -0.15) {
        pulses.splice(i, 1);
        continue;
      }

      const path = paths[p.pathIndex];
      const length = p.length;
      const steps = 15; // Số đoạn vẽ đuôi mờ dần

      // Vẽ đuôi tia điện dạng phân đoạn giảm dần alpha
      for (let j = 1; j <= steps; j++) {
        const t1 = p.progress - p.direction * (1 - (j - 1) / steps) * length;
        const t2 = p.progress - p.direction * (1 - j / steps) * length;

        // Bỏ qua nếu tiến trình nằm ngoài phạm vi đường đi
        if (t2 < 0 || t2 > 1) continue;

        const pt1 = getPointOnPath(path, t1);
        const pt2 = getPointOnPath(path, t2);

        const cx1 = offsetX + pt1.x * drawWidth;
        const cy1 = offsetY + pt1.y * drawHeight;
        const cx2 = offsetX + pt2.x * drawWidth;
        const cy2 = offsetY + pt2.y * drawHeight;

        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        ctx.lineTo(cx2, cy2);

        const opacity = (j / steps) * 0.8;
        ctx.strokeStyle = `rgba(${p.colorRgb}, ${opacity})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // Vẽ đầu xung điện phát sáng mạnh
      const headT = Math.max(0, Math.min(1, p.progress));
      const headPt = getPointOnPath(path, headT);
      const hx = offsetX + headPt.x * drawWidth;
      const hy = offsetY + headPt.y * drawHeight;

      ctx.beginPath();
      ctx.arc(hx, hy, p.size * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.colorRgb}, 1)`;
      ctx.shadowColor = `rgba(${p.colorRgb}, 0.95)`;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0; // Reset

      // Phát sinh bụi điện tử rơi rải rác đằng sau đầu tia điện
      if (Math.random() < 0.22) {
        particles.push({
          x: hx,
          y: hy,
          vx: (Math.random() - 0.5) * 1.0,
          vy: (Math.random() - 0.2) * 1.2, // Hơi bay hướng xuống dưới
          size: Math.random() * 1.2 + 0.4,
          colorRgb: p.colorRgb,
          life: 25 + Math.random() * 20,
          maxLife: 45
        });
      }
    }

    // 3. Cập nhật và vẽ các hạt bụi điện tử tự do (Particles)
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      const alpha = Math.max(0, pt.life / pt.maxLife);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pt.colorRgb}, ${alpha * 0.75})`;
      ctx.fill();

      if (pt.life <= 0) {
        particles.splice(i, 1);
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  // --- Tạm dừng khi tab ẩn / chạy lại khi quay lại (Page Visibility API) ---
  // Trình duyệt tự dừng requestAnimationFrame khi tab ẩn nhưng setInterval vẫn chạy
  // ngầm → tia tích luỹ rồi "dồn 1 cục" lúc quay lại. Khắc phục: ẩn → huỷ vòng vẽ;
  // hiện → xoá tia/hạt còn sót rồi chạy tiếp mượt từ đầu.
  function handleVisibility() {
    if (!active) return;
    if (document.hidden) {
      if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    } else {
      pulses = [];
      particles = [];
      if (!animationFrameId) animate();
    }
  }

  // --- Tôn trọng prefers-reduced-motion (đồng bộ @media reduce trong styles.css) ---
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // --- Kiểm tra xem theme hiện tại có phải là 'tech' không ---
  function checkTheme() {
    const isTech = document.documentElement.getAttribute("data-theme") === "tech";
    // Không chạy hoạt ảnh canvas nếu user yêu cầu giảm chuyển động — nền ảnh + CSS
    // đã đủ tạo không khí 'tech', và đây là quy ước animation của repo.
    if (isTech && !active && !prefersReducedMotion()) {
      active = true;
      initCanvas();
      animate();
    } else if (!isTech && active) {
      active = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      // Dọn dẹp canvas để không tốn RAM
      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  // Lắng nghe thay đổi theme động (MutationObserver) để bật/tắt hoạt ảnh tối ưu hóa CPU
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
        checkTheme();
      }
    });
  });

  observer.observe(document.documentElement, { attributes: true });

  // Tự kích hoạt chạy thử ngay khi tải xong script nếu theme đã chọn là 'tech'
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkTheme);
  } else {
    checkTheme();
  }
})();
