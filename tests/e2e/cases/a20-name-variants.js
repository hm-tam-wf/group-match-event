'use strict';
// Layer A — tra cứu biến thể tên (hoa/thường, khoảng trắng, NFD) và so BẤT ĐỐI XỨNG có dấu / không dấu (k1 / F / M="m~F").
const J = x => JSON.stringify(x);

module.exports = {
  async run({ L, record }) {
    const { reset, snap, makeDevice, claim, FAKE, NAMED, dedupKey, foldKey, mKey } = L;

    // S3 — thiết bị B tra cứu biến thể tên (hoa/thường, khoảng trắng, NFD)
    await reset();
    {
      const a = makeDevice('A3a'), c = makeDevice('A3c'), b = makeDevice('A3b');
      await claim(c, '🌸', FAKE(1)); const ra = await claim(a, '🌸', NAMED[0]);
      const variants = ['LÊ THỊ ALPHA', '  lê   thị   alpha  ', NAMED[0].normalize('NFD'), NAMED[0]];
      const out = []; for (const v of variants) out.push(await b.call('apiLookupRegistration', v));
      const st = await b.call('apiState');
      const pass = ra.ok && out.every(o => o.found && o.icon === '🌸') && st['🌸'].names.includes(FAKE(1)) && st['🌸'].names.includes(NAMED[0]);
      record('S3', 'B tra cứu biến thể tên', '4/4 found icon=🌸, names gồm 2 người', J(out) + ' names=' + J(st['🌸'] && st['🌸'].names), pass);
    }

    // S4 — KHÔNG dấu vs CÓ dấu: so BẤT ĐỐI XỨNG (k1 / F / M="m~F"). Cả 2 thứ tự, allowlist tắt (để không bị allowlist chặn thay).
    {
      const off = { allowlistMode: false }; const want = '🌸';
      // (a) có dấu trước → không dấu sau: DUP (đọc M), lookup thấy phòng qua M
      await reset();
      const a = makeDevice('A4a', { cfg: off }), b = makeDevice('A4b', { cfg: off }), b2 = makeDevice('A4c');
      const nm = NAMED[0], plain = 'Le Thi Alpha';
      const ra = await claim(a, '🌸', nm);
      const lk = await b.call('apiLookupRegistration', plain);
      const taken = await b.call('apiDedupTaken', plain);
      const cl = await claim(b, '🐬', plain);                    // allowlist tắt: trước đây lọt => đăng ký đôi
      const cl2 = await claim(b2, '🐬', plain);                  // allowlist BẬT (prod-like): DUP đến trước NOT_ALLOWED trong transaction
      const s = await snap();
      const docs = Object.keys(s.dedup).sort();
      const pass = ra.ok && lk.found === true && lk.icon === want && lk.hit.m === true && lk.hit.k1 === false && taken === true && cl.reason === 'dup' && (cl.icon || null) === want && cl.hit.m === true && cl2.reason === 'dup'
        && L.totalCount(s) === 1 && Object.keys(s.members).length === 1
        && J(docs) === J([dedupKey(nm), mKey(nm)].sort()) && docs.every(k => J(Object.keys(s.dedup[k]).sort()) === '["at","icon"]');
      record('S4a', 'có dấu trước, KHÔNG dấu sau (allowlist tắt) => DUP + lookup thấy phòng (qua M)',
        `claim không dấu=dup (hit.m, icon=${want}); lookup found hit.m; apiDedupTaken=true; count=1, 1 member; docs = k1 + ~fold (không có doc fold thường)`,
        `lookup=${J(lk)} taken=${taken} claim(allowlist off)=${J(cl)} claim(allowlist on)=${J(cl2)} count=${L.totalCount(s)} members=${Object.keys(s.members).length} docs=${J(docs)}`, pass);
      // (b) không dấu trước → có dấu sau: DUP (đọc F = k1 của bản không dấu), KHÔNG ghi M
      await reset();
      const c = makeDevice('A4d', { cfg: off }), d = makeDevice('A4e', { cfg: off });
      const rc = await claim(c, '🌸', plain);
      const rd = await claim(d, '🐬', nm);
      const lk2 = await d.call('apiLookupRegistration', nm);
      const s2 = await snap();
      const docs2 = Object.keys(s2.dedup);
      const pass2 = rc.ok && rd.reason === 'dup' && (rd.icon || null) === want && rd.hit.f === true && lk2.found === true && lk2.hit.f === true && lk2.hit.k1 === false && L.totalCount(s2) === 1 && Object.keys(s2.members).length === 1 && docs2.length === 1 && docs2[0] === foldKey(plain);
      record('S4b', 'KHÔNG dấu trước, có dấu sau (allowlist tắt) => DUP (hit.f), không ghi M',
        `claim có dấu=dup (hit.f, icon=${want}); lookup found hit.f; count=1; chỉ 1 doc (k1 của bản không dấu)`,
        `claim=${J(rd)} lookup=${J(lk2)} count=${L.totalCount(s2)} docs=${J(docs2)}`, pass2);
    }
  },
};
