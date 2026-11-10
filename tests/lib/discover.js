'use strict';
// Tự dò file case của một suite: tests/<suite>/cases/*.js, chạy theo thứ tự TÊN FILE.
// File bắt đầu bằng "_" bị bỏ qua (helper / mẫu). Lọc: tham số dòng lệnh hoặc TEST_ONLY (phẩy ngăn cách),
// giữ file có tên CHỨA một trong các chuỗi lọc. Tham số bắt đầu bằng "--" là cờ của runner, không phải bộ lọc.
const fs = require('fs'), path = require('path');
const C = require('./config');

function filters(argv = process.argv.slice(2)) {
  return argv.filter(a => !a.startsWith('--')).concat(C.ONLY);
}
const hasFlag = (name, argv = process.argv.slice(2)) => argv.includes(name);

function listCases(dir, fl = filters()) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_')).sort();
  const picked = fl.length ? files.filter(f => fl.some(x => f.includes(x))) : files;
  if (fl.length && !picked.length) throw new Error(`Không có file case nào khớp bộ lọc ${JSON.stringify(fl)} trong ${dir}`);
  return picked.map(f => ({ file: f, path: path.join(dir, f) }));
}

module.exports = { listCases, filters, hasFlag };
