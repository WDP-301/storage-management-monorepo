import { ContractStatus, StorageUnitKind } from '@storage/types';
import { buildPayload, checkInRefusal, parsePayload } from './check-in-eligibility';

const now = new Date('2026-03-01T00:00:00Z');
const active = { status: ContractStatus.ACTIVE, effectiveAt: new Date('2026-02-01T00:00:00Z') };
const shelf = { kind: StorageUnitKind.SHELF };

describe('checkInRefusal', () => {
  it('allows an ACTIVE, started shelf contract', () => {
    expect(checkInRefusal(active, shelf, now)).toBeNull();
  });

  it.each([ContractStatus.DRAFT, ContractStatus.ENDED, ContractStatus.CANCELLED])(
    'refuses a %s contract',
    (status) => {
      expect(checkInRefusal({ ...active, status }, shelf, now)).toEqual({
        reason: 'CONTRACT_NOT_ACTIVE',
      });
    },
  );

  it('refuses until effectiveAt and reports it', () => {
    const effectiveAt = new Date('2026-04-01T00:00:00Z');
    expect(checkInRefusal({ ...active, effectiveAt }, shelf, now)).toEqual({
      reason: 'CONTRACT_NOT_STARTED',
      effectiveAt,
    });
  });

  it('allows an ACTIVE contract past its endedAt', () => {
    const ended = { ...active, endedAt: new Date('2026-02-15T00:00:00Z') };
    expect(checkInRefusal(ended, shelf, now)).toBeNull();
  });

  it('refuses a self-storage unit', () => {
    expect(checkInRefusal(active, { kind: StorageUnitKind.SELF_STORAGE }, now)).toEqual({
      reason: 'NOT_SHELF',
    });
  });
});

describe('parsePayload', () => {
  const token = 'A'.repeat(43);

  it('round-trips a built payload', () => {
    expect(parsePayload(buildPayload(token))).toBe(token);
  });

  it('ignores whitespace a scanner adds around the payload', () => {
    expect(parsePayload(` ${buildPayload(token)}\r\n`)).toBe(token);
  });

  it.each([
    '',
    token,
    `SMCI1:${'A'.repeat(42)}`,
    `SMCI1:${'A'.repeat(44)}`,
    `SMCI2:${token}`,
    `SMCI1:${'!'.repeat(43)}`,
  ])('rejects %p', (payload) => {
    expect(parsePayload(payload)).toBeNull();
  });
});
