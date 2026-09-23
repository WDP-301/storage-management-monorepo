import type { Request } from 'express';
import type { AuthUser } from './auth-user';

/** Express request after SessionGuard has attached the authenticated user. */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
