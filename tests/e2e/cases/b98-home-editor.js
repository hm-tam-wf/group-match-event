'use strict';
// Trình soạn trang home (fe/js/admin/home-editor.js) ghi THẬT vào Firestore Emulator qua rules thật:
// client riêng dùng token GIẢ của UID admin (mockUserToken — emulator không kiểm chữ ký), client ẩn danh để kiểm rules chặn.
// Trang chủ: fe/admin.html của static server e2e (có admin.css + SDK Firebase) — chỉ mượn trang, trình soạn được mount riêng.
// Soạn → lưu → đọc lại khớp; validate chặn ghi; JSON/Excel round-trip; Excel lỗi; không phải admin; doc v2 khoá; type lạ giữ nguyên.
const fs = require('fs'), path = require('path');
const C = require('../../lib/config');
const { adminUid } = require('../../rules/lib');

// Bắt file tải xuống ngay trong trang (Blob của URL.createObjectURL + <a download>.click()).
const CAPTURE = () => {
  window.__dl = [];
  const blobs = new Map();
  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = b => { const u = create(b); blobs.set(u, b); return u; };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const b = blobs.get(this.href);
    if (this.download && b) {
      const name = this.download;
      window.__dl.push(b.arrayBuffer().then(buf => {
        const u = new Uint8Array(buf); let s = '';
        for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        return { name, b64: btoa(s) };
      }));
      return;
    }
    return click.call(this);
  };
};

module.exports = {
  browser: true,
  async run({ L, B, browser, ok }) {
    if (!fs.existsSync(path.join(L.REPO, 'fe/js/admin/home-editor.js'))) { ok('home-editor.js chưa có trong repo này — bỏ qua', true); return; }
    const HS = require(path.join(L.REPO, 'fe/js/home/home-schema.js'));
    const SH = require(path.join(L.REPO, 'fe/js/home/home-sheets.js'));
    const XLSX = require(path.join(C.ROOT, 'node_modules', 'xlsx'));
    const SEED = JSON.parse(fs.readFileSync(path.join(L.REPO, 'backend/seed/home-tnt.json'), 'utf8'));
    const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x));
    const tmp = path.join(C.OUT, 'home-editor-tmp');
    fs.mkdirSync(tmp, { recursive: true });
    const homeDoc = id => L.adb.collection('events').doc(id).collection('meta').doc('home');
    const server = async id => { const s = await homeDoc(id).get(); return s.exists ? s.data() : null; };

    await L.reset();
    for (const [id, title] of [['ed-seed', 'TNT Mini Outing 2026'], ['ed-new', 'Sự kiện soạn mới'], ['ed-json', 'Nạp JSON'], ['ed-xlsx', 'Nạp Excel'],
      ['ed-xlsx2', 'Excel lỗi'], ['ed-perm', 'Không quyền'], ['ed-v2', 'Schema mới'], ['ed-unk', 'Type lạ']]) {
      await L.adb.collection('events').doc(id).collection('meta').doc('config').set({ title });
    }
    await homeDoc('ed-seed').set(SEED);
    await homeDoc('ed-v2').set({ v: 2, hero: { title: 'Bản mới' }, sections: [] });
    const unk = JSON.parse(JSON.stringify(SEED));
    unk.sections.push({ id: 'gallery', type: 'gallery', title: 'Ảnh', photos: [{ url: 'a.png', cap: 'Bãi biển' }] });
    await homeDoc('ed-unk').set(unk);

    const ctx = await browser.createBrowserContext();
    const errs = [];
    try {
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
      page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|Failed to load resource|net::|PERMISSION_DENIED|permission/i.test(m.text())) errs.push('console.error: ' + m.text().slice(0, 200)); });
      await page.evaluateOnNewDocument(CAPTURE);
      await page.goto(B.baseUrl() + 'admin.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!(window.firebase && window.firebase.initializeApp), { timeout: 20000 });
      if (!(await page.evaluate(() => !!window.XLSX))) await page.addScriptTag({ path: path.join(C.ROOT, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js') });
      for (const f of ['js/home/home-schema.js', 'js/home/home-sheets.js', 'js/admin/home-editor.js']) await page.addScriptTag({ url: B.baseUrl() + f });
      await page.addStyleTag({ url: B.baseUrl() + 'assets/admin-home.css' });

      // Mount trình soạn cho 1 sự kiện. anon=true ⇒ client KHÔNG token (rules phải chặn ghi).
      const mount = async (eid, anon = false) => {
        const r = await page.evaluate(({ host, port, project, uid, e, a }) => {
          const name = a ? 'he-anon' : 'he-admin';
          let app = firebase.apps.find(x => x.name === name);
          if (!app) {
            app = firebase.initializeApp({ projectId: project, apiKey: 'x' }, name);
            app.firestore().useEmulator(host, port, a ? {} : { mockUserToken: { sub: uid, user_id: uid } });
          }
          ['bootView', 'loginView', 'adminView'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
          let box = document.getElementById('heMount');
          if (!box) { box = document.createElement('div'); box.id = 'heMount'; box.className = 'main'; document.body.appendChild(box); }
          return HomeEditor.mount(box, { db: app.firestore(), eventId: e }).then(() => 'ok', err => 'ERR ' + err.message);
        }, { host: C.EMU_HOST, port: L.EMU_PORT, project: L.PROJECT, uid: adminUid(), e: eid, a: anon });
        if (r !== 'ok') throw new Error('mount ' + eid + ': ' + r);
      };
      const getDoc = () => page.evaluate(() => HomeEditor.getDoc());
      const dirty = () => page.evaluate(() => HomeEditor.isDirty());
      const status = () => page.evaluate(() => { const s = document.querySelector('.he-status'); return s ? { kind: s.dataset.kind, text: s.textContent } : null; });
      const setVal = (p, v) => page.evaluate((p, v) => {
        const el = document.querySelector(`[data-path="${p}"]`);
        if (!el) return 'missing ' + p;
        if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'ok';
      }, p, v);
      const act = sel => page.evaluate(s => { const b = document.querySelector(s); if (!b) return 'missing ' + s; if (b.disabled) return 'disabled'; b.click(); return 'ok'; }, sel);
      const waitStatus = (kind, re) => page.waitForFunction((k, r) => { const s = document.querySelector('.he-status'); return s && s.dataset.kind === k && new RegExp(r).test(s.textContent); },
        { timeout: 20000, polling: 100 }, kind, re.source);
      const downloads = async () => (await page.evaluate(() => Promise.all(window.__dl).then(x => { window.__dl = []; return x; })))
        .map(f => { const p = path.join(tmp, f.name); const buf = Buffer.from(f.b64, 'base64'); fs.writeFileSync(p, buf); return { name: f.name, path: p, buf }; });
      const upload = async (kind, file) => { const inp = await page.$(`#heMount [data-file="${kind}"]`); await inp.uploadFile(file); };

      // ── mở doc có sẵn ──
      await mount('ed-seed');
      ok('home-editor: mở sự kiện có sẵn — 4 mục, không dirty, nội dung = doc trên server', (await page.evaluate(() => document.querySelectorAll('.he-sec').length)) === 4
        && !(await dirty()) && canon(await getDoc()) === canon(SEED) && (await status()).kind === 'ok', await status());

      // ── soạn mới → lưu → đọc lại ──
      await mount('ed-new');
      ok('home-editor: sự kiện chưa có home — báo "chưa có trang home" + nút khung mẫu', /chưa có trang home/.test(await page.evaluate(() => document.querySelector('.he-notice').textContent))
        && (await page.evaluate(() => !!document.querySelector('.he-empty'))));
      await act('[data-act="starter"]');
      ok('home-editor: khung mẫu 4 mục, tiêu đề lấy từ meta/config', (await page.evaluate(() => document.querySelectorAll('.he-sec').length)) === 4 && (await getDoc()).hero.title === 'Sự kiện soạn mới');
      await page.click('[data-path="hero.subtitle"]');
      await page.keyboard.type('Gõ bằng bàn phím — có dấu');
      const bad = [];
      for (const [p, v] of [['sections[0].days[0].date', '01/12/2026'], ['sections[0].days[0].items[0].time', '07:00'], ['sections[0].days[0].items[0].title', 'Tập trung'],
        ['sections[0].days[0].items[0].tone', 'move'], ['sections[1].items[0].title', 'Mang CCCD'], ['sections[1].items[0].desc', 'Bản gốc\ncòn hạn'],
        ['sections[2].items[0].highlight', 'Áo trắng'], ['sections[2].items[0].colors[0].hex', '#123ABC'], ['sections[2].items[0].featured', true],
        ['sections[3].info[0].label', 'Điểm đón'], ['sections[3].contacts[0].name', 'Ms. A'], ['sections[3].contacts[0].phone', '0901 234 567']]) {
        const r = await setVal(p, v); if (r !== 'ok') bad.push(r);
      }
      const colorSync = await page.evaluate(() => document.querySelector('[data-hex-for="sections[2].items[0].colors[0].hex"]').value);
      await act('[data-act="add"][data-path="sections[0].days[0].items"]');
      await setVal('sections[0].days[0].items[1].title', 'Ăn trưa');
      await act('[data-act="add"][data-path="sections[0].days"]');
      await setVal('sections[0].days[1].label', 'NGÀY 02');
      await page.select('#heMount [data-new-type]', 'text');
      await act('[data-act="addSection"]');
      await setVal('sections[4].body', 'Xin chào\n\nĐoạn hai');
      await act('[data-act="up"][data-path="sections[4]"]');
      await act('[data-act="del"][data-path="sections[2]"]');
      await page.waitForSelector('.he-cm .cm-confirm', { timeout: 5000 });
      await page.click('.he-cm .cm-confirm');
      const order = (await getDoc()).sections.map(s => s.type);
      ok('home-editor: thêm / sửa / sắp / xoá — thứ tự timeline, notes, text, transport; màu đồng bộ; đang "chưa lưu"', !bad.length
        && JSON.stringify(order) === '["timeline","notes","text","transport"]' && colorSync === '#123abc' && (await dirty()) && (await status()).kind === 'dirty', { bad, order, colorSync });
      await page.click('#heMount [data-act="save"]');
      await waitStatus('ok', /Đã lưu/);
      const local = await getDoc(), saved = await server('ed-new');
      ok('home-editor: Lưu ⇒ server KHỚP nội dung trình soạn (set trọn doc), hết "chưa lưu"', saved && canon(HS.normalize(saved)) === canon(local) && !(await dirty())
        && saved.sections[0].days.length === 2 && saved.sections[0].days[0].items[1].title === 'Ăn trưa' && saved.hero.subtitle === 'Gõ bằng bàn phím — có dấu'
        && saved.sections[2].body === 'Xin chào\n\nĐoạn hai', { local, saved });
      await mount('ed-new');
      ok('home-editor: mở lại ⇒ đọc lại đúng bản đã lưu', canon(await getDoc()) === canon(HS.normalize(saved)) && !(await dirty()));

      // ── validate chặn ghi ──
      await setVal('sections[0].id', 'Bad ID');
      await setVal('hero.imageUrl', 'javascript:alert(1)');
      await setVal('sections[1].items[0].title', 'x'.repeat(161));
      await page.click('#heMount [data-act="save"]');
      await waitStatus('err', /lỗi cần sửa/);
      const ev = await page.evaluate(() => ({ items: [...document.querySelectorAll('.he-errors li')].map(l => l.textContent), invalid: [...document.querySelectorAll('.is-invalid')].map(e => e.dataset.path) }));
      ok('home-editor: lỗi id / URL javascript: / quá dài ⇒ KHÔNG ghi, liệt kê lỗi + tô đỏ đúng ô', canon(await server('ed-new')) === canon(saved) && ev.items.length === 3
        && ['sections[0].id', 'hero.imageUrl', 'sections[1].items[0].title'].every(p => ev.invalid.includes(p)) && ev.items.some(x => /Lưu ý 1 › Tiêu đề: dài quá 160/.test(x)), ev);
      await act('.he-errlink[data-focus="sections[1].items[0].title"]');
      ok('home-editor: bấm dòng lỗi ⇒ focus đúng ô', (await page.evaluate(() => document.activeElement && document.activeElement.dataset.path)) === 'sections[1].items[0].title');
      await setVal('sections[0].id', 'lich-trinh'); await setVal('hero.imageUrl', 'https://example.com/a.jpg'); await setVal('sections[1].items[0].title', 'Mang CCCD');
      await page.click('#heMount [data-act="save"]');
      await waitStatus('ok', /Đã lưu/);
      ok('home-editor: sửa xong ⇒ lưu được', (await server('ed-new')).sections[0].id === 'lich-trinh');

      // ── JSON round-trip ──
      await mount('ed-seed');
      await act('[data-act="exportJson"]');
      const [fj] = await downloads();
      ok('home-editor: Xuất JSON = nội dung đang soạn (= seed)', fj && fj.name === 'home-ed-seed.json' && canon(JSON.parse(fj.buf.toString('utf8'))) === canon(SEED), fj && fj.name);
      await mount('ed-json');
      await upload('json', fj.path);
      await waitStatus('info', /Đã nạp/);
      ok('home-editor: Nạp JSON ⇒ nội dung = file, CHƯA ghi khi chưa bấm Lưu', canon(await getDoc()) === canon(SEED) && (await server('ed-json')) === null && (await dirty()));
      await page.click('#heMount [data-act="save"]');
      await waitStatus('ok', /Đã lưu/);
      ok('home-editor: Lưu sau khi nạp JSON ⇒ server = seed', canon(HS.normalize(await server('ed-json'))) === canon(SEED));

      // ── Excel round-trip + Excel lỗi ──
      await mount('ed-seed');
      await act('[data-act="exportXlsx"]');
      const [fx] = await downloads();
      const wb = fx && XLSX.read(fx.buf, { type: 'buffer', cellNF: true });
      ok('home-editor: Xuất Excel — home-ed-seed.xlsx, 10 sheet, ô dạng Text', fx && fx.name === 'home-ed-seed.xlsx' && wb.SheetNames.length === 10 && wb.Sheets['Lịch trình'].G2.z === '@', fx && fx.name);
      await mount('ed-xlsx');
      await upload('xlsx', fx.path);
      await waitStatus('info', /Đã nạp/);
      ok('home-editor: Nạp Excel ⇒ nội dung = seed (round-trip khớp tuyệt đối)', canon(await getDoc()) === canon(SEED));
      await page.click('#heMount [data-act="save"]');
      await waitStatus('ok', /Đã lưu/);
      ok('home-editor: Lưu sau khi nạp Excel ⇒ server = seed', canon(HS.normalize(await server('ed-xlsx'))) === canon(SEED));
      const sheets = SH.toSheets(SEED);
      sheets.find(s => s.name === 'Lưu ý').rows[2][0] = 'khong-co';
      const wbBad = XLSX.utils.book_new();
      sheets.forEach(s => XLSX.utils.book_append_sheet(wbBad, XLSX.utils.aoa_to_sheet(s.rows), s.name));
      const badPath = path.join(tmp, 'home-bad.xlsx');
      XLSX.writeFile(wbBad, badPath);
      await mount('ed-xlsx2');
      await upload('xlsx', badPath);
      await waitStatus('err', /có lỗi/);
      const xe = await page.evaluate(() => [...document.querySelectorAll('.he-errors li')].map(l => l.textContent));
      ok('home-editor: Excel tham chiếu mục không có ⇒ báo lỗi kèm sheet/dòng, KHÔNG thay nội dung', xe.some(x => /Sheet "Lưu ý" dòng 3: mục "khong-co"/.test(x)) && (await getDoc()).sections.length === 0, xe);

      // ── không phải admin ⇒ rules chặn ──
      await mount('ed-perm', true);
      await act('[data-act="starter"]');
      await page.click('#heMount [data-act="save"]');
      await waitStatus('err', /không có quyền/);
      ok('home-editor: client không phải admin ⇒ "Lưu thất bại: không có quyền…", server không có doc', (await server('ed-perm')) === null, await status());

      // ── doc schema v2 ⇒ chỉ xem ──
      await mount('ed-v2');
      const v2 = await page.evaluate(() => ({ alert: (document.querySelector('.alert.he-notice') || {}).textContent || '', save: document.querySelector('#heMount [data-act="save"]').disabled }));
      ok('home-editor: doc v2 ⇒ cảnh báo + khoá nút Lưu', /schema mới hơn/.test(v2.alert) && v2.save, v2);

      // ── type lạ giữ nguyên qua lưu ──
      await mount('ed-unk');
      const hasJson = await page.evaluate(() => !!document.querySelector('.he-json[data-raw="sections[4]"]'));
      await setVal('hero.title', 'Đổi tiêu đề');
      await page.click('#heMount [data-act="save"]');
      await waitStatus('ok', /Đã lưu/);
      const su = await server('ed-unk');
      ok('home-editor: mục type "gallery" hiện ô JSON và được giữ nguyên khi lưu', hasJson && su.hero.title === 'Đổi tiêu đề' && su.sections[4].type === 'gallery' && su.sections[4].photos[0].cap === 'Bãi biển', su.sections[4]);
      ok('home-editor: không exception / console.error (trừ từ chối quyền cố ý)', errs.length === 0, errs);
    } finally {
      await ctx.close().catch(() => {});
    }
  },
};
