import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../src/types/auth';
import { AuthApi } from './api';

type SessionContextValue = {
  user: AuthUser | null;
  isCheckingSession: boolean;
  isLoggingOut: boolean;
  authenticate: (user: AuthUser) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    AuthApi.setUnauthorizedHandler(() => setUser(null));

    return () => AuthApi.setUnauthorizedHandler();
  }, []);

  useEffect(() => {
    AuthApi.me()
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setIsCheckingSession(false));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      isCheckingSession,
      isLoggingOut,
      authenticate: setUser,
      logout: async () => {
        setIsLoggingOut(true);
        try {
          await AuthApi.logout();
        } catch {
          // Clear local state even when the API is temporarily unreachable.
        } finally {
          setUser(null);
          setIsLoggingOut(false);
        }
      },
    }),
    [isCheckingSession, isLoggingOut, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider.');
  return context;
}
