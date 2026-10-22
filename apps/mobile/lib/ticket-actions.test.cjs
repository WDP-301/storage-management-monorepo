const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(filename) {
  const mod = new Module(filename);
  mod.require = (name) => {
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

const { ticketActions } = load(path.join(__dirname, '../src/features/staff/ticket-actions.ts'));

const staff = { userId: 'staff-1', isManager: false };
const manager = { userId: 'manager-1', isManager: true };

test('the assigned staff member starts an assigned ticket or closes it', () => {
  assert.deepEqual(ticketActions({ status: 'ASSIGNED', assigned_to: 'staff-1' }, staff), {
    canStart: true,
    canResolve: false,
    canClose: true,
    hint: null,
  });
});

test('an in-progress ticket can be resolved or closed', () => {
  const actions = ticketActions({ status: 'IN_PROGRESS', assigned_to: 'staff-1' }, staff);
  assert.equal(actions.canStart, false);
  assert.equal(actions.canResolve, true);
  assert.equal(actions.canClose, true);
});

test('staff get no actions on a ticket assigned to someone else', () => {
  const actions = ticketActions({ status: 'IN_PROGRESS', assigned_to: 'staff-2' }, staff);
  assert.deepEqual(actions, { canStart: false, canResolve: false, canClose: false, hint: null });
});

test('a manager may work any listed ticket', () => {
  const actions = ticketActions({ status: 'ASSIGNED', assigned_to: 'staff-2' }, manager);
  assert.equal(actions.canStart, true);
});

test('an unassigned ticket points the manager to the web, and offers staff nothing', () => {
  assert.match(ticketActions({ status: 'OPEN', assigned_to: null }, manager).hint, /web/);
  assert.equal(ticketActions({ status: 'OPEN', assigned_to: null }, staff).hint, null);
});

test('finished tickets are read-only', () => {
  for (const status of ['RESOLVED', 'CLOSED', 'CANCELLED']) {
    const actions = ticketActions({ status, assigned_to: 'staff-1' }, staff);
    assert.deepEqual(actions, { canStart: false, canResolve: false, canClose: false, hint: null });
  }
});

test('a signed-out viewer never matches an unassigned ticket', () => {
  const actions = ticketActions(
    { status: 'ASSIGNED', assigned_to: null },
    {
      userId: undefined,
      isManager: false,
    },
  );
  assert.equal(actions.canStart, false);
});
