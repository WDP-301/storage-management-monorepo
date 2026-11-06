const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTourAppointmentsApi(requestImpl) {
  const filename = path.join(__dirname, 'tour-appointments-api.ts');
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

test('TourAppointmentsApi.create posts to /tour-appointments with payload', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { TourAppointmentsApi } = loadTourAppointmentsApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { id: 'apt-1', status: 'PENDING' };
  });

  const dto = {
    facilityId: 'fac-1',
    storageUnitId: 'unit-1',
    fullName: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'nva@example.com',
    preferredDate: '2026-11-20',
    preferredTimeSlot: '09:00 - 10:00',
    customerNotes: 'Xem kho mini',
  };

  const res = await TourAppointmentsApi.create(dto);
  assert.equal(capturedPath, '/tour-appointments');
  assert.equal(capturedInit.method, 'POST');
  assert.deepEqual(JSON.parse(capturedInit.body), dto);
  assert.equal(res.id, 'apt-1');
});

test('TourAppointmentsApi.list builds correct query string with filters', async () => {
  let capturedPath = '';

  const { TourAppointmentsApi } = loadTourAppointmentsApi(async (p) => {
    capturedPath = p;
    return { appointments: [], meta: { total: 0, page: 1, limit: 10 } };
  });

  await TourAppointmentsApi.list({
    status: 'CONFIRMED',
    facilityId: 'fac-1',
    fromDate: '2026-11-01',
    toDate: '2026-11-30',
    page: 2,
    limit: 20,
  });

  assert.equal(
    capturedPath,
    '/tour-appointments?status=CONFIRMED&facilityId=fac-1&fromDate=2026-11-01&toDate=2026-11-30&page=2&limit=20',
  );
});

test('TourAppointmentsApi.cancel patches /tour-appointments/:id/cancel', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { TourAppointmentsApi } = loadTourAppointmentsApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { id: 'apt-1', status: 'CANCELLED' };
  });

  const res = await TourAppointmentsApi.cancel('apt-1', 'Bận việc đột xuất');
  assert.equal(capturedPath, '/tour-appointments/apt-1/cancel');
  assert.equal(capturedInit.method, 'PATCH');
  assert.deepEqual(JSON.parse(capturedInit.body), { cancellationReason: 'Bận việc đột xuất' });
  assert.equal(res.status, 'CANCELLED');
});

test('TourAppointmentsApi.complete patches /tour-appointments/:id/complete', async () => {
  let capturedPath = '';
  let capturedInit = null;

  const { TourAppointmentsApi } = loadTourAppointmentsApi(async (p, init) => {
    capturedPath = p;
    capturedInit = init;
    return { id: 'apt-1', status: 'COMPLETED' };
  });

  const res = await TourAppointmentsApi.complete('apt-1', 'Khách hài lòng về kho');
  assert.equal(capturedPath, '/tour-appointments/apt-1/complete');
  assert.equal(capturedInit.method, 'PATCH');
  assert.deepEqual(JSON.parse(capturedInit.body), { staffResultNotes: 'Khách hài lòng về kho' });
  assert.equal(res.status, 'COMPLETED');
});
