import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWarehouseDto, MAX_WAREHOUSE_IMAGES, UpdateWarehouseDto } from './warehouse.dto';

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
