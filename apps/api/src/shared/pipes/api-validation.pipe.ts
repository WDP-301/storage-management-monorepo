import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ErrorCode, ValidationFieldDetail } from '../models/api-response';

const flattenErrors = (errors: ValidationError[], parent = ''): ValidationFieldDetail[] =>
  errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([code, message]) => ({
      field,
      code,
      message,
    }));
    return [...own, ...flattenErrors(error.children ?? [], field)];
  });

export const createApiValidationPipe = () =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Validation failed',
        details: { fields: flattenErrors(errors) },
      }),
  });
