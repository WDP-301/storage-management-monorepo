import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';

const build = (overrides: Record<string, unknown> = {}): ChangePasswordDto =>
  plainToInstance(ChangePasswordDto, {
    currentPassword: 'OldPassword123',
    newPassword: 'NewPassword123',
    confirmPassword: 'NewPassword123',
    ...overrides,
  });

const invalidProperties = async (dto: object): Promise<string[]> =>
  (await validate(dto)).map((error) => error.property);

describe('ChangePasswordDto', () => {
  it('accepts a fully valid payload', async () => {
    await expect(validate(build())).resolves.toHaveLength(0);
  });

  it.each(['currentPassword', 'newPassword', 'confirmPassword'])(
    'rejects the payload when %s is missing',
    async (field) => {
      const dto = build();
      delete (dto as unknown as Record<string, unknown>)[field];

      await expect(invalidProperties(dto)).resolves.toContain(field);
    },
  );

  it('rejects a new password shorter than 8 characters', async () => {
    await expect(invalidProperties(build({ newPassword: 'short' }))).resolves.toContain(
      'newPassword',
    );
  });

  it('rejects a new password longer than 72 characters', async () => {
    await expect(invalidProperties(build({ newPassword: 'a'.repeat(73) }))).resolves.toContain(
      'newPassword',
    );
  });

  it('accepts new passwords at the 8 and 72 character bounds', async () => {
    await expect(validate(build({ newPassword: 'a'.repeat(8) }))).resolves.toHaveLength(0);
    await expect(validate(build({ newPassword: 'a'.repeat(72) }))).resolves.toHaveLength(0);
  });
});
