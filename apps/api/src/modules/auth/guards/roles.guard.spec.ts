import type { ExecutionContext } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole } from '@storage/types';
import type { AuthUser } from '../types/auth-user';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { RolesGuard } from './roles.guard';

const reflectorWith = (roles?: string[]): Reflector =>
  ({
    getAllAndOverride: jest.fn(() => roles),
  }) as unknown as Reflector;

const contextWith = (user?: Partial<AuthUser>): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: (): AuthenticatedRequest => ({ user }) as never }),
  }) as unknown as ExecutionContext;

const authUser = (roles: UserRole[]): Partial<AuthUser> => ({ id: 'user-1', roles });

const expectDomainError = (error: unknown, code: ErrorCode, status: HttpStatus): void => {
  expect(error).toBeInstanceOf(DomainException);
  expect((error as DomainException).getStatus()).toBe(status);
  expect((error as DomainException).getResponse()).toMatchObject({ code });
};

describe('RolesGuard', () => {
  it('allows the request when no roles are required', () => {
    const guard = new RolesGuard(reflectorWith(undefined));

    expect(guard.canActivate(contextWith(authUser([UserRole.CUSTOMER])))).toBe(true);
  });

  it('allows the request when an empty role list is required', () => {
    const guard = new RolesGuard(reflectorWith([]));

    expect(guard.canActivate(contextWith(authUser([])))).toBe(true);
  });

  it('allows the request when the user holds a required role', () => {
    const guard = new RolesGuard(reflectorWith([UserRole.FACILITY_MANAGER, UserRole.ADMIN]));

    expect(guard.canActivate(contextWith(authUser([UserRole.ADMIN])))).toBe(true);
  });

  it('rejects the request when the user holds none of the required roles', () => {
    const guard = new RolesGuard(reflectorWith([UserRole.ADMIN]));

    try {
      guard.canActivate(contextWith(authUser([UserRole.CUSTOMER])));
      throw new Error('expected RolesGuard to reject');
    } catch (error) {
      expectDomainError(error, ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
  });

  it('rejects the request when roles are required but no user is attached', () => {
    const guard = new RolesGuard(reflectorWith([UserRole.ADMIN]));

    try {
      guard.canActivate(contextWith(undefined));
      throw new Error('expected RolesGuard to reject');
    } catch (error) {
      expectDomainError(error, ErrorCode.AUTHENTICATION_REQUIRED, HttpStatus.UNAUTHORIZED);
    }
  });
});
