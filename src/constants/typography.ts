/**
 * EnvolveCare Plus — Typography System
 *
 * Uses platform system fonts:
 *  iOS:     SF Pro Display / SF Pro Text  (Apple's premium typeface)
 *  Android: Roboto (Material Design reference font)
 *
 * No external fonts needed — native vectors look better than web embeds.
 */
import { Platform } from 'react-native';

/** Platform-native font family */
export const font = Platform.select({
  ios:     { fontFamily: 'System' },
  android: { fontFamily: 'Roboto' },
  default: {},
}) as { fontFamily?: string };

/** Letter spacing helper — tighter on iOS (SF Pro tracks beautifully at -0.3) */
const ls = Platform.OS === 'ios' ? -0.3 : 0;

/** Reusable text style presets — combine with color overrides as needed */
export const type = {
  // ── Display ─────────────────────────────────────────────────────────────
  hero: {
    ...font, fontSize: 34, fontWeight: '800' as const,
    letterSpacing: Platform.OS === 'ios' ? -0.8 : 0,
    lineHeight: 40,
  },
  title: {
    ...font, fontSize: 28, fontWeight: '800' as const,
    letterSpacing: Platform.OS === 'ios' ? -0.6 : 0,
    lineHeight: 34,
  },

  // ── Headings ─────────────────────────────────────────────────────────────
  h1: { ...font, fontSize: 22, fontWeight: '800' as const, letterSpacing: ls, lineHeight: 28 },
  h2: { ...font, fontSize: 18, fontWeight: '700' as const, letterSpacing: ls, lineHeight: 24 },
  h3: { ...font, fontSize: 16, fontWeight: '700' as const, letterSpacing: ls, lineHeight: 22 },
  h4: { ...font, fontSize: 15, fontWeight: '600' as const, letterSpacing: ls, lineHeight: 20 },

  // ── Body ─────────────────────────────────────────────────────────────────
  bodyLg:  { ...font, fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body:    { ...font, fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySm:  { ...font, fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMed: { ...font, fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },

  // ── Labels / Captions ─────────────────────────────────────────────────────
  label:   { ...font, fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.1 },
  caption: { ...font, fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },
  overline:{ ...font, fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8 },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tab: { ...font, fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.2 },

  // ── Buttons ───────────────────────────────────────────────────────────────
  btnLg:   { ...font, fontSize: 16, fontWeight: '700' as const, letterSpacing: 0.1 },
  btn:     { ...font, fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.1 },
  btnSm:   { ...font, fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.1 },
} as const;
