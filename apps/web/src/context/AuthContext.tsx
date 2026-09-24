import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthApi, setUnauthorizedCallback } from '../lib/api';
import { AuthContextType, AuthUser, LoginInput, RegisterInput } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_USERS_KEY = 'storage_registered_users';
const STORAGE_SESSION_KEY = 'storage_active_session_user';

interface StoredUserAccount extends AuthUser {
  passwordHash: string;
}

// Seed default fallback account if not present
const initializeFallbackStorage = () => {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(STORAGE_USERS_KEY)) {
    const defaultAccounts: StoredUserAccount[] = [
      {
        id: 'usr_default_01',
        email: 'customer@example.com',
        phone: '0912345678',
        fullName: 'Nguyễn Văn A',
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: 'secret123',
      },
    ];
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(defaultAccounts));
  }
};

initializeFallbackStorage();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and check current session on app startup
  const checkAuth = useCallback(async (): Promise<AuthUser | null> => {
    try {
      // 1. Try real backend session first
      const currentUser = await AuthApi.me();
      setUser(currentUser);
      localStorage.removeItem(STORAGE_SESSION_KEY);
      return currentUser;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      const isConnectionError =
        errorMsg.includes('kết nối') ||
        errorMsg.includes('Network Error') ||
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('ECONNREFUSED');

      // 2. Only check offline local session fallback if backend is genuinly offline
      if (isConnectionError) {
        const savedSession = localStorage.getItem(STORAGE_SESSION_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession) as AuthUser;
            setUser(parsed);
            return parsed;
          } catch {
            localStorage.removeItem(STORAGE_SESSION_KEY);
          }
        }
      } else {
        // Backend is online but session is invalid (401) -> clean up offline session
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }

      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Set interceptor callback when backend session expires (401)
    setUnauthorizedCallback(() => {
      setUser(null);
      localStorage.removeItem(STORAGE_SESSION_KEY);
    });

    checkAuth();

    return () => {
      setUnauthorizedCallback(null);
    };
  }, [checkAuth]);

  const login = async (credentials: LoginInput): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      // Attempt real backend authentication first
      const loggedInUser = await AuthApi.login(credentials);
      setUser(loggedInUser);
      localStorage.removeItem(STORAGE_SESSION_KEY);
      return loggedInUser;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      const isConnectionError =
        errorMsg.includes('kết nối') ||
        errorMsg.includes('Network Error') ||
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('ECONNREFUSED');

      // If backend is offline, verify against registered local storage accounts
      if (isConnectionError) {
        const email = credentials.email.trim().toLowerCase();
        const raw = localStorage.getItem(STORAGE_USERS_KEY);
        const users: StoredUserAccount[] = raw ? JSON.parse(raw) : [];

        const found = users.find((u) => u.email.toLowerCase() === email);
        if (!found) {
          throw new Error('Tài khoản chưa tồn tại. Vui lòng chuyển sang tab Đăng ký tài khoản.');
        }

        if (found.passwordHash !== credentials.password) {
          throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
        }

        const cleanUser: AuthUser = {
          id: found.id,
          email: found.email,
          phone: found.phone,
          fullName: found.fullName,
          status: found.status,
          roles: found.roles,
          createdAt: found.createdAt,
          updatedAt: found.updatedAt,
        };

        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(cleanUser));
        setUser(cleanUser);
        return cleanUser;
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterInput): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      // Attempt real backend registration first
      const registeredUser = await AuthApi.register(data);
      setUser(registeredUser);
      localStorage.removeItem(STORAGE_SESSION_KEY);
      return registeredUser;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      const isConnectionError =
        errorMsg.includes('kết nối') ||
        errorMsg.includes('Network Error') ||
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('ECONNREFUSED');

      // If backend is offline, save to local registered accounts
      if (isConnectionError) {
        const email = data.email.trim().toLowerCase();
        const raw = localStorage.getItem(STORAGE_USERS_KEY);
        const users: StoredUserAccount[] = raw ? JSON.parse(raw) : [];

        if (users.some((u) => u.email.toLowerCase() === email)) {
          throw new Error('Email này đã được đăng ký. Vui lòng chuyển sang tab Đăng nhập.');
        }

        const newUser: StoredUserAccount = {
          id: `usr_${Date.now()}`,
          email,
          phone: data.phone.trim(),
          fullName: data.fullName.trim(),
          status: 'ACTIVE',
          roles: ['CUSTOMER'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          passwordHash: data.password,
        };

        users.push(newUser);
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

        const cleanUser: AuthUser = {
          id: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
          fullName: newUser.fullName,
          status: newUser.status,
          roles: newUser.roles,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt,
        };

        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(cleanUser));
        setUser(cleanUser);
        return cleanUser;
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AuthApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<AuthUser | null> => {
    try {
      const updated = await AuthApi.me();
      setUser(updated);
      return updated;
    } catch {
      const saved = localStorage.getItem(STORAGE_SESSION_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as AuthUser;
          setUser(parsed);
          return parsed;
        } catch {
          // ignore
        }
      }
      setUser(null);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
