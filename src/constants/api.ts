/**
 * API configuration for the mobile app.
 *
 * `EXPO_PUBLIC_API_URL` comes from one of two places, never both:
 *
 *   • Local dev — `.env.local`, which is gitignored.
 *   • EAS builds — the `env` block of the matching profile in `eas.json`.
 *     EAS build servers do a clean checkout and never see `.env.local`, so a
 *     profile without an `env` block silently falls through to the default
 *     below. That is how a build ends up pointing at the wrong backend while
 *     appearing to work.
 *
 * `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time, so this
 * is not read at runtime. Changing the backend URL needs either a new build or
 * an `eas update` to the relevant channel — see README.
 *
 * The fallback is deliberate: a released app that lost its config should still
 * reach production rather than crash on launch.
 */

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://envolve-pharma.vercel.app';

/** Sent on every mobile request so the API can return JSON errors (not HTML redirects) */
export const MOBILE_HEADERS = {
  'X-App-Client': 'mobile',
  'Content-Type': 'application/json',
} as const;
