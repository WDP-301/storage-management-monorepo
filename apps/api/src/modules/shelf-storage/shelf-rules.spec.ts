import {
  dropOffBlock,
  itemNameKey,
  linesSummary,
  normalizeItemName,
  pickUpBlock,
  pickupRequestBlock,
  receiptCode,
} from './shelf-rules';

describe('item names', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeItemName('  Thùng   sách \t cũ ')).toBe('Thùng sách cũ');
  });

  it('matches case-insensitively, including Vietnamese capitals', () => {
    expect(itemNameKey(' CHĂN  Bông ')).toBe(itemNameKey('chăn bông'));
    expect(itemNameKey('Đèn')).toBe('đèn');
  });
});

describe('receiptCode', () => {
  it('uses the Vietnam day and upper-case hex', () => {
    // 20:00 UTC on the 6th is already the 7th in Vietnam.
    const now = new Date('2026-11-06T20:00:00Z');
    expect(receiptCode('DROP_OFF', now, () => 'abcdef12')).toBe('PG-20261107-ABCDEF12');
    expect(receiptCode('PICK_UP', now, () => '00112233')).toBe('PL-20261107-00112233');
  });

  it('generates 8 random hex digits by default', () => {
    expect(receiptCode('PICK_UP', new Date())).toMatch(/^PL-\d{8}-[0-9A-F]{8}$/);
  });
});

describe('dropOffBlock', () => {
  const effectiveAt = new Date('2026-11-10T09:00:00+07:00');

  it('opens at 00:00 Vietnam time on the start day', () => {
    expect(dropOffBlock({ effectiveAt }, false, new Date('2026-11-09T23:59:00+07:00'))).toBe(
      'CONTRACT_NOT_STARTED',
    );
    expect(dropOffBlock({ effectiveAt }, false, new Date('2026-11-10T00:00:00+07:00'))).toBeNull();
  });

  it('is blocked by an overdue invoice once started', () => {
    expect(dropOffBlock({ effectiveAt }, true, new Date('2026-11-11T00:00:00+07:00'))).toBe(
      'INVOICE_OVERDUE',
    );
  });

  it('reports the unstarted term before the debt', () => {
    expect(dropOffBlock({ effectiveAt }, true, new Date('2026-11-01T00:00:00+07:00'))).toBe(
      'CONTRACT_NOT_STARTED',
    );
  });
});

describe('pickUpBlock', () => {
  it('needs stock first', () => {
    expect(pickUpBlock(0, true, false)).toBe('NO_STOCK');
  });

  it('is blocked by debt unless a return is open', () => {
    expect(pickUpBlock(3, true, false)).toBe('INVOICE_OVERDUE');
    expect(pickUpBlock(3, true, true)).toBeNull();
    expect(pickUpBlock(3, false, false)).toBeNull();
  });
});

describe('pickupRequestBlock', () => {
  const base = {
    status: 'ACTIVE' as const,
    stockTotal: 2,
    hasOpenRequest: false,
    overdue: false,
    returnOpen: false,
  };

  it('allows an active contract with stock and no debt', () => {
    expect(pickupRequestBlock(base)).toBeNull();
  });

  it('applies the refusals in order', () => {
    expect(pickupRequestBlock({ ...base, status: 'ENDED', hasOpenRequest: true })).toBe(
      'CONTRACT_NOT_ACTIVE',
    );
    expect(pickupRequestBlock({ ...base, hasOpenRequest: true, stockTotal: 0 })).toBe(
      'OPEN_REQUEST_EXISTS',
    );
    expect(pickupRequestBlock({ ...base, stockTotal: 0, overdue: true })).toBe('NO_STOCK');
    expect(pickupRequestBlock({ ...base, overdue: true })).toBe('INVOICE_OVERDUE');
  });

  it('ignores debt while a return is open', () => {
    expect(pickupRequestBlock({ ...base, overdue: true, returnOpen: true })).toBeNull();
  });
});

describe('linesSummary', () => {
  const lines = [
    { name: 'Sách', quantity: 2 },
    { name: 'Chăn', quantity: 1 },
    { name: 'Đèn', quantity: 4 },
    { name: 'Ghế', quantity: 1 },
    { name: 'Bàn', quantity: 1 },
  ];

  it('lists up to three lines and counts the rest', () => {
    expect(linesSummary(lines)).toBe('Sách ×2, Chăn ×1, Đèn ×4 và 2 món khác');
  });

  it('lists everything when it fits', () => {
    expect(linesSummary(lines.slice(0, 2))).toBe('Sách ×2, Chăn ×1');
    expect(linesSummary(lines, 5)).toContain('Bàn ×1');
    expect(linesSummary([])).toBe('');
  });
});
