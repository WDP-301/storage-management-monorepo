import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

const build = (overrides: Record<string, unknown> = {}): RegisterDto =>
  plainToInstance(RegisterDto, {
    email: 'customer@example.com',
    password: 'secret123',
    fullName: 'Nguyen Van A',
    phone: '0912345678',
    ...overrides,
  });

const invalidProperties = async (dto: object): Promise<string[]> =>
  (await validate(dto)).map((error) => error.property);

describe('RegisterDto', () => {
  it('accepts a fully valid payload', async () => {
    await expect(validate(build())).resolves.toHaveLength(0);
  });

  it.each(['email', 'password', 'fullName', 'phone'])(
    'rejects the payload when %s is missing',
    async (field) => {
      const dto = build();
      delete (dto as unknown as Record<string, unknown>)[field];

      await expect(invalidProperties(dto)).resolves.toContain(field);
    },
  );

  it.each(['0912345678', '+84912345678', '84912345678'])(
    'accepts the Vietnamese phone number %s',
    async (phone) => {
      await expect(validate(build({ phone }))).resolves.toHaveLength(0);
    },
  );

  it.each(['1234567890', '0212345678', '091234567', '09123456789', 'not-a-phone'])(
    'rejects the invalid phone number %s',
    async (phone) => {
      await expect(invalidProperties(build({ phone }))).resolves.toContain('phone');
    },
  );
});
