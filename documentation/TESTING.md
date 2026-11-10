# Kiểm thử — chạy local, CI, thêm case

Bộ test nằm trong `tests/`, chạy **code thật của repo** (không mock app): FE nạp nguyên văn vào Node, trang thật trong
trình duyệt headless, rules thật + script backend thật trên **Firestore Emulator** (project `demo-icon-picker`).
Không bao giờ chạm Firebase production (xem [An toàn](#an-toàn)).

## Các suite

| Suite | Lệnh | Cần | Kiểm gì | Hiện có |
|---|---|---|---|---|
| unit | `npm run test:unit` | Node | hàm FE / guard script backend chạy trong `vm` | 26 |
| rules | `npm run test:rules` | Node + Java + firebase-tools | rules `dedup_keys` / `teams` / `signups` (client trần + admin) | 3 nhóm (42 thao tác) |
| scripts | `npm run test:scripts` | Node + Java + firebase-tools | `backend/scripts/*.js` chạy thật trên emulator (export, backfill) | 12 |
| admin | `npm run test:admin` | Node + Chrome/Edge | `fe/admin.html` thật với Firebase GIẢ (không mạng) | 10 |
| e2e | `npm run test:e2e` | Node + Java + firebase-tools + Chrome/Edge | luồng đăng ký: "thiết bị" Node (`a*`) + trình duyệt thật (`b*`) | 54 |

`npm test` chạy cả 5 suite **tuần tự** (suite trước FAIL vẫn chạy suite sau) rồi in tổng kết. Chọn bớt: `node tests/run-all.js unit rules`.
Thời gian đo trên máy dev (Windows, Edge): unit ~2s, rules ~10s, scripts ~10s, admin ~10s, e2e ~3 phút (gồm bật/tắt emulator).

## Chuẩn bị máy local

1. Node 22+ (CI dùng Node 26) → `npm ci`.
2. Java 21+ cho emulator (rules / scripts / e2e): đặt `JAVA_HOME` hoặc để `java` trên PATH. JRE portable cũng chạy được.
3. firebase-tools **đúng bản cố định** ở `package.json → config.firebaseTools` (hiện `15.19.1`): `npm i -g firebase-tools@15.19.1`.
   Lệch bản ⇒ harness chỉ cảnh báo. Lần chạy đầu firebase-tools tự tải jar emulator (~vài chục MB).
4. Chrome hoặc Edge (admin / e2e): tự dò — Windows: Edge rồi Chrome; macOS: Chrome, Edge, Chromium; Linux: `google-chrome`,
   `chromium`… trên PATH. Hoặc chỉ định `TEST_BROWSER`.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `TEST_PORT_BASE` | `21000` | Cổng emulator = base + 80 (Firestore), +150 (websocket), +400 (hub), +500 (logging) ⇒ mặc định 21080/21150/21400/21500. Chạy song song nhiều đợt trên cùng máy ⇒ mỗi đợt một base. |
| `TEST_REPO` | repo chứa `tests/` | Repo cần test (`fe/`, `backend/`). Cho phép dùng bộ test của worktree này kiểm worktree khác. |
| `TEST_RULES` | `<TEST_REPO>/backend/firestore.rules` | File rules nạp vào emulator (vd thử bản rules đang chạy production). |
| `JAVA_HOME` | — | Java cho emulator; không có thì tìm `java` trên PATH. |
| `TEST_FIREBASE_BIN` | `firebase` | Đường dẫn CLI firebase. |
| `TEST_BROWSER` (hoặc `CHROME_PATH`) | tự dò | File chạy Chrome/Edge. |
| `TEST_HEADFUL=1` | tắt | Mở trình duyệt có giao diện để xem test chạy. |
| `TEST_NO_SANDBOX=1` | tự bật khi `CI` trên Linux | Thêm `--no-sandbox` cho Chrome. |
| `TEST_ONLY` | — | Lọc file case (phẩy ngăn cách, giữ file có tên CHỨA chuỗi). Dùng khi chạy 1 suite — suite không có file khớp sẽ báo lỗi. |
| `TEST_OUT_DIR` | `tests/.out` | Log emulator, `<suite>-results.json`, bản admin dựng tạm, ảnh smoke (đã gitignore). |
| `TEST_LIVE_BASE` | GitHub Pages | Chỉ cho smoke tay. |

## Chạy

```bash
npm test                                  # tất cả
npm run test:e2e -- b70 b80               # chỉ file case có tên chứa "b70" hoặc "b80"
npm run test:e2e -- --node                # chỉ thiết bị Node (a*), không mở trình duyệt
npm run test:e2e -- --browser             # chỉ trình duyệt (b*)
TEST_HEADFUL=1 npm run test:e2e -- b30    # xem trình duyệt
TEST_PORT_BASE=48000 npm run test:rules   # đổi dải cổng
```

PowerShell: `$env:TEST_PORT_BASE=48000; npm run test:rules` (xoá: `Remove-Item Env:TEST_PORT_BASE`).

- Mỗi kiểm tra in `PASS`/`FAIL` (kịch bản e2e/rules in thêm `expected` / `actual`), cuối suite có bảng `SUMMARY` + dòng `<SUITE>: TOTAL … PASS … FAIL …`.
- Kết quả JSON: `tests/.out/<suite>-results.json`. Log emulator: `tests/.out/emulator-<suite>/` (`emulator.log`, `firestore-debug.log`).
- Exit code: `0` tất cả PASS · `1` có kiểm tra FAIL · `2` lỗi môi trường (thiếu Java / CLI / trình duyệt, cổng bận…).
- Emulator do suite tự bật và tự tắt (kể cả khi Ctrl+C / lỗi). Cổng đang bận ⇒ suite dừng ngay với thông báo, KHÔNG dùng chung emulator lạ.

## An toàn

- Project Firestore luôn `demo-icon-picker` (tiền tố `demo-` ⇒ emulator, không cần credential). Fixture ép `FIRESTORE_EMULATOR_HOST`
  và xoá `GOOGLE_APPLICATION_CREDENTIALS` khỏi process test + process con.
- Trình duyệt e2e: static server **vá** `fe/js/config/firebase-config.js` khi phục vụ (projectId demo + `useEmulator`), không sửa file repo.
  Vá không áp dụng được ⇒ trả 500 + FAIL (không bao giờ phục vụ bản gốc). Thêm lưới an toàn: trình duyệt test chặn DNS `firestore.googleapis.com`.
- Script backend chạy với `FIRESTORE_EMULATOR_HOST` cố định (các script có nhánh dùng service account thật khi thiếu biến này).
- Smoke tay (`tests/smoke/`) là thứ DUY NHẤT mở site thật — chỉ đọc, không submit form, không chạy trong CI / `npm test`.

## Thêm case mới

Mọi suite cùng một quy ước: **thêm 1 file `tests/<suite>/cases/<tên>.js`** export `run(t)` → runner tự nhận, chạy theo thứ tự
**tên file** (đặt tiền tố số để xếp chỗ). File bắt đầu bằng `_` bị bỏ qua (helper / mẫu). File ném lỗi giữa chừng ⇒ 1 dòng
`FAIL <file> CRASH` kèm stack, các file sau vẫn chạy. Mỗi file nên tự `reset()` dữ liệu ở đầu ⇒ không phụ thuộc thứ tự.

### unit — `tests/unit/cases/*.js`

```js
'use strict';
const vm = require('vm');
module.exports = {
  async run(t) {
    const ctx = vm.createContext({ console, URLSearchParams, location: { search: '?e=abc', hostname: 'x' },
      localStorage: { getItem() { return null; }, setItem() {} },
      document: { documentElement: { lang: '', setAttribute() {}, getAttribute() { return null; } } } });
    // mỗi file = 1 <script> riêng trong CÙNG context (let/const top-level dùng chung, khai trùng vẫn báo lỗi như trình duyệt)
    t.runScripts(ctx, ['fe/js/config/theme.js', 'fe/js/config/config.js']);
    if (t.exists('fe/js/config/profile.js')) t.runScripts(ctx, ['fe/js/config/profile.js']);
    t.ok('LANG mặc định là en', vm.runInContext('LANG', ctx) === 'en', vm.runInContext('LANG', ctx));
  },
};
```

`t`: `ok(tên, điềuKiện, infoKhiFail)` · `read(rel)` (đọc file của repo cần test, CRLF→LF) · `exists(rel)` · `runScripts(ctx, [rel…])` ·
`childEnv(extra)` (env cho process con chạy script backend) · `sleep(ms)` · `REPO` · `ROOT` · `OUT`.
Trích một hàm khỏi file lớn: `/function tên[\s\S]*?\n\}\n/.exec(t.read('fe/js/…'))` rồi chạy trong `vm` (xem `close-timer.js`, `api-subscribe.js`).

### rules — `tests/rules/cases/*.js` (1 file = 1 nhóm = 1 dòng kết quả)

```js
'use strict';
module.exports = {
  id: 'S7x', name: 'rules config: client chỉ đọc',
  // expect: tuỳ chọn — bỏ trống ⇒ tự sinh "bị từ chối: …; được phép: …" từ các thao tác
  async run(r) {
    await r.reset();
    await r.adb.collection('config').doc('hosts').set({ byHost: {} });           // seed bằng admin SDK (bỏ qua rules)
    const db = r.anon().fdb;                                                     // client chưa đăng nhập
    await r.allowed('C1 đọc config/hosts', db.collection('config').doc('hosts').get());
    await r.denied('C2 client ghi config/hosts', db.collection('config').doc('hosts').set({ byHost: { x: 'y' } }));
    await r.allowed('C3 admin ghi', r.admin().fdb.collection('config').doc('hosts').set({ byHost: {} }));
    await r.denied('C4 user thường ghi', r.authed('some-user').fdb.collection('config').doc('hosts').set({}));
  },
};
```

`r`: `reset()` · `ev()` (doc sự kiện fixture, admin SDK) · `adb` · `anon()` / `authed(uid)` / `admin()` → `{ fdb, col(tên collection con của sự kiện), FV }` ·
`denied(tên, promise)` (đúng khi `permission-denied`) · `allowed(tên, promise)` · `adminUid()` · `FAKE(n)` · `EVENT`.
Tên thao tác nên mở đầu bằng mã ngắn (`C1 …`) — bảng kết quả liệt kê theo mã.
**Admin**: `adminUid()` đọc UID đầu tiên trong danh sách cứng của `isAdmin()` (`request.auth.uid in [...]`). Rules đổi mô hình admin
(vd doc `admins/{uid}`) ⇒ sửa `adminUid()` trong `tests/rules/lib.js` và seed doc admin bằng `r.adb` trong case.

### scripts — `tests/scripts/cases/*.js` (script backend chạy THẬT trên emulator)

`t`: `L` (fixture Firestore, xem e2e) · `ok` / `record` · `script('tên.js')` (đường dẫn trong `backend/scripts`) · `childEnv(extra)`
(luôn có `FIRESTORE_EMULATOR_HOST`, không credential thật) · `tmp` (thư mục tạm) · `REPO`.
Chạy: `spawnSync(process.execPath, [t.script('export.js'), …args], { env: t.childEnv(), encoding: 'utf8' })` (mẫu: `export.js`).

### admin — `tests/admin/cases/*.js` (Firebase giả, mỗi file một context trình duyệt sạch)

`t`: `navigate(t.url('tab=signups&delay=300'))` · `ev(biểuThức)` (trả giá trị; lỗi trong trang ⇒ chuỗi `EVAL-EXC …`) ·
`waitFor(biểuThứcBoolean, ms)` · `ok` · `sleep` · `errs` (exception JS của trang) · `page` (puppeteer) · `cdp`.
Dữ liệu mẫu + query hỗ trợ (`?delay`, `?auth=out`, `?authDelay`, `?signinDelay`): `tests/admin/mock-firebase.js`.
Hook của bản dựng (`?tab=signups|allowlist|events|drawer`, `?theme=`): `tests/admin/build.js`.
Ghi dữ liệu giả trong trang: `firebase.firestore().collection('events').doc('…')…set(…)` (store trong bộ nhớ).

### e2e — `tests/e2e/cases/*.js`

**Thiết bị Node (`a<NN>-*.js`)** — nhanh, không trình duyệt; mỗi thiết bị = 1 scope nạp NGUYÊN VĂN các file trong
`DEVICE_SCRIPTS` (`tests/lib/firestore.js`) + 1 Firestore client riêng, đi QUA rules như trình duyệt:

```js
module.exports = {
  async run({ L, record }) {
    await L.reset();                                           // cfgOverride tuỳ chọn, vd L.reset({ allowlistMode: false })
    const a = L.makeDevice('X1', { cfg: { allowlistMode: false }, search: '?e=mini-outing-2026' });
    const r = await L.claim(a, '🌸', 'Tên Giả');               // = apiClaim của api.js
    const s = await L.snap();                                  // { teams, members, dedup, reg, signups } đọc bằng admin SDK
    record('X1', 'mô tả', 'kỳ vọng', JSON.stringify({ r, count: L.totalCount(s) }), r.ok && L.totalCount(s) === 1);
  },
};
```

`L`: `reset` · `snap` · `makeDevice(label, { cfg, search })` (gọi hàm FE: `dev.call('apiLookupRegistration', tên)`) · `claim` ·
`rawClient(label, { uid })` · `ev()` · `adb` · `dedupKey` / `foldKey` / `mKey` · `NAMED` / `FAKE` / `ICONS` · `EVENT` / `EVENT_CFG` · `sleep`.
FE thêm file vào luồng đăng ký ⇒ thêm vào `DEVICE_SCRIPTS` đúng thứ tự như `index.html`.

**Trình duyệt (`b<NN>-*.js`)** — khai `browser: true`; trình duyệt + static server bật một lần cho cả suite, context case quên đóng
được đóng sau mỗi file:

```js
module.exports = {
  browser: true,
  async run({ L, B, browser, record }) {
    await L.reset();
    const d = await B.openDevice(browser, 'E1', { path: 'index.html?e=mini-outing-2026' });   // seed: localStorage nạp trước
    await B.firstJoin(d, 'Tên Giả', '🌸');
    const u = await B.ui(d);                                   // ảnh chụp state UI: myIcon, remoteView, sel, banner, mates…
    record('E1', 'join qua ?e=', 'myIcon=🌸', JSON.stringify({ ic: u.myIcon }), u.myIcon === '🌸');
    await d.ctx.close();
  },
};
```

`B`: `openDevice(browser, label, { seed, wait, path })` · `load(dev, wait, reload)` · `until(dev, fnTrongTrang, arg, timeout)` ·
`enterName` · `ui` · `clickTile` · `joinViaUI` · `waitJoined` · `firstJoin` · `realClick` (click chuột thật + kiểm không bị che) ·
`seedFor(pid, tên)` · `LSK(khoá)` · `roomBase(icon)` · `baseUrl()` · hộp xác nhận tên gần giống: `waitSoft` / `softInfo` / `clickSoft` /
`noSoftModal` / `qState` · `regOff(label, icon, tên)` (người khác đăng ký sẵn, allowlist tắt) · `OFF_CFG` · `NAMES` · `srv.failMem`.
`fe/js/config/firebase-config.js` đổi cấu trúc ⇒ sửa `patchFirebaseConfig` trong `tests/e2e/browser-helpers.js` (test dừng với thông báo rõ).

## CI (`.github/workflows/ci.yml`)

- Chạy khi: pull request, push `master`, chạy tay (`workflow_dispatch`), và được `deploy.yml` gọi lại (`workflow_call`) trước khi deploy.
- Ubuntu + Node 26 + Java temurin 21 + `npm ci` + firebase-tools đúng bản trong `package.json` + Chrome có sẵn của runner.
- Cache: npm (theo `package-lock.json`), jar Firestore Emulator (theo bản firebase-tools).
- Các suite là các step riêng (unit → rules → scripts → admin → e2e); suite FAIL không chặn suite sau. Job FAIL ⇒ tải artifact
  `test-output-…` (= `tests/.out/`: log emulator + `*-results.json`) ở trang run để xem chi tiết.
- Không deploy, không secret. Tên check để đặt branch protection: **`test`**.

## Smoke tay trên site thật (chỉ đọc)

`npm run smoke:live` (= `tests/smoke/live-travel.js` + `tests/smoke/live-bfcache.js`): travel → "Chọn phòng" → index → quay lại
(+ kiểm bfcache không trắng trang). In exception / console / HTTP lỗi, chụp ảnh vào `tests/.out/smoke/`. Đổi site: `TEST_LIVE_BASE=<url/>`.

## Ánh xạ từ harness cũ (scratchpad, trước 2026-11-11)

| Cũ | Mới |
|---|---|
| `e2e/layerA.js` S1–S5, S11–S15, S7[A] | `tests/e2e/cases/a10…a80-*.js` (ID bỏ hậu tố `[flag ON ]`) |
| `layerA.js` S6 / S6b / S6c | `tests/rules/cases/dedup-keys.js` / `teams.js` / `signups.js` |
| `layerA.js` S16 (backfill) | `tests/scripts/cases/backfill-dedup-icon.js` |
| `e2e/layerB.js` | `tests/e2e/cases/b10…b95-*.js` (ID `S2[browser,flag ON ]` → `S2[browser]`) |
| `unit-step1.js` | `tests/unit/cases/*.js` (i18n nạp theme.js → … → profile.js nếu có, mỗi file một script) |
| `export-test.js` · `shot/cdp-admin-step1.js` | `tests/scripts/cases/export.js` · `tests/admin/cases/signups-export-unblock.js` |
| `shot/cdp-live.js` · `cdp-bfcache.js` | `tests/smoke/live-travel.js` · `live-bfcache.js` |
| Env `E2E_WT` / `E2E_FB_CONFIG` / `E2E_JAVA_HOME` / `E2E_EDGE` / `E2E_ONLY_B` | `TEST_REPO` / `TEST_RULES` / `JAVA_HOME` / `TEST_BROWSER` / `--browser` |

Đã gỡ (di sản cờ `DEDUP_STORE_ICON`, FE đã bỏ cờ): các biến thể "flag OFF" của S1–S5, S11–S12 + `S8[A]` (Layer A),
`S2[browser,flag OFF]`, `S8[browser]`, `S8b[browser]`, `Q5` (Layer B), env `E2E_SKIP_FLAG_OFF`, bản vá `config.js` của static server.
Giữ nguyên các kiểm tra rules chặn ghi `{at}` thiếu icon (R2, R9, R5b, R17 trong `dedup-keys.js`).
