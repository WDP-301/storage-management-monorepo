const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadStaffShiftsApi(requestImpl) {
  const filename = path.join(__dirname, 'staff-shifts-api.ts');
  const mod = new Module(filename);
  mod.require = (name) => {
    if (name === './api') return { request: requestImpl };
    throw new Error(`Unexpected import: ${name}`);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports;
}

test('StaffShiftsApi.listMine queries /me/staff-shifts with from & to dates', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { StaffShiftsApi } = loadStaffShiftsApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { staff_shifts: [{ id: 'sh-1', status: 'SCHEDULED' }] };
  });

  const rows = await StaffShiftsApi.listMine('2026-11-16', '2026-11-22');
  assert.equal(capturedPath, '/me/staff-shifts?from=2026-11-16&to=2026-11-22');
  assert.equal(capturedInit.method, 'GET');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'sh-1');
});

test('StaffShiftsApi.checkIn patches /me/staff-shifts/:id/check-in and unwraps staff_shift', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { StaffShiftsApi } = loadStaffShiftsApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { staff_shift: { id: 'sh-1', status: 'CHECKED_IN' } };
  });

  const shift = await StaffShiftsApi.checkIn('sh-1');
  assert.equal(capturedPath, '/me/staff-shifts/sh-1/check-in');
  assert.equal(capturedInit.method, 'PATCH');
  assert.equal(shift.status, 'CHECKED_IN');
});

test('StaffShiftsApi.checkOut patches /me/staff-shifts/:id/check-out and unwraps staff_shift', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { StaffShiftsApi } = loadStaffShiftsApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { staff_shift: { id: 'sh-1', status: 'COMPLETED' } };
  });

  const shift = await StaffShiftsApi.checkOut('sh-1');
  assert.equal(capturedPath, '/me/staff-shifts/sh-1/check-out');
  assert.equal(capturedInit.method, 'PATCH');
  assert.equal(shift.status, 'COMPLETED');
});
