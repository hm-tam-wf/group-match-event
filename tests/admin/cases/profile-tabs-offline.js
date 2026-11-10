'use strict';
// Bước 3A, Firebase GIẢ (không emulator): các khối mới của admin dựng được và không ném lỗi —
// tab Nhận diện (mặc định NEW_EVENT_PROFILE, chữ gợi ý theo biến thể VARIANT_COPY), lưu sự kiện mới, hộp thao tác từng người,
// panel file mẫu Nhân sự + Phòng, trang Quản trị. Kiểm dữ liệu thật trên emulator nằm ở suite admin-e2e.
module.exports = {
  async run(t) {
    const { ev, waitFor, ok, sleep } = t;
    await t.navigate(t.url('tab=events'));
    await waitFor(`document.getElementById('tabEvents').classList.contains('active') && !!document.querySelector('#evListWrap [data-action="edit"]')`, 10000);
    // các trang BẮT BUỘC (gồm Quản trị); admin có thể có thêm trang khác (vd Trang thông tin của trình soạn home)
    const navTabs = await ev(`[...document.querySelectorAll('.tab')].map(b => b.dataset.tab)`);
    ok('M1 thanh điều hướng có đủ các trang (gồm Quản trị)', Array.isArray(navTabs)
      && ['tabDash', 'tabEvents', 'tabSignups', 'tab-allowlist', 'tabAdmins'].every(id => navTabs.includes(id)), navTabs);

    // ── Tạo sự kiện mới: tab Nhận diện mặc định = NEW_EVENT_PROFILE (config.js) ──
    await ev(`document.getElementById('btnNew').click()`);
    await waitFor(`!document.getElementById('createCard').hidden`, 5000);
    await ev(`document.getElementById('dtabId').click()`);
    const def = await ev(`({ v: pVariant.value, l: pLang.value, h: pHomeMode.value, b: pBrandMode.value,
      want: typeof NEW_EVENT_PROFILE === 'undefined' ? null : NEW_EVENT_PROFILE })`);
    ok('M2 tạo mới: Nhận diện mặc định theo NEW_EVENT_PROFILE (biến thể, ngôn ngữ, Huỷ không home), logo của giao diện',
      def.want && def.v === def.want.variant && def.l === def.want.lang && def.h === (def.want.homeUrl === '' ? 'none' : 'custom') && def.b === 'skin', def);

    // ── Chữ gợi ý: biến thể có chữ riêng (VARIANT_COPY) ⇒ hiện chữ đó + nhãn; theme gốc ⇒ chữ gốc STRINGS ──
    const PATH = 'profile.greeting';
    const filter = `(() => { const s = document.getElementById('cpSearch'); s.value = '${PATH}'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`;
    await ev(filter);
    await waitFor(`!!document.querySelector('.cp-in[data-path="${PATH}"]')`, 3000);
    const v1 = await ev(`(() => { const ta = document.querySelector('.cp-in[data-path="${PATH}"]');
      return { ph: ta.placeholder, tag: !!ta.closest('.cp-row').querySelector('.cp-var'), want: (VARIANT_COPY[pVariant.value] && VARIANT_COPY[pVariant.value].vi && VARIANT_COPY[pVariant.value].vi.profile || {}).greeting, base: STRINGS.vi.profile.greeting }; })()`);
    await ev(`(() => { const s = pVariant; s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await ev(filter);
    const v2 = await ev(`(() => { const ta = document.querySelector('.cp-in[data-path="${PATH}"]'); return { ph: ta.placeholder, tag: !!ta.closest('.cp-row').querySelector('.cp-var'), lang: pLang.value }; })()`);
    ok('M3 chữ gợi ý theo biến thể (VARIANT_COPY) kèm nhãn; đổi sang theme gốc ⇒ chữ gốc STRINGS, hết nhãn, ngôn ngữ tự theo',
      !!v1.want && v1.ph === v1.want && v1.tag && v1.want !== v1.base && v2.ph === v1.base && !v2.tag && v2.lang === 'en', { v1, v2 });

    // ── Lưu sự kiện mới (Firebase giả): profile tường minh, eventList thêm id (arrayUnion giữ sự kiện cũ) ──
    await ev(`(() => { const s = pVariant; s.value = 'tnt'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await ev(`(() => { document.getElementById('dtabCfg').click(); const f = document.getElementById('fTitle'); f.value = 'Su Kien Offline'; f.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('btnAddIcon').click(); const n = document.querySelector('#iconsList .dyn-row:last-child .inp-label'); n.value = 'Đội A'; n.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('btnSave').click(); })()`);
    await waitFor(`document.getElementById('createCard').hidden`, 8000);
    const saved = await ev(`(async () => { const db = firebase.firestore();
      const c = (await db.collection('events').doc('su-kien-offline').collection('meta').doc('config').get()).data();
      const l = (await db.collection('config').doc('eventList').get()).data(); return { profile: c && c.profile, ids: l && l.ids }; })()`);
    ok('M4 lưu sự kiện mới: profile = NEW_EVENT_PROFILE; config/eventList giữ 3 sự kiện cũ + thêm id mới',
      saved.profile && JSON.stringify(saved.profile) === JSON.stringify({ variant: def.want.variant, lang: def.want.lang, homeUrl: def.want.homeUrl })
      && Array.isArray(saved.ids) && saved.ids.length === 4 && saved.ids.includes('su-kien-offline'), saved);

    // ── Đăng ký: nút ⋯ mỗi dòng mở hộp thao tác (đã vào phòng ⇒ Bỏ chặn bị khoá, có lý do) ──
    await ev(`document.querySelector('.tab[data-tab="tabSignups"]').click()`);
    await sleep(700);
    await ev(`(() => { const s = document.getElementById('sigSelect'); s.value = 'tnt-mini-outing'; s.dispatchEvent(new Event('change')); })()`);
    await waitFor(`document.querySelectorAll('#tbody .row-act').length >= 12`, 8000);
    await ev(`document.querySelector('#tbody .row-act').click()`);
    await waitFor(`!!document.querySelector('.cm-bg .act-list')`, 3000);
    const acts = await ev(`[...document.querySelectorAll('.cm-bg .act-btn')].map(b => b.dataset.act + (b.disabled ? ':off' : ':on'))`);
    await ev(`document.querySelector('.cm-bg .cm-cancel').click()`);
    await waitFor(`!document.querySelector('.cm-bg')`, 3000);
    ok('M5 hộp thao tác từng người: chuyển / gỡ / xoá bật, bỏ chặn khoá (người đã vào phòng)',
      JSON.stringify(acts) === JSON.stringify(['move:on', 'unjoin:on', 'unblock:off', 'delete:on']), acts);

    // ── Danh sách cho phép: panel file mẫu; Tải file mẫu sinh 3 sheet theo sự kiện ──
    await ev(`document.querySelector('.tab[data-tab="tab-allowlist"]').click()`);
    await waitFor(`!!document.getElementById('alEvent').value && document.getElementById('alDedupField').textContent !== '—'`, 8000);
    // bản dựng mock không nạp SheetJS (build.js thay thẻ CDN) ⇒ stub đủ hàm tplDownload dùng
    await ev(`window.__dl = null; window.XLSX = { utils: { book_new: () => ({ SheetNames: [], Sheets: {} }), aoa_to_sheet: a => ({ a }),
      book_append_sheet: (wb, ws, n) => { wb.SheetNames.push(n); wb.Sheets[n] = ws; } }, writeFile: (wb, n) => { window.__dl = { n, sheets: wb.SheetNames }; } };
      document.getElementById('tplDownload').click(); 1`);
    await waitFor(`!!window.__dl`, 5000);
    const dl = await ev(`({ dl: window.__dl, ev: document.getElementById('alEvent').value })`);
    ok('M6 file mẫu: tên theo sự kiện, 3 sheet Nhân sự / Phòng / Hướng dẫn',
      dl.dl && dl.dl.n === 'mau-nhan-su-phong-' + dl.ev + '.xlsx' && JSON.stringify(dl.dl.sheets) === JSON.stringify(['Nhân sự', 'Phòng', 'Hướng dẫn']), dl);

    // ── Quản trị: UID của mình + 2 dòng UID gốc (không gỡ được) ──
    await ev(`document.querySelector('.tab[data-tab="tabAdmins"]').click()`);
    await waitFor(`document.querySelectorAll('#admBody tr.is-root').length > 0 && !document.getElementById('admBody').hasAttribute('aria-busy')`, 8000);
    const adm = await ev(`({ uid: admMyUid.textContent, roots: document.querySelectorAll('#admBody tr.is-root').length, rootDel: document.querySelectorAll('#admBody tr.is-root .adm-del').length })`);
    ok('M7 trang Quản trị: hiện UID đang đăng nhập, dòng UID gốc không có nút gỡ', adm.uid === 'demo-admin' && adm.roots >= 1 && adm.rootDel === 0, adm);

    ok('M8 không có exception JS', t.errs.length === 0, t.errs);
  },
};
