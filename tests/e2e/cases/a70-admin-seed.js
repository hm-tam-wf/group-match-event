'use strict';
// Layer A — seedTeams THẬT trích từ fe/admin.html (chạy bằng admin SDK trên emulator) + chống chiếm khoá M bằng tên "~…".
const fs = require('fs'), path = require('path');
const J = x => JSON.stringify(x);
// Mốc trích hàm từ admin.html (inline JS) — đổi chữ ký seedTeams thì sửa 2 mốc này.
const SEED_START = 'async seedTeams(eid, items, cfg){';
const SEED_END = 'return { seeded, perTeam, unmapped:[...unmapped], conflicts, capacity };';

module.exports = {
  async run({ L, record }) {
    const { reset, snap, makeDevice, claim, dedupKey, mKey } = L;

    // S14 — admin seedTeams: shape {at,icon}, M 1 lần/khoá, CONFLICT khi trùng k1
    await reset();
    {
      const html = fs.readFileSync(path.join(L.REPO, 'fe/admin.html'), 'utf8');
      const i0 = html.indexOf(SEED_START), i1 = html.indexOf(SEED_END);
      if (i0 < 0 || i1 < 0) throw new Error('không trích được seedTeams từ admin.html');
      const fn = html.slice(i0, i1 + SEED_END.length) + '\n}';
      const fkLine = html.match(/const _foldKey = [^\n]+/)[0];
      const make = new Function('db', 'FV', fkLine + '\nreturn { ' + fn + ' };');
      const seeder = make(L.adb, L.admin.firestore.FieldValue);
      const mk = (name, team) => ({ name, raw: name, key: dedupKey(name), team: String(team) });
      const items = [mk('Nguyễn Văn Hùng', 1), mk('Nguyễn Văn Hưng', 1), mk('Lê Văn A', 2), mk('LÊ VĂN A', 2), mk('Le Van B', 2)];
      const cfg = { icons: [{ icon: '🌸' }, { icon: '🐬' }], dedupField: 'name', capacity: 7 };
      const res = await seeder.seedTeams(L.EVENT, items, cfg);
      const s = await snap();
      const docs = Object.keys(s.dedup).sort();
      const want = [dedupKey('Nguyễn Văn Hùng'), dedupKey('Nguyễn Văn Hưng'), mKey('Nguyễn Văn Hùng'), dedupKey('Lê Văn A'), mKey('Lê Văn A'), dedupKey('Le Van B')].sort();
      const shapeOk = Object.entries(s.dedup).every(([k, d]) => J(Object.keys(d).sort()) === '["at","icon"]' && d.icon === (k === dedupKey('Le Van B') || k === dedupKey('Lê Văn A') || k === mKey('Lê Văn A') ? '🐬' : '🌸'));
      // máy mới tra cứu: không dấu 'Nguyen Van Hung' => hit.m (M của Hùng; Hưng dùng chung); 'Hưng' có dấu => hit.k1
      const dev = makeDevice('A14', { cfg: { allowlistMode: false } });
      const lkPlain = await dev.call('apiLookupRegistration', 'Nguyen Van Hung'), lkHung2 = await dev.call('apiLookupRegistration', 'Nguyễn Văn Hưng');
      record('S14', 'seedTeams (admin.html, chạy thật): shape {at,icon}, M 1 lần, CONFLICT',
        'docs = k1 từng người + 1 M/nhóm; mọi doc {at,icon}; "LÊ VĂN A" trùng k1 với "Lê Văn A" => CONFLICT, bị bỏ (không ghi đè, không vào teams.names); lookup đọc được',
        `seeded=${res.seeded} conflicts=${J(res.conflicts)} docs=${J(docs)} teams=${J(Object.fromEntries(Object.entries(s.teams).map(([k, v]) => [k, v.names])))} lkPlain=${J(lkPlain)} lkHưng=${J(lkHung2)}`,
        res.seeded === 4 && res.conflicts.length === 1 && J(docs) === J(want) && shapeOk && J(s.teams['🐬'].names) === J(['Lê Văn A', 'Le Van B']) && lkPlain.found && lkPlain.hit.m && lkHung2.found && lkHung2.hit.k1);
    }

    // S15 — tên "~Nguyen Van Hung" KHÔNG chiếm được khoá M (M dùng tiền tố "m~"; _dedupKey luôn UPPER nên không bao giờ trùng)
    await reset();
    {
      const off = { allowlistMode: false };
      const a = makeDevice('A15a', { cfg: off }), b = makeDevice('A15b', { cfg: off });
      const r1 = await claim(a, '🌸', '~Nguyen Van Hung'); const r2 = await claim(b, '🐬', 'Nguyen Van Hung'); const s = await snap();
      record('S15', 'tên "~Nguyen Van Hung" không chặn được "Nguyen Van Hung"', 'cả hai join được (trước khi đổi prefix M="~F" thì người sau bị chặn: griefing); docs không có "m~..."',
        `r1=${r1.ok} r2=${J(r2)} docs=${J(Object.keys(s.dedup).sort())}`, r1.ok && r2.ok && Object.keys(s.dedup).length === 2 && mKey('Nguyễn Văn Hùng') === 'm~NGUYENVANHUNG');
    }
  },
};
