import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { AuthCookieService } from '../auth.cookie';
import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.cookies.readToken(request);

    if (!token) {
      throw new DomainException(
        ErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.authService.resolveSession(token);
    if (!user) {
      throw new DomainException(
        ErrorCode.SESSION_INVALID,
        'Session is invalid or expired',
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.user = user;
    return true;
  }
}
