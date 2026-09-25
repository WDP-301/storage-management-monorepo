import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApi } from '../lib/api';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/api', () => ({
  AuthApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
  setUnauthorizedCallback: vi.fn(),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('restores authenticated user on startup if session cookie is valid', async () => {
    const mockUser = {
      id: 'usr-1',
      email: 'customer@example.com',
      fullName: 'Customer Test',
      status: 'ACTIVE' as const,
      roles: ['CUSTOMER' as const],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(AuthApi.me).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('sets user to null when initial session check fails', async () => {
    vi.mocked(AuthApi.me).mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('authenticates user and updates state on successful login', async () => {
    vi.mocked(AuthApi.me).mockRejectedValueOnce(new Error('No session'));
    const mockUser = {
      id: 'usr-2',
      email: 'user@example.com',
      fullName: 'User Two',
      status: 'ACTIVE' as const,
      roles: ['CUSTOMER' as const],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(AuthApi.login).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login({ email: 'user@example.com', password: 'password123' });
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('translates connection errors to user-friendly error message on login', async () => {
    vi.mocked(AuthApi.me).mockRejectedValueOnce(new Error('No session'));
    vi.mocked(AuthApi.login).mockRejectedValueOnce(new Error('Network Error: ECONNREFUSED'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.login({ email: 'test@example.com', password: 'password' });
      }),
    ).rejects.toThrow('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
  });

  it('clears user state on logout', async () => {
    const mockUser = {
      id: 'usr-3',
      email: 'customer@example.com',
      fullName: 'Customer Three',
      status: 'ACTIVE' as const,
      roles: ['CUSTOMER' as const],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(AuthApi.me).mockResolvedValueOnce(mockUser);
    vi.mocked(AuthApi.logout).mockResolvedValueOnce();

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
