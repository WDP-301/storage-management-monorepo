import { MAX_UNIT_AMENITIES } from '@modules/amenities/unit-amenities';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateWarehouseDto,
  MAX_WAREHOUSE_IMAGES,
  UpdateWarehouseDto,
  WarehouseListQueryDto,
} from './warehouse.dto';
import { MAX_AMENITY_FILTER } from './warehouse-amenity.dto';

const image = (n: number, mimeType = 'image/jpeg') => ({
  fileKey: `uploads/${n}-kho.jpg`,
  name: `kho-${n}.jpg`,
  mimeType,
  size: 1024,
});

const imageErrors = async (images: unknown) =>
  (await validate(plainToInstance(UpdateWarehouseDto, { images }))).filter(
    (error) => error.property === 'images',
  );

describe('UpdateWarehouseDto images', () => {
  it('accepts a list of uploaded photos, and an empty list to clear them', async () => {
    await expect(imageErrors([image(1), image(2, 'image/png')])).resolves.toHaveLength(0);
    await expect(imageErrors([])).resolves.toHaveLength(0);
  });

  it('rejects a non-image file', async () => {
    await expect(imageErrors([image(1, 'application/pdf')])).resolves.toHaveLength(1);
  });

  it('rejects a key outside uploads/', async () => {
    await expect(
      imageErrors([{ ...image(1), fileKey: 'private/contract.pdf' }]),
    ).resolves.toHaveLength(1);
  });

  it('rejects the same file twice', async () => {
    await expect(imageErrors([image(1), image(1)])).resolves.toHaveLength(1);
  });

  it(`rejects more than ${MAX_WAREHOUSE_IMAGES} photos`, async () => {
    const tooMany = Array.from({ length: MAX_WAREHOUSE_IMAGES + 1 }, (_, i) => image(i));
    await expect(imageErrors(tooMany)).resolves.toHaveLength(1);
  });
});

describe('warehouse kind', () => {
  const base = {
    facilityId: '7b0d3a52-7a0e-4a2f-8f43-2d6a0f9d3a11',
    code: 'KK1',
    name: 'Kho kệ 1',
    addressLine: '1 Test',
    latitude: 10.7,
    longitude: 106.7,
    widthM: 20,
    lengthM: 30,
    heightM: 5,
  };
  const fields = async <T extends object>(cls: new () => T, plain: object) =>
    (await validate(plainToInstance(cls, plain))).map((error) => error.property);

  it('requires a price for self storage but not for a shelf warehouse', async () => {
    await expect(fields(CreateWarehouseDto, base)).resolves.toEqual(['monthlyPrice']);
    await expect(fields(CreateWarehouseDto, { ...base, kind: 'SHELF_WAREHOUSE' })).resolves.toEqual(
      [],
    );
  });

  it('refuses SHELF as a creatable kind', async () => {
    await expect(
      fields(CreateWarehouseDto, { ...base, monthlyPrice: 1, kind: 'SHELF' }),
    ).resolves.toEqual(['kind']);
  });

  it('is not a property of the update payload', async () => {
    // The global pipe runs with forbidNonWhitelisted, so a kind sent on PATCH is a 400.
    const dto = plainToInstance(UpdateWarehouseDto, { kind: 'SHELF_WAREHOUSE' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toEqual(['kind']);
  });
});

describe('warehouse amenities', () => {
  const ID_A = '7b0d3a52-7a0e-4a2f-8f43-2d6a0f9d3a11';
  const ID_B = '0f4c2b91-3d6e-4b58-9d2a-5c1e7a8b9c22';
  const errorsOf = async <T extends object>(cls: new () => T, plain: object, property: string) =>
    (await validate(plainToInstance(cls, plain))).filter((error) => error.property === property);
  const filter = (amenityIds: unknown) => plainToInstance(WarehouseListQueryDto, { amenityIds });

  describe('amenityIds filter', () => {
    it('reads a comma-separated value and a repeated key alike', () => {
      expect(filter(`${ID_A},${ID_B}`).amenityIds).toEqual([ID_A, ID_B]);
      expect(filter([ID_A, ID_B]).amenityIds).toEqual([ID_A, ID_B]);
    });

    it('trims, drops blanks and removes repeated ids', () => {
      expect(filter(` ${ID_A} ,, ${ID_A},${ID_B},`).amenityIds).toEqual([ID_A, ID_B]);
    });

    it('treats an uppercase id as the same id', () => {
      expect(filter(`${ID_A.toUpperCase()},${ID_A}`).amenityIds).toEqual([ID_A]);
    });

    it('is optional', async () => {
      expect(filter(undefined).amenityIds).toBeUndefined();
      await expect(errorsOf(WarehouseListQueryDto, {}, 'amenityIds')).resolves.toHaveLength(0);
    });

    it('rejects an id that is not a uuid', async () => {
      await expect(
        errorsOf(WarehouseListQueryDto, { amenityIds: 'abc' }, 'amenityIds'),
      ).resolves.toHaveLength(1);
    });

    it('rejects more than the allowed number of ids', async () => {
      const ids = Array.from(
        { length: MAX_AMENITY_FILTER + 1 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      ).join(',');
      await expect(
        errorsOf(WarehouseListQueryDto, { amenityIds: ids }, 'amenityIds'),
      ).resolves.toHaveLength(1);
    });
  });

  describe('amenities on a warehouse', () => {
    const check = (amenities: unknown) => errorsOf(UpdateWarehouseDto, { amenities }, 'amenities');

    it('accepts a list, an empty list and a missing note', async () => {
      await expect(
        check([
          { amenityId: ID_A, quantity: 2, note: 'north wall' },
          { amenityId: ID_B, quantity: 99, note: null },
        ]),
      ).resolves.toHaveLength(0);
      await expect(check([])).resolves.toHaveLength(0);
      await expect(check([{ amenityId: ID_A, quantity: 1 }])).resolves.toHaveLength(0);
    });

    it.each([0, 100, 1.5])('rejects quantity %s', async (quantity) => {
      await expect(check([{ amenityId: ID_A, quantity }])).resolves.toHaveLength(1);
    });

    it('lowercases amenityId so mixed-case repeats are caught as duplicates', async () => {
      const dto = plainToInstance(UpdateWarehouseDto, {
        amenities: [{ amenityId: ID_A.toUpperCase(), quantity: 1 }],
      });
      expect(dto.amenities?.[0].amenityId).toBe(ID_A);
      await expect(
        check([
          { amenityId: ID_A.toUpperCase(), quantity: 1 },
          { amenityId: ID_A, quantity: 2 },
        ]),
      ).resolves.toHaveLength(1);
    });

    it('rejects the same amenity twice', async () => {
      await expect(
        check([
          { amenityId: ID_A, quantity: 1 },
          { amenityId: ID_A, quantity: 2 },
        ]),
      ).resolves.toHaveLength(1);
    });

    it('rejects a bad id, a long note and too many entries', async () => {
      await expect(check([{ amenityId: 'x', quantity: 1 }])).resolves.toHaveLength(1);
      await expect(
        check([{ amenityId: ID_A, quantity: 1, note: 'n'.repeat(256) }]),
      ).resolves.toHaveLength(1);
      const tooMany = Array.from({ length: MAX_UNIT_AMENITIES + 1 }, (_, i) => ({
        amenityId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        quantity: 1,
      }));
      await expect(check(tooMany)).resolves.toHaveLength(1);
    });
  });
});
