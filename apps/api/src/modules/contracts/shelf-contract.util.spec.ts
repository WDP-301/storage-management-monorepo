import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Invoice } from '@entities/invoice.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { Logger } from '@nestjs/common';
import {
  ContractStatus,
  InvoiceStatus,
  NotificationType,
  StorageUnitKind,
  StorageUnitStatus,
} from '@storage/types';
import type { EntityManager } from 'typeorm';
import { findFirstRentInvoice } from './first-rent.util';
import { issueFirstRentInvoice } from './first-rent-issue.util';
import { persistContract } from './initial-contract.util';
import {
  activateShelfContract,
  activateShelfContractSafely,
  persistBookedContract,
} from './shelf-contract.util';
import { lockUnitClaimedOnlyBy } from './unit-claim.util';

jest.mock('./first-rent.util', () => ({ findFirstRentInvoice: jest.fn() }));
jest.mock('./first-rent-issue.util', () => ({ issueFirstRentInvoice: jest.fn() }));
jest.mock('./initial-contract.util', () => ({ persistContract: jest.fn() }));
jest.mock('./unit-claim.util', () => ({ lockUnitClaimedOnlyBy: jest.fn() }));

const NOW = new Date('2026-11-20T03:00:00Z');
const notifications = { createForUsers: jest.fn() };

function setup(over: {
  contract?: Partial<Contract>;
  kind?: StorageUnitKind;
  hasHandover?: boolean;
  firstRent?: InvoiceStatus | null;
  unitMoved?: number;
}) {
  const contract = {
    id: 'c-1',
    contractNo: 'CT-1',
    customerId: 'cus-1',
    bookingItemId: 'item-1',
    status: ContractStatus.DRAFT,
    documents: [{ fileKey: 'k', name: 'hd.pdf', mimeType: 'application/pdf' }],
    effectiveAt: new Date('2026-11-18T02:00:00Z'),
    ...over.contract,
  };
  const unit = { id: 'shelf-1', code: 'K-01', status: StorageUnitStatus.BOOKED };
  const item = {
    id: 'item-1',
    storageUnitId: 'shelf-1',
    storageUnit: { ...unit, kind: over.kind ?? StorageUnitKind.SHELF },
  };
  const em = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === Contract) return contract;
      if (entity === BookingItem) return item;
      return null;
    }),
    exists: jest.fn(async () => over.hasHandover ?? false),
    update: jest.fn(async (entity: unknown) => ({
      affected: entity === StorageUnit ? (over.unitMoved ?? 1) : 1,
    })),
    transaction: jest.fn((callback: (em: unknown) => unknown) => callback(em)),
  };
  (findFirstRentInvoice as jest.Mock).mockResolvedValue(
    over.firstRent === null
      ? null
      : { id: 'inv-1', months: 1, status: over.firstRent ?? InvoiceStatus.PAID },
  );
  (lockUnitClaimedOnlyBy as jest.Mock).mockResolvedValue(unit);
  return { em: em as unknown as EntityManager & typeof em, contract };
}

const updatesOf = (em: { update: jest.Mock }, entity: unknown) =>
  em.update.mock.calls.filter(([target]) => target === entity).map(([, , values]) => values);

beforeEach(() => jest.clearAllMocks());

describe('activateShelfContract', () => {
  it('activates a shelf with signed files and a paid first month, from now when start passed', async () => {
    const { em } = setup({});
    await expect(activateShelfContract(em, 'c-1', notifications as never, NOW)).resolves.toBe(
      'activated',
    );
    expect(updatesOf(em, StorageUnit)).toEqual([{ status: StorageUnitStatus.RENTED }]);
    expect(updatesOf(em, Contract)).toEqual([
      { status: ContractStatus.ACTIVE, signedAt: NOW, effectiveAt: NOW },
    ]);
    const [invoiceDates] = updatesOf(em, Invoice);
    expect(invoiceDates.startAt).toEqual(NOW);
    expect(invoiceDates.endAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['cus-1'],
      expect.objectContaining({ type: NotificationType.CONTRACT_ACTIVATED }),
    );
  });

  it('never starts the term before the booked start', async () => {
    const booked = new Date('2026-11-25T02:00:00Z');
    const { em } = setup({ contract: { effectiveAt: booked } });
    await activateShelfContract(em, 'c-1', notifications as never, NOW);
    expect(updatesOf(em, Contract)).toEqual([
      { status: ContractStatus.ACTIVE, signedAt: NOW, effectiveAt: booked },
    ]);
    expect(updatesOf(em, Invoice)[0].startAt).toEqual(booked);
  });

  it.each([
    ['no signed files', { contract: { documents: [] } }],
    ['the first month unpaid', { firstRent: InvoiceStatus.ISSUED }],
    ['no first-month invoice', { firstRent: null }],
  ])('waits while there are %s', async (_label, over) => {
    const { em } = setup(over as never);
    await expect(activateShelfContract(em, 'c-1', notifications as never, NOW)).resolves.toBe(
      'not-ready',
    );
    expect(em.update).not.toHaveBeenCalled();
  });

  it.each([
    ['a self-storage unit', { kind: StorageUnitKind.SELF_STORAGE }],
    ['a shelf that still has a handover', { hasHandover: true }],
    ['a contract already ACTIVE', { contract: { status: ContractStatus.ACTIVE } }],
  ])('leaves %s alone', async (_label, over) => {
    const { em } = setup(over as never);
    await expect(activateShelfContract(em, 'c-1', notifications as never, NOW)).resolves.toBe(
      'not-applicable',
    );
    expect(em.update).not.toHaveBeenCalled();
  });

  it('refuses when the shelf is not BOOKED or HELD', async () => {
    const { em } = setup({ unitMoved: 0 });
    await expect(activateShelfContract(em, 'c-1', notifications as never, NOW)).rejects.toThrow(
      'not in the expected state',
    );
  });
});

describe('activateShelfContractSafely', () => {
  it('logs instead of throwing so the triggering write stands', async () => {
    const { em } = setup({ unitMoved: 0 });
    const logger = { log: jest.fn(), error: jest.fn() } as unknown as Logger;
    await expect(
      activateShelfContractSafely(em, 'c-1', notifications as never, logger),
    ).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('persistBookedContract', () => {
  const input = { item: { storageUnitId: 'shelf-1' } } as never;

  it('gives a shelf no handover and bills its first month', async () => {
    const em = {
      findOne: jest.fn(async () => ({ kind: StorageUnitKind.SHELF })),
    } as unknown as EntityManager;
    const contract = { id: 'c-1', status: ContractStatus.DRAFT };
    (persistContract as jest.Mock).mockResolvedValue(contract);
    await persistBookedContract(em, input, notifications as never);
    expect(persistContract).toHaveBeenCalledWith(em, expect.objectContaining({ handover: false }));
    expect(issueFirstRentInvoice).toHaveBeenCalledWith(em, contract, notifications);
  });

  it('keeps the handover of a self-storage unit and bills nothing yet', async () => {
    const em = {
      findOne: jest.fn(async () => ({ kind: StorageUnitKind.SELF_STORAGE })),
    } as unknown as EntityManager;
    (persistContract as jest.Mock).mockResolvedValue({ id: 'c-1', status: ContractStatus.DRAFT });
    await persistBookedContract(em, input, notifications as never);
    expect(persistContract).toHaveBeenCalledWith(em, expect.objectContaining({ handover: true }));
    expect(issueFirstRentInvoice).not.toHaveBeenCalled();
  });
});
