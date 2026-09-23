import type { ConfigService } from '@nestjs/config';
import { ENV_KEY } from '@shared/constants';
import type { Request, Response } from 'express';
import { AuthCookieService } from './auth.cookie';

const configService = (values: Record<string, string> = {}): ConfigService =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  }) as unknown as ConfigService;

const requestWith = (cookie?: string): Request => ({ headers: { cookie } }) as unknown as Request;

const sameSiteFor = (values: Record<string, string>): unknown => {
  const response = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
  new AuthCookieService(configService(values)).set(response, 'token');
  return (response.cookie as jest.Mock).mock.calls[0][2].sameSite;
};

describe('AuthCookieService', () => {
  const service = new AuthCookieService(configService());

  describe('readToken', () => {
    it('returns undefined when there is no cookie header', () => {
      expect(service.readToken(requestWith(undefined))).toBeUndefined();
    });

    it('returns the raw token when present', () => {
      expect(service.readToken(requestWith('sid=AbC-123_xyz'))).toBe('AbC-123_xyz');
    });

    it('finds the right cookie among several', () => {
      expect(service.readToken(requestWith('theme=dark; sid=token-value; lang=vi'))).toBe(
        'token-value',
      );
    });

    it('returns undefined when the cookie name is absent', () => {
      expect(service.readToken(requestWith('theme=dark'))).toBeUndefined();
    });

    it('does not throw and returns the raw value for malformed percent input', () => {
      expect(() => service.readToken(requestWith('sid=%'))).not.toThrow();
      expect(service.readToken(requestWith('sid=%'))).toBe('%');
    });
  });

  describe('sameSite', () => {
    it('defaults to lax when unset', () => {
      expect(sameSiteFor({})).toBe('lax');
    });

    it('accepts strict', () => {
      expect(sameSiteFor({ [ENV_KEY.COOKIE_SAME_SITE]: 'strict' })).toBe('strict');
    });

    it('falls back to lax when none is requested', () => {
      expect(sameSiteFor({ [ENV_KEY.COOKIE_SAME_SITE]: 'none' })).toBe('lax');
    });

    it('falls back to lax for an unsupported value', () => {
      expect(sameSiteFor({ [ENV_KEY.COOKIE_SAME_SITE]: 'bogus' })).toBe('lax');
    });
  });
});
