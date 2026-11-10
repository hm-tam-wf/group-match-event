'use strict';
// S16 — backend/scripts/backfill-dedup-icon.js chạy THẬT (process con) trên emulator: quét toàn bộ dedup_keys,
// KHÔNG cần members/signups. Script chạy với --project = project demo-* của bộ test (nhánh emulator của script).
const path = require('path'), { execFileSync } = require('child_process');
const J = x => JSON.stringify(x);
const BF_EVENT = 'bf-ev';

module.exports = {
  async run(t) {
    const { L, record } = t;
    await L.reset();
    const env = t.childEnv();
    if (env.FIRESTORE_EMULATOR_HOST !== `${L.EMU_HOST}:${L.EMU_PORT}`) throw new Error('S16 chỉ được chạy trên emulator');
    const ts = ms => L.admin.firestore.Timestamp.fromMillis(ms);
    await L.adb.collection('config').doc('active').set({ eventId: BF_EVENT });
    const ev2 = L.adb.collection('events').doc(BF_EVENT); await ev2.collection('meta').doc('config').set({ dedupField: 'name' });
    const dk = (id, d) => ev2.collection('dedup_keys').doc(id).set(d);
    await dk('NGUYỄNVĂNHƯNG', { at: ts(1000) });                    // sớm nhất, KHÔNG icon, không member/signup
    await dk('NGUYỄNVĂNHÙNG', { at: ts(2000), icon: '🌸' });        // cùng fold với Hưng ⇒ dùng chung 1 M, icon lấy từ doc có icon
    await dk('LÊVĂNA', { at: ts(3000), icon: '🐬' }); await dk('m~LEVANA', { at: ts(9999), icon: '🦈' });   // M đã có ⇒ KHÔNG đè
    await dk('LEVANB', { at: ts(4000), icon: '🌸' });               // không dấu ⇒ không cần M
    await dk('ĐẶNG', { at: ts(5000), icon: '🦈' }); await dk('DANG', { at: ts(5001), icon: '🌸' });         // có dấu + doc không dấu cùng fold ⇒ CONFLICT
    const run = (...args) => execFileSync(process.execPath, [t.script('backfill-dedup-icon.js'), '--project', L.PROJECT, ...args],
      { cwd: path.join(L.REPO, 'backend'), env, encoding: 'utf8' });
    const dry = run();
    const afterDry = (await ev2.collection('dedup_keys').get()).size;
    const app1 = run('--apply');
    const snapDocs = async () => { const q = await ev2.collection('dedup_keys').get(); const o = {}; q.forEach(d => o[d.id] = d.data()); return o; };
    const d1 = await snapDocs();
    const app2 = run('--apply'); const d2 = await snapDocs();
    const mH = d1['m~NGUYENVANHUNG'], mD = d1['m~DANG'];
    const pass = afterDry === 7 && /M se tao=2 /.test(dry) && /CONFLICT=1/.test(dry) && /nhom gan giong=1/.test(dry)
      && Object.keys(d1).length === 9 && mH && mH.icon === '🌸' && mH.at.toMillis() === 1000 && mD && mD.icon === '🦈' && d1['m~LEVANA'].icon === '🦈' && d1['m~LEVANA'].at.toMillis() === 9999 && !d1['m~LEVANB']
      && /Da tao 2 dedup_keys/.test(app1) && /Da tao 0 dedup_keys/.test(app2) && Object.keys(d2).length === 9;
    record('S16', 'backfill M trên emulator (doc dedup KHÔNG có member/signup)', 'dry-run không ghi; apply tạo 2 M (Hùng/Hưng dùng chung 1: icon 🌸, at=sớm nhất; ĐẶNG→m~DANG); m~LEVANA có sẵn giữ nguyên; CONFLICT=1; chạy lại tạo 0',
      `afterDry=${afterDry} docsAfterApply=${Object.keys(d1).length} dry="${(dry.match(/TONG M:[^\n]*/) || [''])[0]}" apply1="${(app1.match(/Da tao[^\n]*/) || [''])[0]}" apply2="${(app2.match(/Da tao[^\n]*/) || [''])[0]}" mHung=${J(mH && { icon: mH.icon, at: mH.at.toMillis() })} conflicts=${(dry.match(/CONFLICT fold[^\n]*/g) || []).length}`, pass);
  },
};
