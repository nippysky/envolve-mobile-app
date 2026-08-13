/**
 * Auth service.
 *
 * Thin, typed wrappers over the existing Next.js API. No mobile-specific
 * endpoints exist and none should be added — the web routes already return a
 * JSON body alongside their cookies precisely so native clients can consume
 * them, and `getSession` on the server accepts `Authorization: Bearer`.
 *
 * Contracts below were read from the route handlers, not assumed:
 *
 *   POST /api/auth/customer/register        multipart  → { email }
 *   POST /api/auth/customer/verify-otp      json       → { token, email }
 *   POST /api/auth/customer/resend-otp      json       → { email }
 *   POST /api/auth/customer/create-password json       → { email }
 *   POST /api/auth/customer/login           json       → { user, tokens }
 *   POST /api/auth/staff/login              json       → { user, tokens }
 *   POST /api/auth/customer/forgot-password json       → { email }
 *   POST /api/auth/customer/reset-password  json       → { email }
 *   POST /api/auth/staff/forgot-password    json       → { email }
 *   POST /api/auth/staff/reset-password     json       → { email }
 */

import { apiFetch } from '@/lib/api-client';
import type { AppUser } from '@/contexts/AuthContext';
import { API_BASE, MOBILE_HEADERS } from '@/constants/api';

/* ── Shapes ──────────────────────────────────────────────────────────────── */

export interface AuthTokens {
  access_token:  string;
  refresh_token: string;
}

/**
 * Re-exported from AuthContext so there is one user shape in the app rather
 * than two that drift apart.
 */
export type AuthUser = AppUser & {
  status?: string;
  phone?:  string | null;
};

export interface AuthResponse {
  user:   AuthUser;
  tokens: AuthTokens;
}

/** Fields the register endpoint reads off the multipart body. */
export interface RegisterCustomerInput {
  first_name:     string;
  last_name:      string;
  middle_name?:   string;
  email:          string;
  phone:          string;
  company_name:   string;
  address:        string;
  city:           string;
  state:          string;
  gender?:        string;
  referral_code?: string;
  /** PCN certificate. Sent as `file` — the canonical name across every
   *  multipart route in the API. `pcn_certificate` is accepted as an alias. */
  certificate: { uri: string; name: string; type: string };
}

/* ── Registration chain ──────────────────────────────────────────────────── */

/**
 * Step 1 — create the account and trigger the OTP email.
 *
 * Sent as multipart because the certificate is a real upload. React Native's
 * FormData takes `{ uri, name, type }` for files rather than a Blob, so this
 * can't go through apiFetch's JSON path.
 */
export async function registerCustomer(input: RegisterCustomerInput): Promise<{ email: string }> {
  const fd = new FormData();

  fd.append('first_name',   input.first_name);
  fd.append('last_name',    input.last_name);
  fd.append('email',        input.email.toLowerCase());
  fd.append('phone',        input.phone);
  fd.append('company_name', input.company_name);
  fd.append('address',      input.address);
  fd.append('city',         input.city);
  fd.append('state',        input.state);

  if (input.middle_name)   fd.append('middle_name',   input.middle_name);
  if (input.gender)        fd.append('gender',        input.gender);
  if (input.referral_code) fd.append('referral_code', input.referral_code);

  // `file` matches every other multipart endpoint in the API.
  fd.append('file', {
    uri:  input.certificate.uri,
    name: input.certificate.name,
    type: input.certificate.type,
  } as unknown as Blob);

  const res = await fetch(`${API_BASE}/api/auth/customer/register`, {
    method:  'POST',
    // Content-Type is deliberately omitted so the runtime sets the multipart
    // boundary. Setting it by hand produces a body the server can't parse.
    headers: { ...MOBILE_HEADERS },
    body:    fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message ?? 'Registration failed.') as Error & {
      status?: number; errors?: Record<string, string[]>;
    };
    err.status = res.status;
    err.errors = json?.errors;
    throw err;
  }
  return json.data as { email: string };
}

/** Step 2 — exchange the emailed code for the setup token. */
export function verifyOtp(email: string, otp_code: string) {
  return apiFetch<{ token: string; email: string }>('/api/auth/customer/verify-otp', {
    method: 'POST',
    body:   JSON.stringify({ email: email.toLowerCase(), otp_code }),
  });
}

export function resendOtp(email: string) {
  return apiFetch<{ email: string }>('/api/auth/customer/resend-otp', {
    method: 'POST',
    body:   JSON.stringify({ email: email.toLowerCase() }),
  });
}

/**
 * Step 3 — set the password using the token from verifyOtp.
 * The account lands in PENDING_REVIEW; the customer cannot sign in until an
 * admin approves them, which the UI must communicate.
 */
export function createPassword(password: string, token: string) {
  return apiFetch<{ email: string; already_completed?: boolean }>(
    '/api/auth/customer/create-password',
    { method: 'POST', body: JSON.stringify({ password, token }) },
  );
}

/* ── Sign in ─────────────────────────────────────────────────────────────── */

export function loginCustomer(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/customer/login', {
    method: 'POST',
    body:   JSON.stringify({ email: email.toLowerCase().trim(), password }),
  });
}

export function loginStaff(email: string, password: string) {
  return apiFetch<AuthResponse>('/api/auth/staff/login', {
    method: 'POST',
    body:   JSON.stringify({ email: email.toLowerCase().trim(), password }),
  });
}

/* ── Password recovery ───────────────────────────────────────────────────── */

export type Audience = 'customer' | 'staff';

/** Always resolves — the API returns 200 regardless, to avoid leaking whether an account exists. */
export function forgotPassword(audience: Audience, email: string) {
  return apiFetch<{ email: string }>(`/api/auth/${audience}/forgot-password`, {
    method: 'POST',
    body:   JSON.stringify({ email: email.toLowerCase().trim() }),
  });
}

export function resetPassword(
  audience: Audience,
  email: string,
  otp_code: string,
  new_password: string,
) {
  return apiFetch<{ email: string }>(`/api/auth/${audience}/reset-password`, {
    method: 'POST',
    body:   JSON.stringify({ email: email.toLowerCase().trim(), otp_code, new_password }),
  });
}

/* ── Session ─────────────────────────────────────────────────────────────── */

export function getMe() {
  return apiFetch<AuthUser>('/api/auth/me');
}

export function logout(refreshToken?: string) {
  return apiFetch<unknown>('/api/auth/logout', {
    method: 'POST',
    body:   JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
  });
}
