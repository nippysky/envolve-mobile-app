/**
 * EnvolveCare Plus — Brand Design System
 * Mirrors the web app's Tailwind palette exactly.
 */

export const Colors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  brand:     '#4f46e5',   // indigo — primary CTA, links, active states
  brandDark: '#3730a3',
  brandLight:'#eef2ff',

  teal:      '#0d9488',   // secondary — customer actions, success CTAs
  tealLight: '#f0fdfa',

  cyan:      '#06b6d4',   // accent gradient end
  cyanLight: '#ecfeff',

  // ── Ink / Text ─────────────────────────────────────────────────────────────
  ink:   '#0f172a',   // headings, body
  ink2:  '#334155',   // secondary body
  ink3:  '#64748b',   // labels, captions
  ink4:  '#94a3b8',   // placeholders, disabled

  // ── Backgrounds ────────────────────────────────────────────────────────────
  bg:      '#f1f5f9',   // page background
  bgSubtle:'#f8fafc',
  bgMuted: '#e2e8f0',

  // ── Surface ────────────────────────────────────────────────────────────────
  white: '#ffffff',
  line:  '#e2e8f0',   // borders, dividers

  // ── Semantic ───────────────────────────────────────────────────────────────
  success:      '#16a34a',
  successLight: '#f0fdf4',
  successBorder:'#bbf7d0',

  warning:      '#d97706',
  warningLight: '#fffbeb',
  warningBorder:'#fde68a',

  danger:       '#dc2626',
  dangerLight:  '#fff1f2',
  dangerBorder: '#fecdd3',

  info:         '#0284c7',
  infoLight:    '#f0f9ff',
  infoBorder:   '#bae6fd',

  // ── Header background ───────────────────────────────────────────────────────
  headerBg: '#0f172a',

  // ── Order status pills ──────────────────────────────────────────────────────
  orderStatus: {
    pending:    { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b'  },
    confirmed:  { bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6'  },
    processing: { bg: '#eef2ff', text: '#3730a3', dot: '#6366f1'  },
    dispatched: { bg: '#f0fdfa', text: '#115e59', dot: '#14b8a6'  },
    delivered:  { bg: '#f0fdf4', text: '#166534', dot: '#22c55e'  },
    cancelled:  { bg: '#fff1f2', text: '#9f1239', dot: '#f43f5e'  },
  } as Record<string, { bg: string; text: string; dot: string }>,

  // ── Payment status pills ────────────────────────────────────────────────────
  paymentStatus: {
    unpaid:   { bg: '#fff7ed', text: '#9a3412', dot: '#fb923c' },
    partial:  { bg: '#fefce8', text: '#713f12', dot: '#eab308' },
    paid:     { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
    refunded: { bg: '#faf5ff', text: '#581c87', dot: '#a855f7' },
    failed:   { bg: '#fff1f2', text: '#9f1239', dot: '#f43f5e' },
  } as Record<string, { bg: string; text: string; dot: string }>,

  // ── Delivery status pills ───────────────────────────────────────────────────
  deliveryStatus: {
    awaiting_dispatch: { bg: '#f8fafc', text: '#475569', dot: '#94a3b8' },
    assigned:          { bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
    in_transit:        { bg: '#eef2ff', text: '#3730a3', dot: '#6366f1' },
    out_for_delivery:  { bg: '#f0fdfa', text: '#115e59', dot: '#14b8a6' },
    delivered:         { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
    failed:            { bg: '#fff1f2', text: '#9f1239', dot: '#f43f5e' },
    returned:          { bg: '#fff7ed', text: '#9a3412', dot: '#fb923c' },
  } as Record<string, { bg: string; text: string; dot: string }>,
} as const;
