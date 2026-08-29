/**
 * The signed-in user's own account — profile, referral standing, notifications.
 *
 *   GET   /api/customers/me            → { profile, referral }   (customer only)
 *   PATCH /api/customers/me            → update name / phone / gender
 *   GET   /api/notifications           → paginated, all roles
 *   PATCH /api/notifications           → mark read (all, or specific ids)
 *   GET   /api/notifications/unread-count
 *
 * `/api/customers/me` was added to the web for this app. The portal previously
 * read profile and referral data through server components, which a native
 * client can't reach. It also fixes a live web bug — the portal's profile form
 * was PATCHing a route that didn't exist.
 */

import { apiFetch } from '@/lib/api-client';

/* ── Profile ────────────────────────────────────────────────────────────── */

/** Mirrors the Prisma `CustomerStatus` enum — see admin.service for the full note. */
export type CustomerStatus =
  | 'REGISTERED' | 'OTP_CONFIRMED' | 'PCN_CERT_UPLOADED'
  | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface CustomerProfile {
  user_id:      number;
  uuid:         string;
  first_name:   string;
  last_name:    string;
  email:        string;
  phone:        string | null;
  gender:       string | null;
  avatar_url:   string | null;
  member_since: string;

  customer_id:         number;
  company_name:        string | null;
  address:             string | null;
  city:                string | null;
  state:               string | null;
  pcn_certificate_url: string | null;
  pcn_verified:        boolean;
  status:              CustomerStatus;

  total_orders:      number;
  total_paid_orders: number;
  total_spent:       number;
}

/**
 * Programme terms, read live from admin settings by the API.
 *
 * Every value is naira, matching the wallet — there is no separate point unit.
 */
export interface ReferralProgramme {
  /** Naira credited to the referrer the moment someone signs up with the code. */
  signup_bonus:    number;
  /** Paid spend a referred pharmacy must reach to trigger the second award. */
  spend_threshold: number;
  /** Naira credited to the referrer once that threshold is crossed. */
  spend_reward:    number;
  /**
   * Whether the business currently lets customers spend their balance.
   * Hide the "apply credit" affordance entirely while this is false — the
   * server refuses redemption regardless of what the client sends.
   */
  redemption_enabled: boolean;
  /** Balance required before any of it can be spent. */
  min_redemption:  number;
}

/** One movement of referral credit. */
export interface ReferralLedgerEntry {
  id:            number;
  /** Signed naira. Positive earned, negative spent. */
  delta:         number;
  balance_after: number;
  type:          'SIGNUP_BONUS' | 'SPEND_THRESHOLD' | 'REDEEMED' | 'ADJUSTMENT' | 'REVERSAL';
  description:   string;
  order_id:      number | null;
  created_at:    string;
}

/** A pharmacy this customer referred. */
export interface ReferredPharmacy {
  id:            number;
  name:          string;
  status:        CustomerStatus;
  joined_at:     string;
  /** Naira this referral has earned the referrer so far. */
  reward_earned: number;
}

export interface ReferralStanding {
  referral_code:   string | null;
  /** Naira balance. Not dimensionless points, despite the API's column name. */
  referral_points: number;
  referral_count:  number;
  /** Naira that can actually be applied to an order right now. */
  redeemable:      number;
  /** Who referred this customer. Null when nobody did. */
  referred_by:     { id: number; name: string; code: string | null } | null;
  /** Pharmacies this customer referred, newest first. */
  referrals:       ReferredPharmacy[];
  /** Credit history, newest first. */
  ledger:          ReferralLedgerEntry[];
  /** Null until the customer has a referral code. */
  programme:       ReferralProgramme | null;
}

export function getMyAccount() {
  return apiFetch<{ profile: CustomerProfile; referral: ReferralStanding }>(
    '/api/customers/me',
  );
}

export interface ProfileUpdate {
  first_name?: string;
  last_name?:  string;
  phone?:      string;
  gender?:     'MALE' | 'FEMALE' | 'OTHER';
}

export function updateMyProfile(patch: ProfileUpdate) {
  return apiFetch<{ profile: Pick<CustomerProfile,
    'user_id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'gender' | 'avatar_url'> }>(
    '/api/customers/me',
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

/* ── Notifications ──────────────────────────────────────────────────────── */

export interface AppNotification {
  id:         number;
  title:      string;
  body:       string;
  type:       string;
  /** In-app deep link path, e.g. "/portal/orders/12". May be null. */
  link:       string | null;
  is_read:    boolean;
  created_at: string;
}

export interface NotificationPage {
  records:      AppNotification[];
  pagination:   { current_page: number; per_page: number; total: number; total_pages: number };
  unread_count: number;
}

export function listNotifications(opts: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
  const p = new URLSearchParams();
  p.set('page',  String(opts.page  ?? 1));
  p.set('limit', String(opts.limit ?? 20));
  if (opts.unreadOnly) p.set('unread', 'true');
  return apiFetch<NotificationPage>(`/api/notifications?${p.toString()}`);
}

/** Omit `ids` to mark every unread notification as read. */
export function markNotificationsRead(ids?: number[]) {
  return apiFetch<{ marked_read: boolean }>('/api/notifications', {
    method: 'PATCH',
    body:   JSON.stringify(ids?.length ? { ids } : {}),
  });
}

export function getUnreadCount() {
  return apiFetch<{ unread_count: number }>('/api/notifications/unread-count');
}

/* ── App settings ───────────────────────────────────────────────────────── */

export interface AppSettings {
  /** Number the driver app dials from "Call dispatch" — the warehouse. */
  dispatch_phone: string;
  /** General line a customer calls for help. Distinct from dispatch. */
  support_phone:  string;
  /** Address shown for account-change requests. */
  support_email:  string;
  company_name:   string;
}

/**
 * The values that were hardcoded before these moved into Admin → Settings.
 *
 * Used when the request fails or hasn't landed yet, so a screen never renders
 * an empty phone number — a driver with no signal still needs something to
 * call.
 */
export const APP_SETTINGS_FALLBACK: AppSettings = {
  dispatch_phone: '+2348055136726',
  support_phone:  '+2348055136726',
  support_email:  'info@envolvepharm.com.ng',
  company_name:   'Envolve Pharmaceuticals',
};

/** Readable by any signed-in role — see GET /api/settings/app. */
export function getAppSettings() {
  return apiFetch<AppSettings>('/api/settings/app');
}
