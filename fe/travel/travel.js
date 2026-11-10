// ============================================================================
// fe/travel/travel.js — CONTROLLER & RENDERER TRANG CHUYẾN ĐI (TRAVEL)
// ----------------------------------------------------------------------------
// 1. Quản lý Loading Screen (≤ 2.0s, tự ẩn, mượt mà, tôn trọng reduced-motion).
// 2. Render động dữ liệu từ window.TRAVEL_DATA kèm phân loại tag & visual cues.
// 3. Staggered Entrance & Scroll-Reveal micro animations.
// 4. Smooth-scroll có bù trừ chiều cao sticky header cho CTA & Sticky Nav.
// 5. ScrollSpy tự động cập nhật tab active theo vị trí cuộn trên màn hình.
// 6. Nút Back-to-top nổi tiện ích khi cuộn sâu.
// ============================================================================

(function () {
  'use strict';

  // ── 1. LOADING SCREEN CONTROLLER ──
  function initLoader() {
    const loader = document.getElementById('travelLoader');
    const bar = document.getElementById('loaderBar');
    const percentEl = document.getElementById('loaderPercent');
    const statusEl = document.getElementById('loaderStatus');

    if (!loader) return;

    // Khi quay lại trang trong cùng phiên hoặc từ index.html: BỎ QUA màn loading, chạy ngay animation entrance
    let shouldSkipLoader = false;
    try {
      shouldSkipLoader =
        document.documentElement.classList.contains('skip-travel-loader') ||
        sessionStorage.getItem('travel_loaded') === '1' ||
        (document.referrer && (document.referrer.includes('index') || document.referrer.endsWith('/')));
      sessionStorage.setItem('travel_loaded', '1');
    } catch (e) {}

    if (shouldSkipLoader) {
      loader.classList.add('fade-out');
      loader.hidden = true;
      loader.style.display = 'none';
      document.body.classList.add('loaded', 'return-visit');
      return;
    }

    // Tôn trọng thiết lập giảm chuyển động (prefers-reduced-motion)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      loader.classList.add('fade-out');
      document.body.classList.add('loaded');
      setTimeout(() => {
        loader.hidden = true;
      }, 50);
      return;
    }

    let progress = 0;
    const startTime = performance.now();
    const duration = 1500; // 1.5 giây tiến trình mượt mà (đảm bảo <= 2.0s tổng thể)

    const statusTexts = [
      { at: 0, text: 'Khởi tạo hành trình...' },
      { at: 35, text: 'Tải dữ liệu lịch trình...' },
      { at: 70, text: 'Chuẩn bị phòng & xe...' },
      { at: 92, text: 'Sẵn sàng khởi hành! 🚀' }
    ];

    function updateProgress(currentTime) {
      const elapsed = currentTime - startTime;
      const rawProgress = Math.min(100, Math.floor((elapsed / duration) * 100));
      progress = rawProgress;

      if (bar) bar.style.width = progress + '%';
      if (percentEl) percentEl.textContent = progress + '%';

      // Cập nhật text trạng thái theo tiến trình
      for (let i = statusTexts.length - 1; i >= 0; i--) {
        if (progress >= statusTexts[i].at) {
          if (statusEl && statusEl.textContent !== statusTexts[i].text) {
            statusEl.textContent = statusTexts[i].text;
          }
          break;
        }
      }

      if (progress < 100) {
        requestAnimationFrame(updateProgress);
      } else {
        setTimeout(hideLoader, 150);
      }
    }

    function hideLoader() {
      loader.classList.add('fade-out');
      document.body.classList.add('loaded');
      setTimeout(() => {
        loader.hidden = true;
        loader.style.display = 'none';
      }, 400);
    }

    requestAnimationFrame(updateProgress);
  }

  // ── 2. HELPER: CATEGORY CLASS FOR TIMELINE TAGS ──
  function getTagClass(tag) {
    if (!tag) return '';
    const t = tag.toLowerCase();
    if (t.includes('ăn') || t.includes('ẩm thực') || t.includes('tiệc')) return 'tag-food';
    if (t.includes('gala') || t.includes('đêm')) return 'tag-gala';
    if (t.includes('team') || t.includes('game') || t.includes('khám phá')) return 'tag-game';
    if (t.includes('xe') || t.includes('chuyển') || t.includes('tập trung')) return 'tag-move';
    return '';
  }

  // ── 3. DYNAMIC DOM RENDERER (TỪ data.js) ──
  function renderTravelPage() {
    const data = window.TRAVEL_DATA;
    if (!data) {
      console.error('TRAVEL_DATA not found! Please check fe/travel/data.js.');
      return;
    }

    // A. Render Hero Section với staggered animation classes (chỉ chèn nếu chưa có HTML pre-rendered)
    const heroContainer = document.getElementById('heroContainer');
    if (heroContainer && heroContainer.children.length === 0) {
      const info = data.tripInfo || {};
      const cta = data.cta || {};

      heroContainer.innerHTML = `
        <div class="hero-anim-1">
          <span class="hero-pill-badge">✨ ${escapeHtml(info.badge || 'COMPANY TRIP')}</span>
        </div>
        <div class="hero-anim-2">
          <h1>${escapeHtml(info.title || 'CHUYẾN ĐI CÔNG TY')}</h1>
        </div>
        <div class="hero-anim-3">
          <p class="hero-tagline">${escapeHtml(info.tagline || '')}</p>
        </div>
        
        <div class="hero-meta-grid hero-anim-4">
          <div class="meta-chip">
            <span class="chip-icon">📅</span>
            <span>${escapeHtml(info.dates || '')} (${escapeHtml(info.duration || '')})</span>
          </div>
          <div class="meta-chip">
            <span class="chip-icon">📍</span>
            <span>${escapeHtml(info.location || '')}</span>
          </div>
          <div class="meta-chip">
            <span class="chip-icon">🏖️</span>
            <span>${escapeHtml(info.resort || '')}</span>
          </div>
        </div>

        <div class="hero-cta-group hero-anim-5">
          <a href="${escapeHtml(cta.schedule?.target || '#schedule')}" class="cta-btn btn-schedule" id="btnCtaSchedule">
            <span class="btn-ic">🗓️</span>
            <span>${escapeHtml(cta.schedule?.text || 'Full lịch trình')}</span>
          </a>
          <a href="${escapeHtml(cta.rooms?.url || 'index.html')}" class="cta-btn btn-rooms" id="btnCtaRooms">
            <span class="btn-ic">🛏️</span>
            <span>${escapeHtml(cta.rooms?.text || 'Chọn phòng')}</span>
          </a>
        </div>
      `;
    }

    // B. Render Sticky Navigation Tabs (chỉ chèn nếu chưa có HTML pre-rendered)
    const navContainer = document.getElementById('scheduleNavList');
    if (navContainer && navContainer.children.length === 0 && data.nav) {
      navContainer.innerHTML = data.nav
        .map(
          (item, idx) => `
        <a href="#${escapeHtml(item.id)}" class="nav-anchor-tab ${idx === 0 ? 'active' : ''}" data-target="${escapeHtml(item.id)}">
          <span>${item.icon || '📌'}</span>
          <span>${escapeHtml(item.label)}</span>
        </a>
      `
        )
        .join('');
    }

    // C. Render Khối 1: Lịch trình (Timeline)
    const timelineContainer = document.getElementById('sec-timeline-content');
    if (timelineContainer && data.timeline) {
      // 1. Day switch buttons
      const daySwitcherHtml = `
        <div class="day-switcher" role="tablist">
          ${data.timeline
            .map(
              (day, idx) => `
            <button type="button" class="day-pill-btn ${idx === 0 ? 'active' : ''}" data-day-target="${escapeHtml(day.id)}">
              ${escapeHtml(day.dayLabel)} (${escapeHtml(day.date)})
            </button>
          `
            )
            .join('')}
        </div>
      `;

      // 2. Day content panels
      const dayBlocksHtml = data.timeline
        .map(
          (day, idx) => `
        <div class="day-block ${idx === 0 ? 'active' : ''}" id="${escapeHtml(day.id)}">
          <div class="day-header-card reveal-on-scroll">
            <div class="dh-top">
              <span class="dh-label">${escapeHtml(day.dayLabel)} • ${escapeHtml(day.date)}</span>
              <span class="dh-title">${escapeHtml(day.title)}</span>
            </div>
            <p class="dh-summary">${escapeHtml(day.summary)}</p>
          </div>

          <div class="timeline-list">
            ${day.events
              .map(
                (ev) => `
              <div class="timeline-item reveal-on-scroll">
                <div class="timeline-card">
                  <div class="tl-meta">
                    <span class="tl-time-badge">⏰ ${escapeHtml(ev.time)}</span>
                    <span class="tl-tag ${getTagClass(ev.tag)}">${escapeHtml(ev.tag)}</span>
                  </div>
                  <h3 class="tl-title">${ev.icon || '•'} ${escapeHtml(ev.title)}</h3>
                  <p class="tl-desc">${escapeHtml(ev.desc)}</p>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
        )
        .join('');

      timelineContainer.innerHTML = daySwitcherHtml + dayBlocksHtml;

      // Bind day switcher tab click
      const dayBtns = timelineContainer.querySelectorAll('.day-pill-btn');
      const dayPanels = timelineContainer.querySelectorAll('.day-block');
      dayBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-day-target');
          dayBtns.forEach((b) => b.classList.remove('active'));
          dayPanels.forEach((p) => p.classList.remove('active'));
          btn.classList.add('active');
          const panel = document.getElementById(targetId);
          if (panel) {
            panel.classList.add('active');
            // Trigger reveals in newly active panel
            panel.querySelectorAll('.reveal-on-scroll').forEach((el) => {
              el.classList.add('is-visible');
            });
          }
        });
      });
    }

    // D. Render Khối 2: Lưu ý chuyến đi (Notes)
    const notesContainer = document.getElementById('sec-notes-content');
    if (notesContainer && data.notes) {
      notesContainer.innerHTML = `
        <div class="notes-grid">
          ${data.notes
            .map(
              (n) => `
            <div class="note-card reveal-on-scroll">
              <div class="note-top">
                <span class="note-ic">${n.icon || '📌'}</span>
                <span class="note-badge">${escapeHtml(n.badge || 'Lưu ý')}</span>
              </div>
              <h3 class="note-title">${escapeHtml(n.title)}</h3>
              <p class="note-desc">${escapeHtml(n.desc)}</p>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    // E. Render Khối 3: Lưu ý trang phục (Dress Code)
    const dresscodeContainer = document.getElementById('sec-dresscode-content');
    if (dresscodeContainer && data.dresscode) {
      dresscodeContainer.innerHTML = `
        <div class="dresscode-grid">
          ${data.dresscode
            .map((d) => {
              const isGala = (d.highlight || '').toLowerCase().includes('gala');
              return `
            <div class="dress-card reveal-on-scroll ${isGala ? 'highlight-gala' : ''}">
              <div class="dress-day-badge">${escapeHtml(d.day)}</div>
              <h3 class="dress-highlight">${escapeHtml(d.highlight)}</h3>
              <p class="dress-desc">${escapeHtml(d.desc)}</p>
              
              <div class="color-swatches-wrap">
                <div class="color-swatches-label">Tone màu gợi ý:</div>
                <div class="color-chips">
                  ${(d.colors || [])
                    .map(
                      (c) => `
                    <div class="color-chip" title="${escapeHtml(c.name)} (${escapeHtml(c.hex)})">
                      <span class="color-dot ${c.border ? 'has-border' : ''}" style="background-color: ${escapeHtml(c.hex)}"></span>
                      <span>${escapeHtml(c.name)}</span>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>

              ${d.tip ? `<div class="dress-tip">💡 <strong>Mẹo:</strong> ${escapeHtml(d.tip)}</div>` : ''}
            </div>
          `;
            })
            .join('')}
        </div>
      `;
    }

    // F. Render Khối 4: Thông tin di chuyển & Liên hệ (Transport & Hotlines)
    const transportContainer = document.getElementById('sec-transport-content');
    if (transportContainer && data.transport) {
      const tp = data.transport;
      transportContainer.innerHTML = `
        <div class="transport-layout">
          <!-- Card trái: Xe & Điểm tập trung -->
          <div class="info-card reveal-on-scroll">
            <h3 class="info-card-title">
              <span>🚍</span>
              <span>Phương Tiện & Điểm Tập Trung</span>
            </h3>
            <div class="info-list">
              <div class="info-row">
                <span class="info-icon">🚌</span>
                <div class="info-text">
                  <strong>Loại xe du lịch</strong>
                  <p>${escapeHtml(tp.vehicle?.type || '')} (${escapeHtml(tp.vehicle?.features || '')})</p>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">⏰</span>
                <div class="info-text">
                  <strong>Thời gian tập trung</strong>
                  <p>${escapeHtml(tp.schedule?.gatheringTime || '')}</p>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">🚀</span>
                <div class="info-text">
                  <strong>Giờ xuất phát</strong>
                  <p>${escapeHtml(tp.schedule?.departureTime || '')}</p>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">📍</span>
                <div class="info-text">
                  <strong>Điểm đón chính</strong>
                  <p>${escapeHtml(tp.schedule?.pickupPoint || '')}</p>
                </div>
              </div>
            </div>

            <!-- Danh sách xe -->
            <div class="bus-cards-wrap">
              ${(tp.busList || [])
                .map(
                  (b) => `
                <div class="bus-chip">
                  <div>
                    <span class="bus-num">${escapeHtml(b.busNo)}:</span>
                    <span class="bus-detail">${escapeHtml(b.label)}</span>
                  </div>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <span class="bus-plate">${escapeHtml(b.plate)}</span>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Card phải: Hotline BTC -->
          <div class="info-card reveal-on-scroll">
            <h3 class="info-card-title">
              <span>📞</span>
              <span>Hotline Ban Tổ Chức</span>
              <span class="live-badge">
                <span class="live-dot"></span>
                <span>24/7 SẴN SÀNG</span>
              </span>
            </h3>
            <p style="font-size:13px; color:var(--c-light-cyan,#82B2EA); margin:0 0 16px;">
              Bấm nút gọi trực tiếp khi cần hỗ trợ khẩn cấp, tìm xe hoặc đổi phòng.
            </p>
            <div class="hotline-grid">
              ${(tp.hotlines || [])
                .map(
                  (hl) => `
                <div class="hotline-card">
                  <div class="hotline-info">
                    <span class="hl-role">${escapeHtml(hl.role)}</span>
                    <span class="hl-name">${escapeHtml(hl.name)}</span>
                    <span class="hl-duty">${escapeHtml(hl.duty)}</span>
                  </div>
                  <a href="tel:${escapeHtml(hl.phone.replace(/[^0-9+]/g, ''))}" class="hl-call-btn" title="Gọi ${escapeHtml(hl.name)}">
                    <span class="call-ic">📞</span>
                    <span>${escapeHtml(hl.phone)}</span>
                  </a>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  // ── 4. SCROLL-REVEAL SYSTEM (INTERSECTION OBSERVER) ──
  function setupScrollReveal() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const elements = document.querySelectorAll('.reveal-on-scroll');

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    elements.forEach((el) => observer.observe(el));
  }

  // ── 5. SMOOTH SCROLL VỚI BÙ TRỪ STICKY HEADER ──
  function setupSmoothScroll() {
    const stickyNav = document.querySelector('.schedule-nav-wrapper');

    function scrollToSection(targetId) {
      const el = document.querySelector(targetId);
      if (!el) return;

      const navHeight = stickyNav ? stickyNav.offsetHeight : 64;
      const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = Math.max(0, elementPosition - navHeight - 16);

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }

    // A. CTA Button "Full lịch trình"
    document.addEventListener('click', function (e) {
      const ctaBtn = e.target.closest('#btnCtaSchedule');
      if (ctaBtn) {
        e.preventDefault();
        const target = ctaBtn.getAttribute('href');
        scrollToSection(target || '#sec-timeline');
        history.pushState(null, '', target || '#sec-timeline');
      }

      // B. Sticky Nav Tabs
      const navTab = e.target.closest('.nav-anchor-tab');
      if (navTab) {
        e.preventDefault();
        const targetId = navTab.getAttribute('href');
        scrollToSection(targetId);
        history.pushState(null, '', targetId);
      }

      // C. CTA Button "Chọn phòng" - Smooth exit transition
      const roomsBtn = e.target.closest('#btnCtaRooms');
      if (roomsBtn) {
        e.preventDefault();
        const href = roomsBtn.getAttribute('href') || 'index.html';
        document.body.style.transition = 'opacity 0.16s ease-out, transform 0.16s ease-out';
        document.body.style.opacity = '0';
        document.body.style.transform = 'scale(0.995)';
        setTimeout(() => {
          window.location.href = href;
        }, 150);
      }
    });
  }

  // ── 6. SCROLLSPY (TỰ ĐỘNG HIGHLIGHT TAB KHI CUỘN) ──
  function setupScrollSpy() {
    const navTabs = document.querySelectorAll('.nav-anchor-tab');
    const sections = document.querySelectorAll('.travel-section');
    const backToTopBtn = document.getElementById('backToTopBtn');

    if (!navTabs.length || !sections.length) return;

    let ticking = false;

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveTab();
          toggleBackToTop();
          ticking = false;
        });
        ticking = true;
      }
    }

    function toggleBackToTop() {
      if (!backToTopBtn) return;
      if (window.pageYOffset > 450) {
        backToTopBtn.classList.add('is-shown');
      } else {
        backToTopBtn.classList.remove('is-shown');
      }
    }

    function updateActiveTab() {
      const scrollPos = window.pageYOffset + 140; // Điểm kích hoạt offset
      let currentSectionId = '';

      sections.forEach((sec) => {
        const top = sec.offsetTop;
        const height = sec.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          currentSectionId = sec.getAttribute('id');
        }
      });

      // Nếu cuộn gần chạm đáy trang, kích hoạt section cuối
      if (window.innerHeight + window.pageYOffset >= document.body.offsetHeight - 50) {
        currentSectionId = sections[sections.length - 1].getAttribute('id');
      }

      if (currentSectionId) {
        navTabs.forEach((tab) => {
          const target = tab.getAttribute('data-target');
          if (target === currentSectionId) {
            if (!tab.classList.contains('active')) {
              navTabs.forEach((t) => t.classList.remove('active'));
              tab.classList.add('active');
              // Cuộn tab vào tâm thanh điều hướng ngang (chỉ cuộn container thanh nav, không chạm scroll trang)
              const navContainer = tab.closest('.schedule-nav-container');
              if (navContainer) {
                const tabLeft = tab.offsetLeft;
                const tabWidth = tab.offsetWidth;
                const containerWidth = navContainer.offsetWidth;
                navContainer.scrollTo({
                  left: tabLeft - containerWidth / 2 + tabWidth / 2,
                  behavior: 'smooth'
                });
              }
            }
          }
        });
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    updateActiveTab(); // Chạy ban đầu

    // Nút Back to top click
    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        history.pushState(null, '', window.location.pathname);
      });
    }
  }

  // Tiện ích escape HTML
  function escapeHtml(str) {
    if (typeof str !== 'string') return str || '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── 7. KHỞI CHẠY ──
  document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    renderTravelPage();
    setupScrollReveal();
    setupSmoothScroll();
    setupScrollSpy();
  });

  // Hỗ trợ back/forward cache (bfcache) của trình duyệt
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      const loader = document.getElementById('travelLoader');
      if (loader) {
        loader.classList.add('fade-out');
        loader.hidden = true;
        loader.style.display = 'none';
      }
      document.body.classList.add('loaded');
    }
  });
})();
