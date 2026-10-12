import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListCheckInsQueryDto } from './access.dto';

const failedFields = async (plain: object) =>
  (await validate(plainToInstance(ListCheckInsQueryDto, plain))).map((error) => error.property);

describe('ListCheckInsQueryDto', () => {
  it('accepts timestamps with an explicit offset', async () => {
    await expect(
      failedFields({ from: '2026-10-12T00:00:00+07:00', to: '2026-10-12T16:59:59.999Z' }),
    ).resolves.toEqual([]);
  });

  it.each(['2026-10-12', '2026-10-12T23:59:59', 'yesterday'])(
    'rejects %p, which would be read in an unintended timezone',
    async (value) => {
      await expect(failedFields({ from: value, to: value })).resolves.toEqual(['from', 'to']);
    },
  );
});
