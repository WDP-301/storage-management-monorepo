import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
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
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.authService.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    request.user = user;
    return true;
  }
}
