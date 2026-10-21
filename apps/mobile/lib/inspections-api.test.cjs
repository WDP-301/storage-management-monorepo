const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

class ApiError extends Error {
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Compiles a .ts module and its relative imports for real; only `lib/api` is replaced.
function load(file, requestImpl = async () => null) {
  const filename = path.resolve(__dirname, file);
  const mod = new Module(filename);
  mod.require = (name) => {
    const target = path.resolve(path.dirname(filename), name);
    if (target === path.join(__dirname, 'api')) return { request: requestImpl, ApiError };
    if (name.startsWith('.')) return load(`${target}.ts`, requestImpl);
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

const staffDir = '../src/features/staff';

const row = {
  id: 'i1',
  type: 'RETURN',
  inspectedBy: 'u1',
  requestNote: null,
  conditionNotes: null,
  evidence: null,
  damages: [{ description: 'Móp cửa', severity: 'MAJOR', proposedFee: 750000 }],
  scheduledAt: '2026-11-05T12:00:00.000Z',
  inspectedAt: null,
  finalizedAt: null,
  returnedOn: null,
  requestSource: 'HOTLINE',
  createdAt: '2026-10-20T03:00:00.000Z',
};

test('normaliseInspection keeps proposed fees, return day and request source', () => {
  const { normaliseInspection } = load('inspections-api.ts');
  const inspection = normaliseInspection({ ...row, returnedOn: '2026-11-04' });
  assert.equal(inspection.damages[0].proposedFee, 750000);
  assert.equal(inspection.returnedOn, '2026-11-04');
  assert.equal(inspection.requestSource, 'HOTLINE');
});

test('normaliseInspection defaults the new fields for rows without them', () => {
  const { normaliseInspection } = load('inspections-api.ts');
  const { returnedOn, requestSource, ...legacy } = row;
  const inspection = normaliseInspection({
    ...legacy,
    damages: [{ description: 'Cũ', severity: 'MINOR' }],
  });
  assert.equal(inspection.returnedOn, null);
  assert.equal(inspection.requestSource, null);
  assert.equal(inspection.damages[0].proposedFee, null);
});

test('reschedule patches scheduledAt at noon UTC and returns the normalised inspection', async () => {
  const calls = [];
  const { InspectionsApi } = load('inspections-api.ts', async (url, init) => {
    calls.push([url, init]);
    return { ...row, scheduledAt: '2026-11-08T12:00:00.000Z' };
  });
  const moved = await InspectionsApi.reschedule('i1', '2026-11-08');
  assert.equal(calls[0][0], '/inspections/i1');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0][1].body), { scheduledAt: '2026-11-08T12:00:00.000Z' });
  assert.equal(moved.scheduledAt, '2026-11-08T12:00:00.000Z');
});

test('update sends damages together with their proposed fees', async () => {
  const calls = [];
  const { InspectionsApi } = load('inspections-api.ts', async (url, init) => {
    calls.push([url, init]);
    return row;
  });
  const damages = [{ description: 'Móp cửa', severity: 'MAJOR', evidence: [], proposedFee: null }];
  await InspectionsApi.update('i1', { damages });
  assert.deepEqual(JSON.parse(calls[0][1].body), { damages });
});

test('finalize sends the actual return day only when one is given', async () => {
  const calls = [];
  const { InspectionsApi } = load('inspections-api.ts', async (url, init) => {
    calls.push([url, init]);
    return row;
  });
  await InspectionsApi.finalize('i1');
  await InspectionsApi.finalize('i1', '2026-11-04');
  assert.equal(calls[0][0], '/inspections/i1/finalize');
  assert.equal(calls[0][1].body, undefined);
  assert.deepEqual(JSON.parse(calls[1][1].body), { returnedOn: '2026-11-04' });
});

test('finalizeConsequence sends only a major damage to maintenance', () => {
  const { finalizeConsequence } = load(`${staffDir}/inspection-display.ts`);
  const returnRow = { type: 'RETURN' };
  const minor = { severity: 'MINOR', proposedFee: null };
  const major = { severity: 'MAJOR', proposedFee: null };
  assert.match(finalizeConsequence(returnRow, []), /chuyển sang Trống/);
  assert.match(finalizeConsequence(returnRow, [minor]), /chuyển sang Trống/);
  assert.match(finalizeConsequence(returnRow, [minor, major]), /Bảo trì \(có hư hỏng nặng\)/);
  assert.match(finalizeConsequence({ type: 'PRE_HANDOVER' }, [major]), /Đang thuê/);
});

test('finalizeConsequence adds the proposed fee total for returns only when there is one', () => {
  const { finalizeConsequence } = load(`${staffDir}/inspection-display.ts`);
  const damages = [
    { severity: 'MINOR', proposedFee: 300000 },
    { severity: 'MINOR', proposedFee: 200000 },
    { severity: 'MINOR', proposedFee: null },
  ];
  const text = finalizeConsequence({ type: 'RETURN' }, damages);
  assert.match(text, /Tổng phí đề xuất: 500\.000/);
  assert.match(text, /quản lý vận hành duyệt khi quyết toán cọc/);
  assert.doesNotMatch(finalizeConsequence({ type: 'RETURN' }, [damages[2]]), /Tổng phí/);
});

test('parseProposedFee keeps digits, clears on empty and ignores amounts over the limit', () => {
  const { parseProposedFee } = load(`${staffDir}/inspection-display.ts`);
  assert.equal(parseProposedFee('1.250.000', null), 1250000);
  assert.equal(parseProposedFee('12abc3', null), 123);
  assert.equal(parseProposedFee('', 500), null);
  assert.equal(parseProposedFee('1000000000', null), 1000000000);
  assert.equal(parseProposedFee('1000000001', 999), 999);
});

test('requestSourceLabel names branch-made requests only', () => {
  const { requestSourceLabel } = load(`${staffDir}/inspection-display.ts`);
  assert.match(requestSourceLabel({ requestSource: 'HOTLINE' }), /hotline/);
  assert.match(requestSourceLabel({ requestSource: 'ABANDONED' }), /bỏ kho/);
  assert.equal(requestSourceLabel({ requestSource: 'CUSTOMER' }), null);
  assert.equal(requestSourceLabel({ requestSource: null }), null);
});

test('vietnamDayIso rolls over at 17:00 UTC', () => {
  const { vietnamDayIso } = load(`${staffDir}/return-dates.ts`);
  assert.equal(vietnamDayIso(new Date('2026-10-20T16:59:00.000Z')), '2026-10-20');
  assert.equal(vietnamDayIso(new Date('2026-10-20T17:00:00.000Z')), '2026-10-21');
});

test('returnedOnOptions runs from today back to the request day, newest first', () => {
  const { returnedOnOptions } = load(`${staffDir}/return-dates.ts`);
  const options = returnedOnOptions('2026-10-18T09:00:00.000Z', '2026-10-21');
  assert.deepEqual(
    options.map((option) => option.iso),
    ['2026-10-21', '2026-10-20', '2026-10-19', '2026-10-18'],
  );
  assert.equal(options[0].isToday, true);
  assert.equal(options[0].weekday, 'T4');
  assert.deepEqual(
    returnedOnOptions('2026-10-21T01:00:00.000Z', '2026-10-21').map((option) => option.iso),
    ['2026-10-21'],
  );
});

test('rescheduleOptions starts today and covers the requested number of days', () => {
  const { rescheduleOptions } = load(`${staffDir}/return-dates.ts`);
  const options = rescheduleOptions('2026-10-30', 4);
  assert.deepEqual(
    options.map((option) => option.iso),
    ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'],
  );
});

test('returnedOnWarning flags a day other than the appointment', () => {
  const { returnedOnWarning, isMovedEarlier } = load(`${staffDir}/return-dates.ts`);
  const inspection = { scheduledAt: '2026-11-05T12:00:00.000Z' };
  assert.equal(returnedOnWarning(inspection, '2026-11-05'), null);
  assert.match(returnedOnWarning(inspection, '2026-11-07'), /khác ngày hẹn 05\/11/);
  assert.equal(returnedOnWarning({ scheduledAt: null }, '2026-11-07'), null);
  assert.equal(isMovedEarlier(inspection, '2026-11-03'), true);
  assert.equal(isMovedEarlier(inspection, '2026-11-09'), false);
  assert.equal(isMovedEarlier({ scheduledAt: null }, '2026-11-09'), false);
});

test('staffErrorMessage explains forbidden and invalid-date failures in Vietnamese', () => {
  const { staffErrorMessage } = load(`${staffDir}/staff-errors.ts`);
  const dateError = new ApiError('Validation failed', 400, 'VALIDATION_FAILED', {
    fields: [{ field: 'returnedOn', code: 'outOfRange', message: 'x' }],
  });
  const noteError = new ApiError('Validation failed', 400, 'VALIDATION_FAILED', {
    fields: [{ field: 'conditionNotes', code: 'maxLength', message: 'x' }],
  });
  const forbidden = new ApiError('Forbidden', 403, 'FORBIDDEN');
  assert.equal(staffErrorMessage(dateError, 'lỗi'), 'Ngày không hợp lệ.');
  assert.match(staffErrorMessage(noteError, 'lỗi'), /Thông tin chưa hợp lệ/);
  assert.equal(staffErrorMessage(forbidden, 'lỗi'), 'Bạn không có quyền với biên bản này.');
  assert.equal(
    staffErrorMessage(forbidden, 'lỗi', 'Bạn không có quyền đổi lịch biên bản này.'),
    'Bạn không có quyền đổi lịch biên bản này.',
  );
  assert.match(
    staffErrorMessage(new ApiError('Inspection is already finalized', 409, 'CONFLICT'), 'lỗi'),
    /đã được chốt/,
  );
  assert.equal(staffErrorMessage(new Error('boom'), 'lỗi'), 'lỗi');
});
