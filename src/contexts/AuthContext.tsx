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
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { router }                    from 'expo-router';
import { TokenStorage }              from '@/lib/storage';
import { setSessionExpiredHandler, refreshSession } from '@/lib/api-client';
// api-client used by screens; not needed directly in AuthContext (logout uses raw fetch)
import { API_BASE, MOBILE_HEADERS }  from '@/constants/api';

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
  /**
   * Preferred entry point — takes the `{ access_token, refresh_token }` pair
   * exactly as the API returns it, so call sites don't have to destructure.
   * Routing to the correct role stack is handled here, not by the screen.
   */
  signIn:    (user: AppUser, tokens: { access_token: string; refresh_token: string }) => Promise<void>;
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

  /**
   * Drop the session locally and return to sign-in.
   *
   * Separate from `logout` because there's nothing to revoke — the refresh
   * token is already dead, so calling the logout endpoint would just fail.
   */
  const endSession = useCallback(async () => {
    await TokenStorage.clear();
    setUser(null);
    router.replace('/(auth)/sign-in' as never);
  }, []);

  /**
   * Let the API client end the session when a refresh fails.
   *
   * Without this the client cleared SecureStore but `user` stayed in state, so
   * the app kept rendering the signed-in stack with no credentials — every
   * screen erroring and no way out but force-quitting.
   */
  useEffect(() => {
    setSessionExpiredHandler(() => { void endSession(); });
    return () => setSessionExpiredHandler(null);
  }, [endSession]);

  /**
   * Refresh when the app returns to the foreground.
   *
   * Access tokens last 15 minutes and a phone spends most of its life
   * backgrounded, so without this the first action after every resume pays for
   * a wasted 401 before the reactive refresh kicks in. This mirrors what the
   * web does on `visibilitychange`.
   *
   * Gated on there being a user: an unauthenticated app has nothing to refresh,
   * and firing this on the sign-in screen would be noise.
   */
  useEffect(() => {
    if (!user) return;

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void refreshSession();
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [user]);

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

  const signIn = useCallback(
    (appUser: AppUser, tokens: { access_token: string; refresh_token: string }) =>
      login(appUser, tokens.access_token, tokens.refresh_token),
    [login],
  );

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      // Send the refresh token so the backend can revoke the jti from DB.
      // The logout endpoint accepts it via Authorization: Bearer header.
      const refreshToken = await TokenStorage.getRefresh();
      await fetch(`${API_BASE}/api/auth/logout`, {
        method:  'POST',
        headers: {
          ...MOBILE_HEADERS,
          ...(refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {}),
        },
      }).catch(() => {
        // Best-effort — never block logout on a network failure
      });
    } finally {
      await TokenStorage.clear();
      setUser(null);
      router.replace('/(auth)/sign-in');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
