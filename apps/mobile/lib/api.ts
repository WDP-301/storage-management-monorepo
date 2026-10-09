import { Platform } from 'react-native';
import type { AuthUser, LoginInput, RegisterInput } from '../src/types/auth';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${DEV_HOST}:3001/api/v1`;
const REQUEST_TIMEOUT_MS = 10000;
let unauthorizedHandler: (() => void) | undefined;

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

type ApiErrorEnvelope = {
  message?: string | string[];
  statusCode?: number;
  code?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    /** Machine code from the API error body (e.g. CONFLICT) — stable, unlike message text. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Shared fetch wrapper: unwraps the API envelope and normalises errors.
 *
 * `timeoutMs` exists for the few writes that take a row lock server-side — aborting those early
 * does not undo them, it just leaves the app unsure whether they happened.
 */
export async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  let response: Response;
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...requestInit } = init ?? {};
  // Always fetch with our own controller so the timeout applies even when the caller passes a
  // signal; the caller's signal is chained into it rather than replacing it.
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, timeoutMs);
  const callerSignal = init?.signal;

  if (callerSignal?.aborted) abort();
  else callerSignal?.addEventListener('abort', abort);

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      `Không thể kết nối API tại ${API_BASE_URL}. Kiểm tra backend và EXPO_PUBLIC_API_URL.`,
    );
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abort);
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | ApiErrorEnvelope
    | null;

  if (!response.ok) {
    const apiMessage = payload && 'message' in payload ? payload.message : undefined;
    const message = Array.isArray(apiMessage)
      ? apiMessage.join('\n')
      : (apiMessage ?? `API error ${response.status}`);
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    const code = payload && 'code' in payload ? payload.code : undefined;
    throw new ApiError(message, response.status, code);
  }

  if (payload && 'success' in payload && 'data' in payload) {
    return payload.data;
  }

  throw new ApiError('API trả về dữ liệu không hợp lệ.', response.status);
}

export const AuthApi = {
  setUnauthorizedHandler: (handler?: () => void) => {
    unauthorizedHandler = handler;
  },

  me: async () => {
    const response = await request<{ user: AuthUser }>('/auth/me');
    return response.user;
  },

  login: async (input: LoginInput) => {
    await request<{ expiresAt: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return AuthApi.me();
  },

  register: async (input: RegisterInput) => {
    await request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return AuthApi.login({ email: input.email, password: input.password });
  },

  logout: () =>
    request<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
    }),
};
