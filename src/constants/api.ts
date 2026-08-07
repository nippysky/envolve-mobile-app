/**
 * API configuration for the mobile app.
 * EXPO_PUBLIC_API_URL must be set in .env — defaults to production.
 */

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://www.envolvepharm.com.ng';

/** Sent on every mobile request so the API can return JSON errors (not HTML redirects) */
export const MOBILE_HEADERS = {
  'X-App-Client': 'mobile',
  'Content-Type': 'application/json',
} as const;
