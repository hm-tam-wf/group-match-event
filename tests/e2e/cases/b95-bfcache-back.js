'use strict';
// Layer B — Back sau khi Huỷ quay về travel: trang chọn phòng phải HIỆN LẠI (bfcache từng giữ body opacity 0 ⇒ trắng).
const J = x => JSON.stringify(x);

module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    const { reset, sleep } = L;
    await reset();
    {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport(B.VIEWPORT);
      const base = B.baseUrl();
      await page.goto(base + 'travel.html', { waitUntil: 'load' }); await sleep(1500);
      await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.evaluate(() => document.getElementById('btnCtaRooms').click())]);
      await page.waitForFunction(() => typeof _travelSmoothBack === 'function', { timeout: 20000 }); await sleep(1500);
      await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.evaluate(() => _travelSmoothBack())]);
      const atTravel = page.url(); await sleep(800);
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {}); await sleep(1500);
      const st = await page.evaluate(() => ({ url: location.href, navType: (performance.getEntriesByType('navigation')[0] || {}).type,
        inline: document.body.style.opacity, computed: getComputedStyle(document.body).opacity }));
      record('BF1', 'Back sau khi Huỷ về travel: trang chọn phòng hiện lại (không trắng)', 'đang ở index.html, opacity khác 0',
        J({ atTravel, ...st }), /travel\.html/.test(atTravel) && /index\.html/.test(st.url) && st.computed !== '0');
      await ctx.close();
    }
  },
};
