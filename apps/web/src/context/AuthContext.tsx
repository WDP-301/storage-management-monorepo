import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthApi, setUnauthorizedCallback } from '../lib/api';
import { AuthContextType, AuthUser, LoginInput, RegisterInput } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and check current session on app startup
  const checkAuth = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const currentUser = await AuthApi.me();
      setUser(currentUser);
      return currentUser;
    } catch {
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
    });

    checkAuth();

    return () => {
      setUnauthorizedCallback(null);
    };
  }, [checkAuth]);

  const login = async (credentials: LoginInput): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const loggedInUser = await AuthApi.login(credentials);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      const isConnectionError =
        errorMsg.includes('kết nối') ||
        errorMsg.includes('Network Error') ||
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('ECONNREFUSED');

      if (isConnectionError) {
        throw new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterInput): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const registeredUser = await AuthApi.register(data);
      setUser(registeredUser);
      return registeredUser;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '';
      const isConnectionError =
        errorMsg.includes('kết nối') ||
        errorMsg.includes('Network Error') ||
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('ECONNREFUSED');

      if (isConnectionError) {
        throw new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
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
