/**
 * Badge — status pills.
 *
 * Takes its colours from the shared status maps so an order badge in the
 * customer app and the same badge in the console are byte-identical.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import {
  color, radius, space,
  orderStatus, paymentStatus, deliveryStatus,
} from '@/constants/theme';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<Tone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: color.surfaceMuted, fg: color.textSecondary, dot: color.textTertiary },
  brand:   { bg: color.brandSoft,    fg: '#006a8a',           dot: color.brand },
  success: { bg: color.successSoft,  fg: '#14532d',           dot: color.success },
  warning: { bg: color.warningSoft,  fg: '#92400e',           dot: color.warning },
  danger:  { bg: color.dangerSoft,   fg: '#991b1b',           dot: color.danger },
  info:    { bg: color.infoSoft,     fg: '#155e75',           dot: color.info },
};

export interface BadgeProps {
  children:  React.ReactNode;
  tone?:     Tone;
  /** Resolve colours from a domain status instead of a tone. */
  status?:   { kind: 'order' | 'payment' | 'delivery'; value: string };
  dot?:      boolean;
  size?:     'sm' | 'md';
  style?:    StyleProp<ViewStyle>;
}

export function Badge({ children, tone = 'neutral', status, dot = true, size = 'md', style }: BadgeProps) {
  let c = TONE[tone];

  if (status) {
    const map =
      status.kind === 'order'    ? orderStatus
      : status.kind === 'payment' ? paymentStatus
      : deliveryStatus;
    const hit = map[status.value?.toLowerCase()];
    if (hit) c = { bg: hit.bg, fg: hit.fg, dot: hit.dot };
  }

  const small = size === 'sm';

  return (
    <View
      style={[
        {
          flexDirection:   'row',
          alignItems:      'center',
          alignSelf:       'flex-start',
          gap:             small ? 4 : space.xs + 2,
          paddingVertical: small ? 3 : 5,
          paddingHorizontal: small ? space.sm : space.md - 2,
          borderRadius:    radius.full,
          backgroundColor: c.bg,
        },
        style,
      ]}
    >
      {dot ? (
        <View style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: radius.full, backgroundColor: c.dot }} />
      ) : null}
      <Text variant={small ? 'caption' : 'label'} style={{ color: c.fg, fontWeight: '600' }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * StatusBadge — resolves a domain status to its pill and humanises the label.
 * Saves every call site repeating the same replace/capitalise dance.
 */
export function StatusBadge({
  status,
  kind,
  type,
  size = 'md',
}: {
  status: string;
  kind?:  'order' | 'payment' | 'delivery';
  /** Alias for `kind`, kept for call sites written before the rename. */
  type?:  'order' | 'payment' | 'delivery';
  size?:  'sm' | 'md';
}) {
  const resolved = kind ?? type ?? 'order';
  const label = String(status ?? '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());

  return (
    <Badge status={{ kind: resolved, value: status }} size={size}>
      {label || '—'}
    </Badge>
  );
}
