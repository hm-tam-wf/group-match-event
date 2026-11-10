'use strict';
// Mục 1 — tab Nhận diện: soạn meta/config.profile (tạo mới tường minh, sửa chỉ khi đụng tab, chặn URL xấu, chữ ghi đè + JSON, xem trước, ID ≤100).
const H = require('../lib');
const { J, sleep, adb, FV, TS, evRef, seedEvent, getCfg, listCol, fresh, rec, openAdmin, until, clickTab, confirmYes, confirmNo, modalText,
  setVal, waitText, shot, waitDrawerClosed, baseCfg, same, openEdit, newEvent, typeCopy, xlsxFile, dk, fk, RH, upload, uploadTpl, recBatches, USERS } = H;

module.exports = {
  async run() {
    await fresh();
    await seedEvent('legacy-ev', baseCfg('Sự kiện cũ (chưa có profile)'), { active: true });
    await seedEvent('prof-ev', baseCfg('Có profile', { profile: { variant: 'tnt', lang: 'vi', homeUrl: 'home.html?e=prof-ev', future: { x: 1 },
      copy: { vi: { 'banner.sub': 'Phụ đề riêng', 'grid.tileJoin': 'Vào luôn' } } } }));
    const { page, ctx } = await openAdmin('root');

    // 1a — TẠO mới không đụng tab Nhận diện ⇒ profile tường minh mặc định
    await newEvent(page, 'Mặc Định Hồ Sơ');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    let cfg = await getCfg('mac-dinh-ho-so');
    rec('1a', 'tạo mới: profile tường minh mặc định {variant tnt, lang vi, homeUrl ""}, KHÔNG brand/introMs/copy',
      cfg && same(cfg.profile, { variant: 'tnt', lang: 'vi', homeUrl: '' }), cfg && cfg.profile);

    // 1b — TẠO mới có soạn đủ: theme gốc, logo riêng (chặn javascript:), home, introMs, chữ vi/en, JSON nâng cao
    await newEvent(page, 'Nhận Diện Đủ');
    await page.click('#dtabId'); await sleep(200);
    await page.select('#pVariant', '');
    const langAuto = await page.$eval('#pLang', e => e.value);
    await page.select('#pBrandMode', 'custom');
    const prefill = await page.$eval('#pBrandName', e => e.value);
    await setVal(page, '#pBrandName', 'ACME');
    await setVal(page, '#pLogoUrl', 'javascript:alert(1)');
    await page.click('#btnSave'); await sleep(300);
    const errJs = await page.$eval('#formErr', e => e.textContent);
    const onIdTab = await page.$eval('#dpId', e => !e.hidden);
    rec('1b-1', 'logo javascript: bị chặn, báo lỗi + ở lại tab Nhận diện; đổi theme gốc ⇒ lang tự = en; chọn Logo riêng tự điền logo mặc định',
      /Ảnh logo/.test(errJs) && onIdTab && langAuto === 'en' && prefill === 'FARADAY' && !(await getCfg('nhan-dien-du')), { errJs, onIdTab, langAuto, prefill });
    const badUrl = [];
    for (const bad of ['//evil.example/x.png', 'http://x.example/a.png', 'data:image/png;base64,AAA', 'img\\a.png', 'java\tscript:alert(1)']) {
      await setVal(page, '#pLogoUrl', bad); await page.click('#btnSave'); await sleep(200);
      const e = await page.$eval('#formErr', x => x.textContent);
      if (!/Ảnh logo/.test(e)) badUrl.push([bad, e]);
    }
    rec('1b-2', 'chặn //host, http:, data:, "\\", tab trong URL', badUrl.length === 0, badUrl);
    await setVal(page, '#pLogoUrl', 'https://example.com/logo.png');
    await setVal(page, '#pLogoAlt', 'Logo ACME');
    await page.select('#pHomeMode', 'home');
    await setVal(page, '#pIntro', '99999'); await page.click('#btnSave'); await sleep(200);
    const errIntro = await page.$eval('#formErr', x => x.textContent);
    await setVal(page, '#pIntro', '3000');
    await typeCopy(page, 'vi', 'banner.sub', 'Đã chốt rồi nhé');
    await typeCopy(page, 'vi', 'banner.title', 'Bạn ở <b>{0}</b>');
    await typeCopy(page, 'en', 'profile.greeting', 'Hi there');
    await setVal(page, '#cpSearch', '');
    const counts = await page.evaluate(() => [document.getElementById('cpCount-vi').textContent, document.getElementById('cpCount-en').textContent]);
    // JSON nâng cao: mã sai bị từ chối; JSON đúng thì áp dụng
    await page.click('#cpJsonBox > summary'); await sleep(150);
    const jsonShown = JSON.parse(await page.$eval('#cpJson', e => e.value));
    await setVal(page, '#cpJson', JSON.stringify({ vi: { 'banner.okk': 'x' } }));
    await page.click('#cpJsonApply'); await sleep(100);
    const jsonErr = await page.$eval('#cpJsonMsg', e => e.textContent);
    await page.click('#btnSave'); await sleep(200);
    const pendingErr = await page.$eval('#formErr', e => e.textContent);
    const j2 = Object.assign({}, jsonShown); j2.en = Object.assign({}, j2.en, { 'toast.full': 'Full {1}' });
    await setVal(page, '#cpJson', JSON.stringify(j2)); await page.click('#cpJsonApply'); await sleep(100);
    const jsonOk = await page.$eval('#cpJsonMsg', e => e.textContent);
    rec('1b-3', 'introMs ngoài 1000..15000 bị chặn; đếm chữ đã sửa vi=2 en=1; JSON hiện đúng; mã sai bị từ chối; JSON chưa áp dụng chặn lưu; JSON đúng áp dụng được',
      /1000/.test(errIntro) && J(counts) === J(['2', '1']) && jsonShown.vi['banner.sub'] === 'Đã chốt rồi nhé' && /banner\.okk/.test(jsonErr) && /JSON/.test(pendingErr) && /Đã áp dụng/.test(jsonOk),
      { errIntro, counts, jsonShown, jsonErr, pendingErr, jsonOk });
    await page.click('#dtabId'); await sleep(100);
    await shot(page, 'm1-nhan-dien-1440');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    cfg = await getCfg('nhan-dien-du');
    const want1b = { variant: '', lang: 'en', brand: { name: 'ACME', logoUrl: 'https://example.com/logo.png', logoAlt: 'Logo ACME' }, homeUrl: 'home.html?e=nhan-dien-du', introMs: 3000,
      copy: { vi: { 'banner.sub': 'Đã chốt rồi nhé', 'banner.title': 'Bạn ở <b>{0}</b>' }, en: { 'profile.greeting': 'Hi there', 'toast.full': 'Full {1}' } } };
    rec('1b-4', 'tạo mới đủ trường ⇒ profile đúng hợp đồng', cfg && same(cfg.profile, want1b), cfg && cfg.profile);

    // 1c — SỬA sự kiện cũ (không profile), không đụng tab ⇒ KHÔNG ghi profile; sửa chữ ⇒ profile tường minh, homeUrl/brand vẫn thiếu
    await openEdit(page, 'legacy-ev');
    await page.click('#dtabId'); await sleep(150);
    const legacyUi = await page.evaluate(() => ({ v: pVariant.value, l: pLang.value, b: pBrandMode.value, h: pHomeMode.value }));
    await page.click('#dtabCfg');
    await setVal(page, '#fSubtitle', 'mô tả mới');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    cfg = await getCfg('legacy-ev');
    const untouched = !('profile' in cfg) && cfg.subtitle === 'mô tả mới';
    await openEdit(page, 'legacy-ev'); await page.click('#dtabId'); await sleep(150);
    await typeCopy(page, 'vi', 'grid.tileJoin', 'Chọn nè');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    cfg = await getCfg('legacy-ev');
    rec('1c', 'sự kiện cũ: tab hiện giá trị hiệu lực (tnt/vi/logo skin/Huỷ như cũ); không đụng ⇒ không ghi profile; sửa chữ ⇒ {variant,lang,copy} (không homeUrl/brand)',
      legacyUi.v === 'tnt' && legacyUi.l === 'vi' && legacyUi.b === 'skin' && legacyUi.h === 'legacy' && untouched && same(cfg.profile, { variant: 'tnt', lang: 'vi', copy: { vi: { 'grid.tileJoin': 'Chọn nè' } } }),
      { legacyUi, untouched, profile: cfg.profile });

    // 1d — SỬA sự kiện có profile: đổi tiêu đề thôi ⇒ profile y nguyên (kể cả key lạ); xoá 1 chữ ⇒ update thay cả map, key lạ vẫn giữ
    const before = (await getCfg('prof-ev')).profile;
    await openEdit(page, 'prof-ev');
    const homeModeUi = await page.$eval('#pHomeMode', e => e.value);
    await setVal(page, '#fTitle', 'Có profile (đổi tên)');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    const afterTitle = (await getCfg('prof-ev')).profile;
    await openEdit(page, 'prof-ev'); await page.click('#dtabId');
    await typeCopy(page, 'vi', 'grid.tileJoin', '');
    await page.click('#btnSave'); await waitDrawerClosed(page);
    const afterDel = (await getCfg('prof-ev')).profile;
    rec('1d', 'Sửa không đụng Nhận diện ⇒ profile giữ nguyên; xoá 1 chữ ⇒ copy còn 1 key, key lạ "future" vẫn còn, homeUrl nhận ra là trang home',
      same(before, afterTitle) && homeModeUi === 'home' && same(afterDel.copy, { vi: { 'banner.sub': 'Phụ đề riêng' } }) && same(afterDel.future, { x: 1 }) && afterDel.homeUrl === 'home.html?e=prof-ev',
      { homeModeUi, afterTitle, afterDel });

    // 1e — Lưu & xem trước: mở tab mới index.html?e=<id> SAU khi lưu
    await openEdit(page, 'prof-ev');
    const newTarget = new Promise(r => { const b = H.browser(); const h = async t => { if (t.type() === 'page') { b.off('targetcreated', h); const u = t.url(); try { const p = await t.page(); if (p) await p.close(); } catch (e) {} r(u); } }; b.on('targetcreated', h); setTimeout(() => r('timeout'), 8000); });
    await page.click('#btnPreview');
    const url = await newTarget;
    await waitDrawerClosed(page);   // drawer ẩn sau hiệu ứng đóng 220ms — chờ, không đọc ngay lúc tab mới vừa mở
    rec('1e', 'Lưu & xem trước ⇒ lưu xong (drawer đóng) mở tab mới index.html?e=prof-ev', /index\.html\?e=prof-ev$/.test(url), url);

    // 1f — ID dài > 100 ký tự bị chặn; slug tự cắt ở 100
    await page.click('#btnNew'); await page.waitForSelector('#createCard:not([hidden])');
    await setVal(page, '#fTitle', 'x'.repeat(130));
    const slugLen = await page.$eval('#fId', e => e.value.length);
    await page.evaluate(() => { const e = document.getElementById('fId'); e.removeAttribute('maxlength'); e.value = 'a'.repeat(101); e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#btnSave'); await sleep(200);
    const idErr = await page.$eval('#formErr', e => e.textContent);
    rec('1f', 'ID: slug tự cắt ≤100; ID 101 ký tự bị chặn', slugLen === 100 && /100/.test(idErr), { slugLen, idErr });
    await page.click('#btnCancel');

    // ảnh chụp mobile của tab Nhận diện
    await openEdit(page, 'nhan-dien-du'); await page.click('#dtabId');
    await shot(page, 'm1-nhan-dien-390', { width: 390, height: 844 });
    await page.evaluate(() => document.querySelector('#createCard .drawer-body').scrollTo(0, 99999));
    await shot(page, 'm1-nhan-dien-390-cuoi');
    await page.setViewport({ width: 1440, height: 900 });
    await page.click('#btnCancel');
    await ctx.close();
  },
};
