'use strict';
// Layer A — tên chỉ khác dấu là NGƯỜI KHÁC; tên không dấu bị chặn khi đã có người cùng fold (khoá M).
const J = x => JSON.stringify(x);

module.exports = {
  async run({ L, record }) {
    const { reset, snap, makeDevice, claim, mKey } = L;

    // S12 — "Lê Văn A" vs "Lệ Vân A" (chỉ khác dấu) là 2 NGƯỜI KHÁC: cả hai join được (đổi kỳ vọng so với thiết kế fold cũ)
    await reset();
    {
      const a = makeDevice('A12a', { cfg: { allowlistMode: false } }), b = makeDevice('A12b', { cfg: { allowlistMode: false } });
      const r1 = await claim(a, '🌸', 'Lê Văn A'); const r2 = await claim(b, '🐬', 'Lệ Vân A'); const s = await snap();
      record('S12', '"Lê Văn A" vs "Lệ Vân A" (chỉ khác dấu) là 2 người khác nhau',
        'ĐỔI KỲ VỌNG (thiết kế fold cũ chặn người thứ hai): cả hai ok; count=2; docs = 2 k1 + 1 M dùng chung',
        `r1=${J(r1)} r2=${J(r2)} count=${L.totalCount(s)} docs=${J(Object.keys(s.dedup).sort())}`,
        r1.ok && r2.ok && L.totalCount(s) === 2 && Object.keys(s.dedup).length === 3 && !!s.dedup[mKey('Lê Văn A')]);
    }

    // S12b — "Hùng" rồi "Hưng" (tuần tự) đều join; sau đó "Nguyen Van Hung" bị chặn + lookup thấy M
    await reset();
    {
      const off = { allowlistMode: false };
      const a = makeDevice('A12ba', { cfg: off }), b = makeDevice('A12bb', { cfg: off }), c = makeDevice('A12bc', { cfg: off });
      const r1 = await claim(a, '🌸', 'Nguyễn Văn Hùng'), r2 = await claim(b, '🐬', 'Nguyễn Văn Hưng'); const r3 = await claim(c, '🦈', 'Nguyen Van Hung');
      const lkPlain = await c.call('apiLookupRegistration', 'Nguyen Van Hung'), lkHung2 = await c.call('apiLookupRegistration', 'Nguyễn Văn Hưng');
      const s = await snap();
      record('S12b', '"Hùng" rồi "Hưng" đều join; "Nguyen Van Hung" sau đó bị chặn',
        'r1,r2 ok; r3 dup (hit.m); lookup không dấu found hit.m; lookup "Hưng" found hit.k1; count=2',
        `r1=${r1.ok} r2=${r2.ok} r3=${J(r3)} lkPlain=${J(lkPlain)} lkHưng=${J(lkHung2)} count=${L.totalCount(s)}`,
        r1.ok && r2.ok && r3.reason === 'dup' && r3.hit.m === true && lkPlain.found && lkPlain.hit.m && lkHung2.found && lkHung2.hit.k1 && L.totalCount(s) === 2);
    }
  },
};
