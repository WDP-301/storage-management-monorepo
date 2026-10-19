import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAmenityDto, UpdateAmenityDto } from './amenity.dto';

describe('amenity DTOs', () => {
  const nameErrors = async <T extends object>(cls: new () => T, plain: object) =>
    (await validate(plainToInstance(cls, plain))).filter((error) => error.property === 'name');

  it('rejects a whitespace-only name on create and update', async () => {
    await expect(nameErrors(CreateAmenityDto, { code: 'CCTV', name: '   ' })).resolves.toHaveLength(
      1,
    );
    await expect(nameErrors(UpdateAmenityDto, { name: '   ' })).resolves.toHaveLength(1);
  });

  it('trims the name before it is stored', () => {
    expect(plainToInstance(CreateAmenityDto, { code: 'CCTV', name: '  Camera  ' }).name).toBe(
      'Camera',
    );
  });
});
