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

  it.each([
    '0912345678', // Vinaphone
    '+84912345678',
    '84912345678',
    '0321234567', // Viettel
    '0551234567', // Wintel (MVNO)
    '0591234567', // Gmobile
    '0871234567', // Itelecom (MVNO)
  ])('accepts the Vietnamese phone number %s', async (phone) => {
    await expect(validate(build({ phone }))).resolves.toHaveLength(0);
  });

  it.each([
    '1234567890', // starts with 1 (discontinued 01x prefixes)
    '0212345678', // 02x is a landline area code
    '0541234567', // 054 is not assigned to any carrier
    '0712345678', // 071-075 are not assigned
    '0951234567', // 095 is not assigned
    '091234567', // too short
    '09123456789', // too long
    'not-a-phone',
  ])('rejects the invalid phone number %s', async (phone) => {
    await expect(invalidProperties(build({ phone }))).resolves.toContain('phone');
  });
});
