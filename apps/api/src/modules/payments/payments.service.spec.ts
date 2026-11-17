jest.mock('@nestjs/event-emitter', () => ({ EventEmitter2: class {} }));

import { PaymentsService } from './payments.service';

describe('PaymentsService.handleSepayWebhook', () => {
  it('parses bare Vietnam transactionDate strings as +07:00 before persisting', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const emitAsync = jest.fn().mockResolvedValue([]);
    const service = new PaymentsService({ emitAsync } as never, { query } as never);

    await service.handleSepayWebhook({
      id: 99,
      gateway: 'MBBank',
      transactionDate: '2026-10-12 10:32:00',
      accountNumber: '0123456789',
      subAccount: null,
      referenceCode: 'FT123',
      code: null,
      transferAmount: 500000,
      transferType: 'in',
      accumulated: 500000,
      content: 'BK-001',
    });

    const params = query.mock.calls[0][1] as unknown[];
    expect((params[5] as Date).toISOString()).toBe('2026-10-12T03:32:00.000Z');
    expect(emitAsync).toHaveBeenCalledTimes(1);
  });
});
