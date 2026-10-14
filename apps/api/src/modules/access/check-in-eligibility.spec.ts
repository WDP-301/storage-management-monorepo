import { ContractStatus, StorageUnitKind } from '@storage/types';
import {
  buildPayload,
  checkInRefusal,
  parsePayload,
  startOfVietnamDay,
} from './check-in-eligibility';

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

  describe('on the start date', () => {
    // Starts 15:00 on 15/10 Vietnam time; that day opens at 2026-10-14T17:00:00Z.
    const effectiveAt = new Date('2026-10-15T15:00:00+07:00');
    const started = { ...active, effectiveAt };

    it('allows entry from 00:00 Vietnam time, before the contract hour', () => {
      expect(checkInRefusal(started, shelf, new Date('2026-10-15T00:00:00+07:00'))).toBeNull();
    });

    it('refuses the last second of the previous Vietnam day', () => {
      expect(checkInRefusal(started, shelf, new Date('2026-10-14T23:59:59+07:00'))).toEqual({
        reason: 'CONTRACT_NOT_STARTED',
        effectiveAt,
      });
    });

    it('uses the Vietnam day even when the UTC date differs', () => {
      // 06:00 on 15/10 Vietnam time is still 14/10 in UTC.
      const early = { ...active, effectiveAt: new Date('2026-10-15T06:00:00+07:00') };
      expect(checkInRefusal(early, shelf, new Date('2026-10-15T00:00:01+07:00'))).toBeNull();
      expect(checkInRefusal(early, shelf, new Date('2026-10-14T23:59:59+07:00'))).not.toBeNull();
    });
  });

  it.each([
    ['2026-10-15T00:00:00+07:00', '2026-10-14T17:00:00.000Z'],
    ['2026-10-15T23:59:59+07:00', '2026-10-14T17:00:00.000Z'],
    ['2026-10-14T17:00:00Z', '2026-10-14T17:00:00.000Z'],
    ['2026-10-14T16:59:59Z', '2026-10-13T17:00:00.000Z'],
  ])('startOfVietnamDay(%s) is %s', (at, expected) => {
    expect(startOfVietnamDay(new Date(at)).toISOString()).toBe(expected);
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
