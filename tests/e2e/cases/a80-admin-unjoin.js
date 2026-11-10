'use strict';
// Layer A — admin gỡ đăng ký (xoá dedup_keys) ⇒ tra cứu nhả tên.
const J = x => JSON.stringify(x);

module.exports = {
  async run({ L, record }) {
    const { reset, makeDevice, claim, NAMED, dedupKey, mKey, ev } = L;

    // S7 — admin xoá dedup_keys => lookup nhả
    await reset();
    {
      const a = makeDevice('A7a'), b = makeDevice('A7b');
      await claim(a, '🌸', NAMED[3]);
      const l1 = await b.call('apiLookupRegistration', NAMED[3]);
      await ev().collection('dedup_keys').doc(dedupKey(NAMED[3])).delete();                 // chỉ xoá k1: tên CÓ dấu được nhả ngay; M còn => gõ KHÔNG dấu VẪN bị giữ chỗ
      const l2 = await b.call('apiLookupRegistration', NAMED[3]);
      const l2p = await b.call('apiLookupRegistration', 'Vo Delta Test');
      await ev().collection('dedup_keys').doc(mKey(NAMED[3])).delete();                     // xoá nốt M => nhả hẳn
      const l3 = await b.call('apiLookupRegistration', NAMED[3]);
      const l4 = await b.call('apiLookupRegistration', 'Vo Delta Test');
      record('S7[A]', 'admin gỡ đăng ký: xoá k1 (và M nếu muốn nhả cả bản không dấu) => lookup nhả', 'trước: found+🌸 ; chỉ xoá k1: có dấu found=false nhưng KHÔNG dấu vẫn found (M); xoá cả M: cả hai found=false', J([l1, l2, l2p, l3, l4]),
        l1.found && l1.icon === '🌸' && l2.found === false && l2p.found === true && l2p.hit.m === true && l3.found === false && l4.found === false, 'gỡ 1 người = xoá dedup_keys/{k1}; muốn nhả cả bản không dấu thì xoá thêm dedup_keys/m~{fold} (nếu không còn ai tên có dấu cùng fold)');
    }
  },
};
