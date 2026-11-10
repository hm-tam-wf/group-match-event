// Mock window.firebase (auth + Firestore in-memory) để chạy admin.html THẬT trong trình duyệt headless, không mạng.
// build.js thay các thẻ <script> Firebase CDN của admin.html bằng file này. Dữ liệu mẫu bên dưới là GIẢ.
// Query: ?delay=ms (mạng chậm) · ?auth=out · ?authDelay=ms · ?signinDelay=ms · mật khẩu "wrong" ⇒ auth/invalid-credential.
(function () {
  const now = Math.floor(Date.now() / 1000);
  const ts = s => ({ seconds: s, nanoseconds: 0, toDate() { return new Date(s * 1000); }, toMillis() { return s * 1000; } });
  const store = {};                       // path -> data
  const put = (p, d) => { store[p] = JSON.parse(JSON.stringify(d, (k, v) => v)); restoreTs(store[p], d); };
  function restoreTs(dst, src) { for (const k in src) { const v = src[k]; if (v && typeof v.toMillis === 'function') dst[k] = v; else if (v && typeof v === 'object' && !Array.isArray(v)) restoreTs(dst[k], v); } }

  const icons = [
    { icon: '1', name: 'Phòng 1', color: '#5B8CFF', gender: 'M' }, { icon: '2', name: 'Phòng 2', color: '#FF7AB6', gender: 'F' },
    { icon: '3', name: 'Phòng 3', color: '#43D9AD', gender: 'F' }, { icon: '4', name: 'Phòng 4', color: '#FFB547', gender: 'M' },
    { icon: '5', name: 'Phòng 5', color: '#A98CFF' }, { icon: '6', name: 'Phòng 6', color: '#55E8FF' }];
  const fields = [{ key: 'name', label: 'Họ tên', required: true }, { key: 'employeeId', label: 'Mã nhân viên', required: true }];
  put('config/eventList', { ids: ['tnt-mini-outing', 'faraday-2026', 'q2-team-building'] });
  put('config/active', { eventId: 'tnt-mini-outing' });
  put('events/tnt-mini-outing/meta/config', { title: 'TNT Mini Outing 2026', subtitle: 'Mỗi phòng là <b>1 đội</b>', capacity: 8, icons, fields, dedupField: 'employeeId', blockDup: true, createdAt: ts(now - 86400 * 2) });
  put('events/faraday-2026/meta/config', { title: 'Faraday Pick Your Squad', capacity: 10, icons: icons.slice(0, 4), fields, dedupField: 'employeeId', createdAt: ts(now - 86400 * 30) });
  put('events/q2-team-building/meta/config', { title: 'Team Building Q2', capacity: 12, icons: icons.slice(0, 5), fields, createdAt: ts(now - 86400 * 90) });
  const counts = { 1: 8, 2: 7, 3: 8, 4: 5, 5: 3, 6: 6 };
  const people = ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Thuỳ Nhung', 'Đỗ Minh Khoa', 'Võ Thị Lan', 'Bùi Quốc Huy', 'Hoàng Gia Bảo', 'Ngô Thanh Vy', 'Đặng Hải Yến'];
  let n = 0;
  Object.keys(counts).forEach(ic => {
    put('events/tnt-mini-outing/teams/' + ic, { count: counts[ic], names: [] });
    for (let i = 0; i < Math.min(counts[ic], 2); i++) {
      const nm = people[n % people.length]; n++;
      put('events/tnt-mini-outing/signups/s' + n, { icon: ic, name: nm, employeeId: n === 3 || n === 7 ? '22011463' : '2201' + String(1000 + n), at: ts(now - 3600 * (20 - n)) });
    }
  });
  [['1', 10], ['2', 10], ['3', 9], ['4', 6]].forEach(([ic, c]) => put('events/faraday-2026/teams/' + ic, { count: c, names: [] }));

  const DELAY = +(new URLSearchParams(location.search).get('delay') || 0);   // ?delay=ms → giả lập mạng chậm (chụp skeleton)
  const wait = () => new Promise(r => setTimeout(r, DELAY));
  const snapDoc = (p) => { const id = p.split('/').pop(); const d = store[p]; return { id, exists: d !== undefined, data: () => d, ref: docRef(p) }; };
  const children = (p) => Object.keys(store).filter(k => k.startsWith(p + '/') && k.slice(p.length + 1).indexOf('/') < 0);
  function docRef(p) {
    return {
      id: p.split('/').pop(), path: p,
      collection: c => collRef(p + '/' + c),
      get: async () => { await wait(); return snapDoc(p); },
      set: async (d, o) => { store[p] = o && o.merge ? Object.assign({}, store[p] || {}, d) : d; },
      update: async d => { store[p] = Object.assign({}, store[p] || {}, d); },
      delete: async () => { delete store[p]; },
      onSnapshot: cb => { cb(snapDoc(p)); return () => {}; }
    };
  }
  function collRef(p, lim) {
    const q = {
      path: p,
      doc: id => docRef(p + '/' + (id || ('auto' + Math.random().toString(36).slice(2, 8)))),
      where: () => q, orderBy: () => q, limit: k => collRef(p, k), startAfter: () => q,
      get: async () => { await wait(); let docs = children(p).map(snapDoc); if (lim) docs = docs.slice(0, lim); return { docs, empty: !docs.length, size: docs.length, forEach: f => docs.forEach(f) }; },
      onSnapshot: cb => { q.get().then(cb); return () => {}; }
    };
    return q;
  }
  const db = {
    collection: c => collRef(c),
    batch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
    runTransaction: async f => f({ get: r => r.get(), set() {}, update() {}, delete() {} })
  };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => ts(now), arrayRemove: () => [], arrayUnion: (...a) => a, increment: x => x, delete: () => undefined };
  firestore.Timestamp = { now: () => ts(now), fromDate: d => ts(Math.floor(d / 1000)), fromMillis: m => ts(Math.floor(m / 1000)) };
  const user = { email: 'admin@example.com', uid: 'demo-admin' };
  // ?auth=out → chưa đăng nhập; ?authDelay=ms → Firebase báo trạng thái chậm (thấy màn chờ);
  // ?signinDelay=ms (mặc định 600) → thời gian đăng nhập; mật khẩu "wrong" → lỗi auth/invalid-credential.
  const Q = new URLSearchParams(location.search);
  let cur = Q.get('auth') === 'out' ? null : user; const ls = [];
  const authObj = {
    get currentUser() { return cur; },
    onAuthStateChanged: cb => { ls.push(cb); setTimeout(() => cb(cur), +(Q.get('authDelay') || 0)); },
    signOut: async () => { cur = null; ls.forEach(f => f(null)); },
    signInWithEmailAndPassword: async (e, p) => {
      await new Promise(r => setTimeout(r, +(Q.get('signinDelay') || 600)));
      if (p === 'wrong') { const err = new Error('wrong'); err.code = 'auth/invalid-credential'; throw err; }
      cur = user; ls.forEach(f => f(user)); return { user };
    }
  };
  window.firebase = { initializeApp() {}, firestore, auth: () => authObj };
})();
