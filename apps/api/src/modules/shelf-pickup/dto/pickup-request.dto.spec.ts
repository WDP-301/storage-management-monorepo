import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePickupRequestDto } from './pickup-request.dto';

const ID = '3f2b8a52-6c3d-4d0e-9a41-0d5f6f1c2b11';
const base = {
  lines: [{ itemId: ID, quantity: 2 }],
  requestedFor: '2026-11-10T09:00:00+07:00',
};
const failed = async (plain: object) =>
  (await validate(plainToInstance(CreatePickupRequestDto, plain))).map((e) => e.property);

describe('CreatePickupRequestDto', () => {
  it('accepts a valid body', async () => {
    await expect(failed({ ...base, note: 'x' })).resolves.toEqual([]);
  });

  it.each([
    ['empty lines', { lines: [] }],
    ['51 lines', { lines: Array.from({ length: 51 }, () => ({ itemId: ID, quantity: 1 })) }],
    ['quantity 0', { lines: [{ itemId: ID, quantity: 0 }] }],
    ['quantity 10001', { lines: [{ itemId: ID, quantity: 10001 }] }],
    ['fractional quantity', { lines: [{ itemId: ID, quantity: 1.5 }] }],
    ['bad item id', { lines: [{ itemId: 'nope', quantity: 1 }] }],
  ])('rejects %s', async (_label, patch) => {
    await expect(failed({ ...base, ...patch })).resolves.toEqual(['lines']);
  });

  it.each(['2026-11-10', '2026-11-10T09:00:00', 'tomorrow'])(
    'rejects requestedFor %p (no explicit offset)',
    async (requestedFor) => {
      await expect(failed({ ...base, requestedFor })).resolves.toEqual(['requestedFor']);
    },
  );

  it('rejects a note over 500 characters', async () => {
    await expect(failed({ ...base, note: 'x'.repeat(501) })).resolves.toEqual(['note']);
  });
});
