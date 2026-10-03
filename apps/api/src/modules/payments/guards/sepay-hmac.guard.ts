import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import type { Request } from 'express';

@Injectable()
export class SepayHmacGuard implements CanActivate {
  private readonly logger = new Logger(SepayHmacGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

    const secretKey = this.configService.get<string>(ENV_KEY.SEPAY_WEBHOOK_SECRET);
    if (!secretKey) {
      this.logger.error('SEPAY_WEBHOOK_SECRET is not configured');
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const signatureHeader = request.headers['x-sepay-signature'] as string;
    if (!signatureHeader) {
      this.logger.warn('Missing X-SePay-Signature header');
      throw new UnauthorizedException('Missing signature');
    }

    const timestamp = request.headers['x-sepay-timestamp'] as string;
    if (!timestamp) {
      this.logger.warn('Missing X-SePay-Timestamp header');
      throw new UnauthorizedException('Missing timestamp');
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
      this.logger.warn('Stale or invalid X-SePay-Timestamp');
      throw new UnauthorizedException('Request expired');
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      this.logger.error('rawBody not available — ensure rawBody: true in NestFactory.create()');
      throw new UnauthorizedException('Cannot verify signature');
    }

    // SePay ký: HMAC-SHA256(secret, timestamp + "." + rawBody)
    const signingPayload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSignature = `sha256=${createHmac('sha256', secretKey).update(signingPayload).digest('hex')}`;

    try {
      const receivedBuf = Buffer.from(signatureHeader, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
        this.logger.warn('HMAC signature mismatch');
        throw new UnauthorizedException('Invalid signature');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Signature verification failed');
    }

    return true;
  }
}
