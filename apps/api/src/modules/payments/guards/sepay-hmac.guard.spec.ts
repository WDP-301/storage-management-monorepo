import { createHmac } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import { SepayHmacGuard } from './sepay-hmac.guard';

describe('SepayHmacGuard', () => {
  const secretKey = 'test-secret-key';
  let configService: jest.Mocked<ConfigService>;
  let guard: SepayHmacGuard;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === ENV_KEY.SEPAY_WEBHOOK_SECRET) return secretKey;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new SepayHmacGuard(configService);
  });

  const createMockContext = (
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): ExecutionContext => {
    const request = {
      headers,
      rawBody,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should throw UnauthorizedException if secret is not configured', () => {
    configService.get.mockReturnValue(undefined);
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Webhook secret not configured'),
    );
  });

  it('should throw UnauthorizedException if X-SePay-Signature header is missing', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Missing signature'),
    );
  });

  it('should throw UnauthorizedException if X-SePay-Timestamp header is missing', () => {
    const context = createMockContext({
      'x-sepay-signature': 'sha256=abc',
    });

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Missing timestamp'),
    );
  });

  it('should throw UnauthorizedException if timestamp is not a finite number', () => {
    const context = createMockContext({
      'x-sepay-signature': 'sha256=abc',
      'x-sepay-timestamp': 'invalid-timestamp',
    });

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Request expired'));
  });

  it('should throw UnauthorizedException if timestamp is older than 300 seconds', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 301;
    const context = createMockContext({
      'x-sepay-signature': 'sha256=abc',
      'x-sepay-timestamp': String(staleTimestamp),
    });

    expect(() => guard.canActivate(context)).toThrow(new UnauthorizedException('Request expired'));
  });

  it('should throw UnauthorizedException if rawBody is missing', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const context = createMockContext({
      'x-sepay-signature': 'sha256=abc',
      'x-sepay-timestamp': String(currentTimestamp),
    });

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Cannot verify signature'),
    );
  });

  it('should throw UnauthorizedException if signature does not match', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const rawBody = Buffer.from(JSON.stringify({ id: 123 }));
    const context = createMockContext(
      {
        'x-sepay-signature': 'sha256=wrongsignature',
        'x-sepay-timestamp': String(currentTimestamp),
      },
      rawBody,
    );

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Invalid signature'),
    );
  });

  it('should return true for valid timestamp and valid signature', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const bodyStr = JSON.stringify({ id: 123, amount: 50000 });
    const rawBody = Buffer.from(bodyStr, 'utf8');

    const signingPayload = `${currentTimestamp}.${bodyStr}`;
    const signature = `sha256=${createHmac('sha256', secretKey).update(signingPayload).digest('hex')}`;

    const context = createMockContext(
      {
        'x-sepay-signature': signature,
        'x-sepay-timestamp': String(currentTimestamp),
      },
      rawBody,
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
