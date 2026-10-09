import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthCookieService } from '../auth.cookie';
import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Optional session guard: resolves active session if cookie is present,
 * attaches user to request, but does NOT reject unauthenticated requests.
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.cookies.readToken(request);

    if (!token) {
      return true;
    }

    try {
      const resolved = await this.authService.resolveSession(token);
      if (resolved) {
        request.user = resolved.user;
        request.sessionId = resolved.sessionId;
      }
    } catch {
      // Ignore resolution error for optional session
    }

    return true;
  }
}
