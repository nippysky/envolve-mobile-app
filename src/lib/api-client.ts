/**
 * EnvolveCare Mobile API Client
 *
 * Features:
 * - Auto-attaches Authorization: Bearer + X-App-Client: mobile headers
 * - Auto-refreshes access token on 401 (single retry, no infinite loop)
 * - Throws ApiError with { status, message, errors } for consistent error handling
 * - Connection-pool safe: one fetch per call, no persistent connections
 */

import { API_BASE, MOBILE_HEADERS } from '@/constants/api';
import { TokenStorage }             from '@/lib/storage';

// ── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status:  number,
    message:                 string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Refresh token lock ───────────────────────────────────────────────────────
// Prevents multiple parallel requests from each triggering their own refresh.

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function waitForRefresh(): Promise<string | null> {
  return new Promise(resolve => refreshQueue.push(resolve));
}

function flushRefreshQueue(token: string | null) {
  refreshQueue.forEach(resolve => resolve(token));
  refreshQueue = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await TokenStorage.getRefresh();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method:  'POST',
      headers: {
        ...MOBILE_HEADERS,
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!res.ok) {
      await TokenStorage.clear();
      return null;
    }

    const json = await res.json() as {
      data: { tokens: { access_token: string; refresh_token: string } }
    };
    const { access_token, refresh_token } = json.data.tokens;
    await TokenStorage.saveTokens(access_token, refresh_token);
    return access_token;
  } catch {
    await TokenStorage.clear();
    return null;
  }
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** If true, don't retry on 401 (used for the refresh call itself) */
  skipRetry?: boolean;
}

export async function apiFetch<T = unknown>(
  path:    string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipRetry, headers: extraHeaders, ...rest } = options;

  const accessToken = await TokenStorage.getAccess();

  const authHeaders: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  const makeRequest = async (token: string | null) => {
    const tokenHeader: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    return fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        ...MOBILE_HEADERS,
        ...tokenHeader,
        ...extraHeaders,
      },
    });
  };

  let res = await makeRequest(accessToken);

  // ── Auto-refresh on 401 ───────────────────────────────────────────────────
  if (res.status === 401 && !skipRetry) {
    if (isRefreshing) {
      // Another request is already refreshing — wait for it
      const newToken = await waitForRefresh();
      res = await makeRequest(newToken);
    } else {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      flushRefreshQueue(newToken);

      if (newToken) {
        res = await makeRequest(newToken);
      } else {
        // Refresh failed — caller (AuthContext) will handle sign-out
        throw new ApiError(401, 'Session expired. Please sign in again.');
      }
    }
  }

  // ── Parse response ────────────────────────────────────────────────────────
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, `Network error (${res.status})`);
  }

  if (!res.ok) {
    const body = json as { message?: string; errors?: Record<string, string[]> };
    throw new ApiError(res.status, body.message ?? 'Something went wrong.', body.errors);
  }

  return (json as { data: T }).data ?? (json as T);
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export const api = {
  get<T>(path: string, opts?: RequestOptions) {
    return apiFetch<T>(path, { method: 'GET', ...opts });
  },
  post<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return apiFetch<T>(path, {
      method: 'POST',
      body:   body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    });
  },
  patch<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return apiFetch<T>(path, {
      method: 'PATCH',
      body:   body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    });
  },
  delete<T>(path: string, opts?: RequestOptions) {
    return apiFetch<T>(path, { method: 'DELETE', ...opts });
  },
};
