import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_WAREHOUSE_IMAGES, UpdateWarehouseDto } from './warehouse.dto';

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
