import type { Request } from 'express';
import type { AuthUser } from './auth-user';

/** Express request after SessionGuard has attached the authenticated user and its session id. */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionId?: string;
}
