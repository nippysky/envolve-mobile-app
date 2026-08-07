/**
 * EnvolveCare Plus — Brand Design System
 * Exact tokens from the EnvolveCare Express web app (globals.css @theme).
 * Brand primary: #00a6d4 (brand-500)
 */

export const Colors = {
  // ── Brand (cyan — matches web brand-500) ─────────────────────────────────
  brand:     '#00a6d4',   // brand-500 — primary CTA, links, active tabs
  brandDark: '#0091ba',   // brand-600 — pressed / hover states
  brandLight:'#e6f6fb',   // brand-50  — tinted backgrounds

  // ── Secondary (leaf green) ────────────────────────────────────────────────
  teal:      '#16a34a',   // leaf-500 — success, confirmed actions
  tealLight: '#dcfce7',   // leaf-100

  // ── Accent (kept for backwards compat) ────────────────────────────────────
  cyan:      '#00a6d4',
  cyanLight: '#e6f6fb',

  // ── Ink / Text (from web --color-ink-*) ───────────────────────────────────
  ink:   '#0b1417',   // ink     — headings, primary body
  ink2:  '#4a5560',   // ink-2   — secondary body
  ink3:  '#6b7780',   // ink-3   — labels, captions
  ink4:  '#94a0ab',   // ink-4   — placeholders, disabled

  // ── Backgrounds (from web --color-bg-*) ───────────────────────────────────
  bg:      '#fafaf9',   // bg        — page background
  bgSubtle:'#f7f7f5',   // bg-subtle
  bgMuted: '#f0f0ee',   // bg-muted

  // ── Surface ────────────────────────────────────────────────────────────────
  white: '#ffffff',
  line:  '#e7e5e0',   // border / divider (web --color-line)

  // ── Dark surface (portal / admin sidebar) ─────────────────────────────────
  inkBg:     '#0c1418',   // ink-bg      — dark card backgrounds
  inkBgElev: '#111c21',   // ink-bg-elev — elevated dark surfaces

  // ── Semantic ───────────────────────────────────────────────────────────────
  success:      '#16a34a',
  successLight: '#dcfce7',
  successBorder:'#bbf7d0',

  warning:      '#d97706',
  warningLight: '#fef3c7',
  warningBorder:'#fde68a',

  danger:       '#dc2626',
  dangerLight:  '#fee2e2',
  dangerBorder: '#fecdd3',

  info:         '#0891b2',
  infoLight:    '#cffafe',
  infoBorder:   '#a5f3fc',

  // ── Header background ─────────────────────────────────────────────────────
  headerBg: '#0c1418',   // matches web admin sidebar dark bg

  // ── Order status pills ────────────────────────────────────────────────────
  orderStatus: {
    pending:    { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    confirmed:  { bg: '#e6f6fb', text: '#006a8a', dot: '#00a6d4' },
    processing: { bg: '#cdeff7', text: '#005f7a', dot: '#0091ba' },
    dispatched: { bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
    delivered:  { bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
    cancelled:  { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626' },
  } as Record<string, { bg: string; text: string; dot: string }>,

  // ── Payment status pills ──────────────────────────────────────────────────
  paymentStatus: {
    unpaid:   { bg: '#fff7ed', text: '#9a3412', dot: '#fb923c' },
    partial:  { bg: '#fef3c7', text: '#713f12', dot: '#eab308' },
    paid:     { bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
    refunded: { bg: '#faf5ff', text: '#581c87', dot: '#a855f7' },
    failed:   { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626' },
  } as Record<string, { bg: string; text: string; dot: string }>,

  // ── Delivery status pills ─────────────────────────────────────────────────
  deliveryStatus: {
    awaiting_dispatch: { bg: '#f0f0ee', text: '#4a5560', dot: '#94a0ab' },
    assigned:          { bg: '#e6f6fb', text: '#006a8a', dot: '#00a6d4' },
    in_transit:        { bg: '#cdeff7', text: '#005f7a', dot: '#0091ba' },
    out_for_delivery:  { bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
    delivered:         { bg: '#dcfce7', text: '#14532d', dot: '#16a34a' },
    failed:            { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626' },
    returned:          { bg: '#fff7ed', text: '#9a3412', dot: '#fb923c' },
  } as Record<string, { bg: string; text: string; dot: string }>,
} as const;
