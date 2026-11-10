jest.mock('@nestjs/event-emitter', () => ({ OnEvent: () => () => undefined }));
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));
jest.mock('@shared/utils/idempotency-key.util', () => ({
  claimIdempotencyKey: jest.fn().mockResolvedValue(null),
  releaseIdempotencyKey: jest.fn().mockResolvedValue(undefined),
}));

import { BookingStatus, SepayTransferOutcome } from '@storage/types';
import type { AuthUser } from '../auth/types/auth-user';
import { SepayTransfersService } from './sepay-transfers.service';

const OPS = { id: 'ops-1' } as AuthUser;

const buildTransfer = (outcome: SepayTransferOutcome = SepayTransferOutcome.UNMATCHED) => ({
  id: 't-1',
  sepayId: '777',
  amount: '1500000.00',
  content: 'CK tu MB',
  referenceCode: 'FT12345',
  gateway: 'MB',
  transactionDate: new Date('2026-11-10T10:00:00Z'),
  outcome,
  bookingId: null,
  invoiceId: null,
  resolvedBy: null,
  resolvedAt: null,
  resolutionNote: null,
  createdAt: new Date(),
});

describe('SepayTransfersService', () => {
  let transferRepo: { findOne: jest.Mock; findAndCount: jest.Mock; exists: jest.Mock };
  let bookingRepo: { findOne: jest.Mock };
  let query: jest.Mock;
  let applyDepositTransfer: jest.Mock;
  let service: SepayTransfersService;

  beforeEach(() => {
    transferRepo = {
      findOne: jest.fn().mockResolvedValue(buildTransfer()),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      exists: jest.fn().mockResolvedValue(true),
    };
    bookingRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'b-1',
        bookingNo: 'BK-1',
        status: BookingStatus.PENDING_DEPOSIT,
      }),
    };
    query = jest.fn().mockResolvedValue([{ id: 't-1' }]);
    applyDepositTransfer = jest
      .fn()
      .mockResolvedValue({ outcome: 'confirmed', contractNos: [], reviewReason: '' });
    const dataSource = {
      query,
      getRepository: jest.fn((entity: { name: string }) =>
        entity.name === 'Booking' ? bookingRepo : transferRepo,
      ),
    };
    service = new SepayTransfersService(dataSource as never, { applyDepositTransfer } as never);
  });

  it('list defaults to the attention queue', async () => {
    await service.list({} as never);
    const where = transferRepo.findAndCount.mock.calls[0][0].where;
    expect(where.outcome).toBeDefined();
  });

  it('assign replays the deposit path and resolves on confirm', async () => {
    const res = await service.assign('t-1', { bookingId: 'b-1' } as never, OPS);
    expect(applyDepositTransfer).toHaveBeenCalled();
    expect(res.outcome).toBe('confirmed');
    // The queued row is stamped RESOLVED with the actor and the booking link.
    const [sql, params] = query.mock.calls.at(-1) ?? [];
    expect(sql).toContain('SET "outcome" = $2');
    expect(params).toContain('RESOLVED');
    expect(params).toContain('b-1');
    expect(params).toContain('ops-1');
  });

  it('assign keeps the transfer queued when the booking cannot take it', async () => {
    applyDepositTransfer.mockResolvedValue({
      outcome: 'late',
      contractNos: [],
      reviewReason: '',
    });
    const res = await service.assign('t-1', { bookingId: 'b-1' } as never, OPS);
    expect(res.outcome).toBe('late');
    const [, params] = query.mock.calls.at(-1) ?? [];
    expect(params).toContain('NEEDS_REVIEW');
  });

  it('assign refuses a booking that is not awaiting a deposit', async () => {
    bookingRepo.findOne.mockResolvedValue({
      id: 'b-1',
      bookingNo: 'BK-1',
      status: BookingStatus.CONFIRMED,
    });
    await expect(service.assign('t-1', { bookingId: 'b-1' } as never, OPS)).rejects.toMatchObject({
      status: 409,
    });
    expect(applyDepositTransfer).not.toHaveBeenCalled();
  });

  it('assign resolves the booking from its number when no id is given', async () => {
    const res = await service.assign('t-1', { bookingNo: 'BK-1' } as never, OPS);
    expect(bookingRepo.findOne).toHaveBeenCalledWith({ where: { bookingNo: 'BK-1' } });
    expect(res.outcome).toBe('confirmed');
  });

  it('assign rejects a call naming neither booking', async () => {
    await expect(service.assign('t-1', {} as never, OPS)).rejects.toMatchObject({
      status: 400,
    });
    expect(applyDepositTransfer).not.toHaveBeenCalled();
  });

  it('assign refuses a transfer a person already resolved', async () => {
    transferRepo.findOne.mockResolvedValue(buildTransfer(SepayTransferOutcome.RESOLVED));
    await expect(service.assign('t-1', { bookingId: 'b-1' } as never, OPS)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('resolve stamps actor + note; a second resolve conflicts', async () => {
    const res = await service.resolve('t-1', 'khách chuyển nhầm, đã hoàn tay', OPS);
    expect(res.outcome).toBe('RESOLVED');
    const [sql, params] = query.mock.calls.at(-1) ?? [];
    expect(sql).toContain("'RESOLVED'");
    expect(params).toEqual(['t-1', 'ops-1', 'khách chuyển nhầm, đã hoàn tay']);

    query.mockResolvedValue([]);
    await expect(service.resolve('t-1', 'again', OPS)).rejects.toMatchObject({ status: 409 });
  });
});
