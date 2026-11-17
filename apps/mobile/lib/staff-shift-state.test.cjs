const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(filename) {
  const mod = new Module(filename);
  mod.require = (name) => {
    if (!name.startsWith('.')) throw new Error(`Unexpected import: ${name}`);
    const resolved = path.resolve(path.dirname(filename), `${name}.ts`);
    if (name === './api') {
      class ApiError extends Error {
        constructor(message, statusCode, code) {
          super(message);
          this.statusCode = statusCode;
          this.code = code;
        }
      }
      return { ApiError };
    }
    return load(resolved);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports;
}

const {
  vietnamTodayIso,
  addDaysIso,
  shiftWeekRange,
  formatVietnamTime,
  canCheckInShift,
  canCheckOutShift,
  shiftAttendanceHint,
  pickTodayActiveShift,
  shiftStatusDisplay,
} = load(path.join(__dirname, 'staff-shift-state.ts'));

const shift = (over = {}) => ({
  id: 'sh-1',
  staff_id: 'staff-1',
  staff_name: 'Trần Văn B',
  facility_id: 'fac-1',
  shift_template_id: 'tpl-1',
  shift_template_code: 'SANG',
  shift_template_name: 'Ca sáng',
  work_date: '2026-11-16',
  start_at: '2026-11-16T01:00:00.000Z', // 08:00 +07:00
  end_at: '2026-11-16T05:00:00.000Z', // 12:00 +07:00
  status: 'SCHEDULED',
  check_in_at: null,
  check_out_at: null,
  note: null,
  assigned_by: 'mgr-1',
  created_at: '2026-11-10T00:00:00.000Z',
  updated_at: '2026-11-10T00:00:00.000Z',
  ...over,
});

test('vietnamTodayIso and shiftWeekRange compute Monday-Sunday range in +07:00', () => {
  // 2026-11-16 18:00Z = 2026-11-17 01:00 +07:00 (Tuesday)
  const lateUtc = Date.parse('2026-11-16T18:00:00.000Z');
  assert.equal(vietnamTodayIso(lateUtc), '2026-11-17');
  assert.deepEqual(shiftWeekRange(0, lateUtc), { from: '2026-11-16', to: '2026-11-22' });
  assert.deepEqual(shiftWeekRange(1, lateUtc), { from: '2026-11-23', to: '2026-11-29' });
  assert.equal(addDaysIso('2026-11-30', 2), '2026-12-02');
});

test('canCheckInShift enforces 30-minute lead window and shift end cutoff', () => {
  const s = shift();
  assert.equal(canCheckInShift(s, Date.parse('2026-11-16T00:29:59.000Z')), false);
  assert.equal(canCheckInShift(s, Date.parse('2026-11-16T00:30:00.000Z')), true);
  assert.equal(canCheckInShift(s, Date.parse('2026-11-16T04:59:59.000Z')), true);
  assert.equal(canCheckInShift(s, Date.parse('2026-11-16T05:00:00.000Z')), false);
  assert.equal(
    canCheckInShift(shift({ status: 'CHECKED_IN' }), Date.parse('2026-11-16T01:00:00.000Z')),
    false,
  );
});

test('canCheckOutShift allows only CHECKED_IN shifts and attendance hints match timing', () => {
  const s = shift();
  assert.equal(
    shiftAttendanceHint(s, Date.parse('2026-11-16T00:00:00.000Z')).text,
    'Mở check-in từ 07:30',
  );
  assert.equal(shiftAttendanceHint(s, Date.parse('2026-11-16T00:45:00.000Z')).kind, 'check-in');
  assert.equal(shiftAttendanceHint(s, Date.parse('2026-11-16T05:00:00.000Z')).kind, 'missed');

  const active = shift({ status: 'CHECKED_IN' });
  assert.equal(canCheckOutShift(active), true);
  assert.equal(
    shiftAttendanceHint(active, Date.parse('2026-11-16T02:00:00.000Z')).kind,
    'check-out',
  );
});

test('pickTodayActiveShift prioritises CHECKED_IN over check-in-ready over upcoming', () => {
  const now = Date.parse('2026-11-16T01:00:00.000Z'); // 08:00 VN
  const morning = shift({ id: 'm', status: 'SCHEDULED' });
  const afternoon = shift({
    id: 'a',
    start_at: '2026-11-16T06:00:00.000Z',
    end_at: '2026-11-16T10:00:00.000Z',
  });
  assert.equal(pickTodayActiveShift([afternoon, morning], now).id, 'm');
  assert.equal(
    pickTodayActiveShift([shift({ id: 'm', status: 'COMPLETED' }), afternoon], now).id,
    'a',
  );
  assert.equal(
    pickTodayActiveShift([morning, shift({ id: 'c', status: 'CHECKED_IN' })], now).id,
    'c',
  );
});

test('formatVietnamTime and shiftStatusDisplay format Vietnam clock and labels', () => {
  assert.equal(formatVietnamTime('2026-11-16T01:30:00.000Z'), '08:30');
  assert.equal(shiftStatusDisplay('COMPLETED').tone, 'success');
  assert.equal(shiftStatusDisplay('ABSENT').tone, 'danger');
});
