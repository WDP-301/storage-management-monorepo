import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import type { CookieOptions, Request, Response } from 'express';
import { generateSessionToken, hashSessionToken } from './session.util';

const DEFAULT_COOKIE_NAME = 'sid';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type SameSite = 'lax' | 'strict';
const SUPPORTED_SAME_SITE: readonly SameSite[] = ['lax', 'strict'];

@Injectable()
export class AuthCookieService {
  private readonly logger = new Logger(AuthCookieService.name);
  private readonly cookieName: string;
  private readonly secure: boolean;
  private readonly sameSite: SameSite;

  readonly ttlMs: number;

  constructor(configService: ConfigService) {
    this.cookieName = configService.get<string>(ENV_KEY.SESSION_COOKIE_NAME, DEFAULT_COOKIE_NAME);
    this.ttlMs = Number(configService.get<string>(ENV_KEY.SESSION_TTL_MS, String(DEFAULT_TTL_MS)));
    this.secure =
      configService.get<string>(ENV_KEY.COOKIE_SECURE, 'false').toLowerCase() === 'true';
    this.sameSite = this.resolveSameSite(configService.get<string>(ENV_KEY.COOKIE_SAME_SITE));
  }

  /**
   * Only `lax`/`strict` are allowed. `SameSite=None` requires HTTPS **and** CSRF protection
   * (Origin check or CSRF token), none of which is implemented yet, so it is rejected.
   */
  private resolveSameSite(value?: string): SameSite {
    const normalized = value?.toLowerCase();

    if (normalized && SUPPORTED_SAME_SITE.includes(normalized as SameSite)) {
      return normalized as SameSite;
    }

    if (normalized === 'none') {
      this.logger.warn(
        "COOKIE_SAME_SITE=none is not supported (needs HTTPS + CSRF protection); falling back to 'lax'.",
      );
    }

    return 'lax';
  }

  generateToken(): string {
    return generateSessionToken();
  }

  hashToken(token: string): string {
    return hashSessionToken(token);
  }

  readToken(request: Request): string | undefined {
    const header = request.headers.cookie;
    if (!header) {
      return undefined;
    }

    for (const part of header.split(';')) {
      const separator = part.indexOf('=');
      if (separator === -1) {
        continue;
      }
      if (part.slice(0, separator).trim() === this.cookieName) {
        // Tokens are base64url, so the value is already raw — never URI-decode
        // attacker-controlled cookie data (e.g. `sid=%` would throw URIError).
        return part.slice(separator + 1).trim();
      }
    }

    return undefined;
  }

  set(response: Response, token: string): void {
    response.cookie(this.cookieName, token, this.buildOptions());
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, this.buildOptions());
  }

  private buildOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: this.sameSite,
      maxAge: this.ttlMs,
      path: '/',
      // Keep the raw base64url token so readToken can return the exact stored value.
      encode: String,
    };
  }
}
