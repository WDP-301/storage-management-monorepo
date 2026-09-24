import { ArgumentMetadata } from '@nestjs/common';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { createApiValidationPipe } from './api-validation.pipe';

const metadata: ArgumentMetadata = { type: 'body', metatype: LoginDto, data: undefined };

describe('API validation pipe', () => {
  it('returns stable validation code and field details', async () => {
    const pipe = createApiValidationPipe();
    await expect(
      pipe.transform({ email: 'bad', password: '', extra: true }, metadata),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: {
          fields: expect.arrayContaining([
            expect.objectContaining({ field: 'email', code: 'isEmail' }),
          ]),
        },
      },
    });
  });
});
