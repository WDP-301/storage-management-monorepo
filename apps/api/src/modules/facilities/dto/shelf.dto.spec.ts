import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkCreateShelvesDto, CreateShelfDto } from './shelf.dto';

const spec = { widthM: 1, lengthM: 0.6, monthlyPrice: 300_000 };

const failedFields = async <T extends object>(cls: new () => T, plain: object) =>
  (await validate(plainToInstance(cls, plain))).map((error) => error.property);

describe('CreateShelfDto', () => {
  it('accepts the minimal shelf and optional height, deposit and notes', async () => {
    await expect(failedFields(CreateShelfDto, { code: 'KK1-A-01', ...spec })).resolves.toEqual([]);
    await expect(
      failedFields(CreateShelfDto, {
        code: 'KK1-A-01',
        ...spec,
        heightM: 2,
        depositMonths: 1,
        notes: 'x',
      }),
    ).resolves.toEqual([]);
  });

  it('rejects a missing code, a non-positive size and a rent above the column limit', async () => {
    const fields = await failedFields(CreateShelfDto, {
      widthM: 0,
      lengthM: -1,
      monthlyPrice: 1e12,
    });
    expect(fields).toEqual(expect.arrayContaining(['code', 'widthM', 'lengthM', 'monthlyPrice']));
  });

  it('rejects a status that implies a customer is attached', async () => {
    await expect(
      failedFields(CreateShelfDto, { code: 'KK1-A-01', ...spec, status: 'RENTED' }),
    ).resolves.toEqual(['status']);
  });
});

describe('BulkCreateShelvesDto', () => {
  const bulk = { prefix: 'A', from: 1, to: 20, ...spec };

  it('accepts a normal batch with and without padding', async () => {
    await expect(failedFields(BulkCreateShelvesDto, bulk)).resolves.toEqual([]);
    await expect(failedFields(BulkCreateShelvesDto, { ...bulk, pad: 3 })).resolves.toEqual([]);
  });

  it.each([['a-b'], [''], ['ABCDEFGHIJK']])('rejects prefix %p', async (prefix) => {
    await expect(failedFields(BulkCreateShelvesDto, { ...bulk, prefix })).resolves.toEqual([
      'prefix',
    ]);
  });

  it('rejects negative or fractional bounds and an excessive pad', async () => {
    const fields = await failedFields(BulkCreateShelvesDto, {
      ...bulk,
      from: -1,
      to: 1.5,
      pad: 7,
    });
    expect(fields).toEqual(expect.arrayContaining(['from', 'to', 'pad']));
  });
});
