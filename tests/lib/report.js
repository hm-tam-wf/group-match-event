'use strict';
// Ghi nhận kết quả + bảng tổng kết + file JSON (tests/.out/<suite>-results.json) — dùng chung mọi suite.
const fs = require('fs'), path = require('path');
const C = require('./config');
const NL = '\n';
const ACTUAL_MAX = 700, INFO_MAX = 600;

function safeJson(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }

function createReport(suite) {
  const results = [];
  return {
    suite,
    results,
    // Kiểu kịch bản: kỳ vọng + thực tế in ra log ⇒ đọc log CI là hiểu, không cần mở code.
    record(id, name, expected, actual, pass, note) {
      results.push({ id, name, expected, actual: String(actual), pass: !!pass, note: note || '' });
      console.log((pass ? 'PASS ' : 'FAIL ') + id + ' ' + name + NL + '   expected: ' + expected + NL
        + '   actual:   ' + String(actual).slice(0, ACTUAL_MAX));
    },
    // Kiểu unit: tên + điều kiện; FAIL thì in thêm info.
    ok(name, cond, info) {
      results.push({ id: name, name, pass: !!cond, info: cond ? undefined : safeJson(info) });
      console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + safeJson(info).slice(0, INFO_MAX)));
    },
    // File case ném lỗi giữa chừng ⇒ 1 dòng FAIL (suite vẫn chạy tiếp các file sau).
    crash(file, err) {
      const cause = err && err.cause ? NL + 'cause: ' + ((err.cause && (err.cause.stack || err.cause.message)) || String(err.cause)) : '';
      const msg = ((err && err.stack) || String(err)) + cause;
      results.push({ id: file, name: 'CRASH', pass: false, actual: msg });
      console.log('FAIL ' + file + ' CRASH' + NL + '   ' + msg.split(NL).slice(0, 8).join(NL + '   '));
    },
    // In bảng + ghi JSON; trả về số case FAIL.
    summary() {
      const failed = results.filter(r => !r.pass);
      console.log(NL + '================ SUMMARY ' + suite + ' ================');
      results.forEach(r => console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + (r.name === r.id ? String(r.id) : String(r.id).padEnd(34) + r.name)));
      console.log(NL + `${suite.toUpperCase()}: TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`);
      try {
        fs.mkdirSync(C.OUT, { recursive: true });
        fs.writeFileSync(path.join(C.OUT, suite + '-results.json'), JSON.stringify(results, null, 1));
      } catch (e) { console.warn('không ghi được file kết quả: ' + e.message); }
      return failed.length;
    },
  };
}

// Thoát có trễ: chờ stdout xả hết + đóng kết nối Firestore/gRPC còn treo (giống harness gốc).
function exitLater(code) { setTimeout(() => process.exit(code), 500); }

module.exports = { createReport, exitLater, safeJson };
