/**
 * AuthContext — global auth state for all roles.
 *
 * Provides: user, role, isLoading, login, logout
 * On mount: restores session from SecureStore if tokens exist.
 * On 401 from api-client: signOut is called via the exported signOutFn reference.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { router }        from 'expo-router';
import { TokenStorage }  from '@/lib/storage';
import { api, ApiError } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER' | 'SUPER_ADMIN';

export interface AppUser {
  id:         number;
  first_name: string;
  last_name:  string;
  email:      string;
  role:       UserRole;
  avatar_url: string | null;
}

interface AuthContextValue {
  user:      AppUser | null;
  isLoading: boolean;
  login:     (user: AppUser, access: string, refresh: string) => Promise<void>;
  logout:    () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<AppUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await TokenStorage.getUser<AppUser>();
        const token = await TokenStorage.getAccess();
        if (saved && token) {
          // Quick verify — if the token is stale, api-client will refresh it
          setUser(saved);
        }
      } catch {
        // Corrupted store — wipe it
        await TokenStorage.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (
    appUser: AppUser,
    access:  string,
    refresh: string,
  ) => {
    await TokenStorage.saveTokens(access, refresh);
    await TokenStorage.saveUser(appUser);
    setUser(appUser);

    // Navigate to the correct role stack
    const home: Record<UserRole, string> = {
      CUSTOMER:    '/(customer)/catalog',
      ADMIN:       '/(staff)/overview',
      STAFF:       '/(staff)/overview',
      SUPER_ADMIN: '/(staff)/overview',
      DRIVER:      '/(driver)/deliveries',
    };
    router.replace(home[appUser.role] as any);
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      // Best-effort server-side revocation
      await api.post('/api/auth/logout').catch(() => {});
    } finally {
      await TokenStorage.clear();
      setUser(null);
      router.replace('/(auth)/sign-in');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
