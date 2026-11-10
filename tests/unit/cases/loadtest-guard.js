'use strict';
// backend/scripts/loadtest.js: --cleanup-only với ID không phải loadtest-<số> bị TỪ CHỐI trước khi chạm Firestore.
// An toàn: SA_KEY_PATH rỗng ⇒ kể cả khi guard hỏng, script dừng ở bước thiếu key (không bao giờ kết nối project thật).
const path = require('path'), { spawnSync } = require('child_process');

module.exports = {
  async run(t) {
    const r = spawnSync(process.execPath, [path.join(t.REPO, 'backend/scripts/loadtest.js'), '--cleanup-only', 'mini-outing-2026'],
      { cwd: t.OUT, encoding: 'utf8', env: t.childEnv({ SA_KEY_PATH: '' }) });
    t.ok('loadtest --cleanup-only <ID thật> bị từ chối (exit 1, "Tu choi")', r.status === 1 && /Tu choi/.test(r.stderr), { status: r.status, err: (r.stderr || '').slice(0, 200) });
  },
};
