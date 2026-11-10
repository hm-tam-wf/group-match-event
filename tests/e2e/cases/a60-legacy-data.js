'use strict';
// Layer A — dữ liệu production CŨ (chỉ có doc k1, chưa backfill M): ghi nhận khoảng hở trước / sau backfill.
const J = x => JSON.stringify(x);

module.exports = {
  async run({ L, record }) {
    const { reset, makeDevice, claim, dedupKey, mKey, ev } = L;

    // S13 — dữ liệu production CŨ (chỉ có doc k1, chưa backfill M): ghi nhận khoảng hở trước backfill
    await reset();
    {
      const off = { allowlistMode: false };
      const nm = 'Lê Văn A';
      await ev().collection('dedup_keys').doc(dedupKey(nm)).set({ at: new Date(), icon: '🌸' });         // như production cũ
      const a = makeDevice('A13a', { cfg: off }), b = makeDevice('A13b', { cfg: off });
      const lkDia = await a.call('apiLookupRegistration', nm), lkPlain = await a.call('apiLookupRegistration', 'Le Van A');
      const rDia = await claim(a, '🐬', nm);
      const rPlain = await claim(b, '🐬', 'Le Van A');                                                   // khoảng hở: chưa có M => lọt
      await reset();
      await ev().collection('dedup_keys').doc(dedupKey(nm)).set({ at: new Date(), icon: '🌸' });
      await ev().collection('dedup_keys').doc(mKey(nm)).set({ at: new Date(), icon: '🌸' });             // sau backfill (M = "m~fold")
      const c = makeDevice('A13c', { cfg: off });
      const lkAfter = await c.call('apiLookupRegistration', 'Le Van A'); const rAfter = await claim(c, '🐬', 'Le Van A');
      record('S13', 'doc production cũ chỉ có k1: trước / sau backfill M',
        'TRƯỚC backfill: gõ đúng dấu => dup+lookup OK; gõ KHÔNG dấu => lookup trượt & claim lọt (khoảng hở). SAU backfill: không dấu => found (hit.m) + dup',
        `trước: lookupCóDấu=${J(lkDia)} lookupKhôngDấu=${J(lkPlain)} claimCóDấu=${rDia.reason} claimKhôngDấu=${rPlain.ok ? 'OK(lọt)' : rPlain.reason} | sau: lookup=${J(lkAfter)} claim=${rAfter.reason}`,
        lkDia.found && lkPlain.found === false && rDia.reason === 'dup' && rPlain.ok === true && lkAfter.found && lkAfter.hit.m === true && rAfter.reason === 'dup',
        'PHẢI chạy backfill-dedup-icon.js --apply (tạo M) trước khi dựa vào chặn không-dấu cho đăng ký đã có');
    }
  },
};
