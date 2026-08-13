/**
 * EnvolveCare Plus — Design System
 *
 * Ported from the Envolve web app's @theme tokens so the two products read as
 * one brand, then extended with the things native needs and CSS doesn't have:
 * a real elevation model, a spacing rhythm, and a motion language.
 *
 * The rules that make this feel considered rather than assembled:
 *
 *   1. Spacing is a 4pt grid. Never hand-pick a number — use `space.*`.
 *   2. Elevation is a paired shadow + border, never a shadow alone. Flat
 *      shadows on light surfaces are what make an interface look cheap.
 *   3. Radii scale with the element. Small controls get small radii; sheets
 *      and cards get generous ones. Mixing them arbitrarily reads as sloppy.
 *   4. Motion uses one easing curve and three durations. Consistency of
 *      timing is more important than the timing itself.
 */

import { Platform } from 'react-native';

/* ═══════════════════════════════════════════════════════════════════════════
   PALETTE — mirrors web globals.css @theme exactly
   ═══════════════════════════════════════════════════════════════════════════ */

export const palette = {
  brand: {
    50:  '#e6f6fb',
    100: '#cdeff7',
    200: '#a4e0ee',
    300: '#6cd1ed',
    400: '#36bce0',
    500: '#00a6d4',   // primary
    600: '#0091ba',
    700: '#007a9c',
    800: '#00657f',
    900: '#064e62',
  },
  leaf: {
    50:  '#ecfdf5',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#16a34a',   // accent
    600: '#138838',
    700: '#0f6b2c',
    800: '#0c5523',
    900: '#0a4319',
  },
  ink: {
    DEFAULT: '#0b1417',
    2:       '#4a5560',
    3:       '#6b7780',
    4:       '#94a0ab',
    bg:      '#0c1418',   // dark console surface
    bgElev:  '#111c21',
  },
  surface: {
    DEFAULT: '#ffffff',
    bg:      '#fafaf9',
    subtle:  '#f7f7f5',
    muted:   '#f0f0ee',
  },
  line: {
    DEFAULT: '#e7e5e0',
    subtle:  '#efede8',
    strong:  '#d4d2cc',
  },
  status: {
    success:     '#16a34a',
    successSoft: '#dcfce7',
    warning:     '#d97706',
    warningSoft: '#fef3c7',
    danger:      '#dc2626',
    dangerSoft:  '#fee2e2',
    info:        '#0891b2',
    infoSoft:    '#cffafe',
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   SEMANTIC COLOURS — always reach for these in components, not `palette`
   ═══════════════════════════════════════════════════════════════════════════ */

export const color = {
  brand:        palette.brand[500],
  brandPressed: palette.brand[600],
  brandSoft:    palette.brand[50],
  brandBorder:  palette.brand[200],

  accent:       palette.leaf[500],
  accentSoft:   palette.leaf[100],

  text:         palette.ink.DEFAULT,
  textSecondary:palette.ink[2],
  textTertiary: palette.ink[3],
  textDisabled: palette.ink[4],
  textInverse:  '#ffffff',

  bg:           palette.surface.bg,
  surface:      palette.surface.DEFAULT,
  surfaceSubtle:palette.surface.subtle,
  surfaceMuted: palette.surface.muted,
  surfaceDark:  palette.ink.bg,
  surfaceDarkElev: palette.ink.bgElev,

  border:       palette.line.DEFAULT,
  borderSubtle: palette.line.subtle,
  borderStrong: palette.line.strong,

  success:      palette.status.success,
  successSoft:  palette.status.successSoft,
  warning:      palette.status.warning,
  warningSoft:  palette.status.warningSoft,
  danger:       palette.status.danger,
  dangerSoft:   palette.status.dangerSoft,
  info:         palette.status.info,
  infoSoft:     palette.status.infoSoft,

  /** Scrim behind modals and sheets. */
  scrim:        'rgba(11, 20, 23, 0.45)',
  /** Hairline that survives on both light and tinted surfaces. */
  hairline:     'rgba(11, 20, 23, 0.06)',
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   SPACING — 4pt grid. Never invent a value outside this scale.
   ═══════════════════════════════════════════════════════════════════════════ */

export const space = {
  none: 0,
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
  '5xl': 72,
} as const;

/** Horizontal page gutter — one value so every screen aligns to the same rail. */
export const gutter = space.lg;

/* ═══════════════════════════════════════════════════════════════════════════
   RADII — scale with element size
   ═══════════════════════════════════════════════════════════════════════════ */

export const radius = {
  xs:   6,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 26,
  '3xl': 32,
  full: 999,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   ELEVATION — shadow + border pairs.
   A shadow alone looks like a sticker; the hairline border is what grounds it.
   ═══════════════════════════════════════════════════════════════════════════ */

type Elevation = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

function makeElevation(y: number, blur: number, opacity: number, android: number): Elevation {
  return {
    shadowColor:   palette.ink.DEFAULT,
    shadowOffset:  { width: 0, height: y },
    shadowOpacity: opacity,
    shadowRadius:  blur,
    elevation:     android,
  };
}

export const elevation = {
  /** Flush with the page — used for inputs and inline chips. */
  none: makeElevation(0, 0, 0, 0),
  /** Cards at rest. Barely there; you feel it more than see it. */
  sm:   makeElevation(1, 3,  0.05, 1),
  /** Raised cards, list rows that can be tapped. */
  md:   makeElevation(4, 12, 0.07, 3),
  /** Floating elements — FAB, sticky bars. */
  lg:   makeElevation(8, 24, 0.10, 6),
  /** Sheets and modals. */
  xl:   makeElevation(16, 40, 0.16, 12),
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   MOTION — one curve, three durations.
   ═══════════════════════════════════════════════════════════════════════════ */

export const motion = {
  /** Matches the web's --ease-out-soft so transitions feel like one product. */
  easing: [0.22, 1, 0.36, 1] as const,

  duration: {
    /** Micro-feedback: press states, toggles. */
    fast:   140,
    /** Standard: fades, list items, sheet content. */
    base:   260,
    /** Deliberate: page transitions, sheet presentation. */
    slow:   400,
  },

  /**
   * Spring for press physics. Low mass and high damping gives a tight,
   * expensive-feeling response rather than a bouncy toy-like one.
   */
  spring: {
    damping:   18,
    stiffness: 260,
    mass:      0.7,
  },

  /** Scale a control drops to while held. Subtle — 0.97 not 0.9. */
  pressScale: 0.97,
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   TYPOGRAPHY — platform-native faces, tuned tracking
   ═══════════════════════════════════════════════════════════════════════════ */

const family = Platform.select({
  ios:     'System',
  android: 'Roboto',
  default: 'System',
});

/**
 * SF Pro tightens beautifully at display sizes; Roboto does not, so tracking
 * is applied on iOS only. Applying it on Android makes text look broken.
 */
const track = (ios: number) => (Platform.OS === 'ios' ? ios : 0);

export const text = {
  /** Onboarding and empty-state headlines. */
  display: {
    fontFamily: family, fontSize: 34, fontWeight: '700' as const,
    lineHeight: 40, letterSpacing: track(-0.9),
  },
  /** Screen titles. */
  title1: {
    fontFamily: family, fontSize: 28, fontWeight: '700' as const,
    lineHeight: 34, letterSpacing: track(-0.6),
  },
  title2: {
    fontFamily: family, fontSize: 22, fontWeight: '700' as const,
    lineHeight: 28, letterSpacing: track(-0.4),
  },
  title3: {
    fontFamily: family, fontSize: 18, fontWeight: '600' as const,
    lineHeight: 24, letterSpacing: track(-0.2),
  },
  headline: {
    fontFamily: family, fontSize: 16, fontWeight: '600' as const,
    lineHeight: 22, letterSpacing: track(-0.1),
  },
  body: {
    fontFamily: family, fontSize: 15, fontWeight: '400' as const,
    lineHeight: 22, letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: family, fontSize: 15, fontWeight: '500' as const,
    lineHeight: 22, letterSpacing: 0,
  },
  callout: {
    fontFamily: family, fontSize: 14, fontWeight: '400' as const,
    lineHeight: 20, letterSpacing: 0,
  },
  label: {
    fontFamily: family, fontSize: 13, fontWeight: '600' as const,
    lineHeight: 18, letterSpacing: 0.1,
  },
  caption: {
    fontFamily: family, fontSize: 12, fontWeight: '400' as const,
    lineHeight: 16, letterSpacing: 0,
  },
  /** All-caps section eyebrows. Tracking is essential at this size. */
  overline: {
    fontFamily: family, fontSize: 11, fontWeight: '700' as const,
    lineHeight: 14, letterSpacing: 0.9,
  },
  /** Tab bar labels. */
  tab: {
    fontFamily: family, fontSize: 10, fontWeight: '600' as const,
    lineHeight: 13, letterSpacing: 0.2,
  },
  /** Numerals — tabular so figures align in tables and totals. */
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13, fontWeight: '500' as const, lineHeight: 18,
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

export const layout = {
  /** Minimum tappable area — Apple HIG says 44pt, and it matters. */
  tapTarget: 44,
  headerHeight: 56,
  tabBarHeight: Platform.OS === 'ios' ? 84 : 64,
  /** Max content width, so the layout doesn't sprawl on tablets. */
  maxContentWidth: 640,
  hairlineWidth: StyleSheetHairline(),
} as const;

function StyleSheetHairline(): number {
  // Kept as a function so the import stays lightweight at module scope.
  return Platform.OS === 'ios' ? 0.5 : 1;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS PILL STYLES — shared by orders, payments and deliveries
   ═══════════════════════════════════════════════════════════════════════════ */

type Pill = { bg: string; fg: string; dot: string };

export const orderStatus: Record<string, Pill> = {
  pending:    { bg: '#fef3c7', fg: '#92400e', dot: '#f59e0b' },
  confirmed:  { bg: '#e6f6fb', fg: '#006a8a', dot: '#00a6d4' },
  processing: { bg: '#cdeff7', fg: '#005f7a', dot: '#0091ba' },
  dispatched: { bg: '#dcfce7', fg: '#14532d', dot: '#16a34a' },
  delivered:  { bg: '#dcfce7', fg: '#14532d', dot: '#16a34a' },
  cancelled:  { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
};

export const paymentStatus: Record<string, Pill> = {
  unpaid:   { bg: '#fff7ed', fg: '#9a3412', dot: '#fb923c' },
  partial:  { bg: '#fef3c7', fg: '#713f12', dot: '#eab308' },
  paid:     { bg: '#dcfce7', fg: '#14532d', dot: '#16a34a' },
  refunded: { bg: '#faf5ff', fg: '#581c87', dot: '#a855f7' },
  failed:   { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
};

export const deliveryStatus: Record<string, Pill> = {
  awaiting_dispatch: { bg: '#f0f0ee', fg: '#4a5560', dot: '#94a0ab' },
  assigned:          { bg: '#e6f6fb', fg: '#006a8a', dot: '#00a6d4' },
  in_transit:        { bg: '#cdeff7', fg: '#005f7a', dot: '#0091ba' },
  out_for_delivery:  { bg: '#dcfce7', fg: '#14532d', dot: '#16a34a' },
  delivered:         { bg: '#dcfce7', fg: '#14532d', dot: '#16a34a' },
  failed:            { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
  returned:          { bg: '#fff7ed', fg: '#9a3412', dot: '#fb923c' },
};

/** Single export for convenience — `import { theme } from '@/constants/theme'`. */
export const theme = {
  palette, color, space, gutter, radius, elevation, motion, text, layout,
  orderStatus, paymentStatus, deliveryStatus,
} as const;

export type Theme = typeof theme;
