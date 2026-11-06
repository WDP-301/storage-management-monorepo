import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShelfPageQueryDto, ShelfReceiptSearchQueryDto } from './shelf-list-query.dto';
import { CreateShelfReceiptDto, VoidShelfReceiptDto } from './shelf-receipt.dto';
import { CreateShelfRecoveryDto } from './shelf-recovery.dto';

const uuid = '11111111-1111-4111-8111-111111111111';
const photo = { fileKey: 'uploads/u-1-a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' };
const failed = async (cls: new () => object, plain: object) =>
  (await validate(plainToInstance(cls, plain))).map((error) => error.property);

const receipt = {
  clientRequestId: uuid,
  sessionId: uuid,
  contractId: uuid,
  type: 'DROP_OFF',
  lines: [{ name: 'Sách', quantity: 1 }],
  photos: [photo],
};

describe('CreateShelfReceiptDto', () => {
  it('accepts a valid drop-off', async () => {
    await expect(failed(CreateShelfReceiptDto, receipt)).resolves.toEqual([]);
  });

  it.each([
    ['no lines', { lines: [] }],
    ['51 lines', { lines: Array.from({ length: 51 }, () => ({ name: 'A', quantity: 1 })) }],
    ['11 photos', { photos: Array.from({ length: 11 }, () => photo) }],
    ['an unknown type', { type: 'SWAP' }],
    ['a note over 1000 characters', { note: 'x'.repeat(1001) }],
    ['a non-uuid session', { sessionId: 'abc' }],
  ])('rejects %s', async (_label, patch) => {
    expect((await failed(CreateShelfReceiptDto, { ...receipt, ...patch })).length).toBeGreaterThan(
      0,
    );
  });

  it.each([0, 10001, 1.5])('rejects a line quantity of %p', async (quantity) => {
    expect(
      (await failed(CreateShelfReceiptDto, { ...receipt, lines: [{ name: 'A', quantity }] }))
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('VoidShelfReceiptDto', () => {
  it('accepts 3..500 characters', async () => {
    await expect(failed(VoidShelfReceiptDto, { reason: 'Nhầm' })).resolves.toEqual([]);
  });

  it.each(['ab', '   ', 'a  ', '  ab ', 'x'.repeat(501)])('rejects %p', async (reason) => {
    await expect(failed(VoidShelfReceiptDto, { reason })).resolves.toEqual(['reason']);
  });
});

describe('CreateShelfRecoveryDto', () => {
  const recovery = {
    clientRequestId: uuid,
    contractId: uuid,
    lines: [{ itemId: uuid, quantity: 2 }],
    photos: [photo],
    note: 'Khách bỏ kệ',
  };

  it('accepts a valid recovery', async () => {
    await expect(failed(CreateShelfRecoveryDto, recovery)).resolves.toEqual([]);
  });

  it.each([
    ['no photo', { photos: [] }],
    ['a blank note', { note: '  ' }],
    ['a name line', { lines: [{ name: 'A', quantity: 1 }] }],
  ])('rejects %s', async (_label, patch) => {
    expect(
      (await failed(CreateShelfRecoveryDto, { ...recovery, ...patch })).length,
    ).toBeGreaterThan(0);
  });
});

describe('list query DTOs', () => {
  it('caps the page size at 50', async () => {
    await expect(failed(ShelfPageQueryDto, { limit: '50' })).resolves.toEqual([]);
    await expect(failed(ShelfPageQueryDto, { limit: '51' })).resolves.toEqual(['limit']);
    await expect(failed(ShelfReceiptSearchQueryDto, { search: 'x'.repeat(151) })).resolves.toEqual([
      'search',
    ]);
  });

  it('accepts the receipt filters and reads disputed as a boolean', async () => {
    const query = {
      type: 'PICK_UP',
      status: 'ACTIVE',
      from: '2026-11-01',
      to: '2026-11-07',
      disputed: 'true',
    };
    await expect(failed(ShelfReceiptSearchQueryDto, query)).resolves.toEqual([]);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('reads disputed=%s as %s under the global implicit conversion', (raw, expected) => {
    const dto = plainToInstance(
      ShelfReceiptSearchQueryDto,
      { disputed: raw },
      { enableImplicitConversion: true },
    );
    expect(dto.disputed).toBe(expected);
  });

  it('rejects an unknown type or status and a malformed or impossible day', async () => {
    await expect(failed(ShelfReceiptSearchQueryDto, { type: 'X', status: 'Y' })).resolves.toEqual([
      'type',
      'status',
    ]);
    await expect(
      failed(ShelfReceiptSearchQueryDto, { from: '2026-13-01', to: '1/2/2026' }),
    ).resolves.toEqual(['from', 'to']);
    await expect(failed(ShelfReceiptSearchQueryDto, { from: '2026-02-30' })).resolves.toEqual([
      'from',
    ]);
  });
});
