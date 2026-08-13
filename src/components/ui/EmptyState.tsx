/**
 * Empty state.
 *
 * The glyph sits in a soft tinted disc rather than floating grey on white —
 * a lone outline icon at low contrast reads as a rendering failure, while the
 * same icon on a plinth reads as intentional.
 *
 * Copy convention: `title` says what isn't there, `subtitle` says what to do
 * about it. "No orders yet" / "Your first order will appear here once you
 * check out." — never "No data found."
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Text } from './Text';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { color, space, radius, gutter } from '@/constants/theme';

export interface EmptyStateProps {
  iconName?:    IconName;
  title:        string;
  subtitle?:    string;
  actionLabel?: string;
  onAction?:    () => void;
  /** Secondary, lower-emphasis action shown beneath the primary one. */
  secondaryLabel?: string;
  onSecondary?:    () => void;
  tone?:        'neutral' | 'brand' | 'danger';
  /** Tighten spacing when the state sits inside a card rather than a screen. */
  compact?:     boolean;
  style?:       StyleProp<ViewStyle>;
}

const TONES = {
  neutral: { bg: color.surfaceMuted, fg: color.textTertiary },
  brand:   { bg: color.brandSoft,    fg: color.brand },
  danger:  { bg: color.dangerSoft,   fg: color.danger },
} as const;

export function EmptyState({
  iconName = 'search',
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tone = 'neutral',
  compact = false,
  style,
}: EmptyStateProps) {
  const t = TONES[tone];

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        {
          alignItems: 'center',
          paddingHorizontal: gutter,
          paddingVertical: compact ? space.xl : space['4xl'],
          gap: space.md,
        },
        style,
      ]}
    >
      <Animated.View
        entering={FadeInDown.duration(360)}
        style={{
          width: compact ? 52 : 68,
          height: compact ? 52 : 68,
          borderRadius: radius.full,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={iconName} size={compact ? 22 : 28} color={t.fg} />
      </Animated.View>

      <View style={{ gap: space.xs, alignItems: 'center' }}>
        <Text variant={compact ? 'headline' : 'title3'} align="center">{title}</Text>
        {subtitle ? (
          <Text variant="callout" tone="tertiary" align="center" style={{ maxWidth: 320 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button onPress={onAction} variant="primary" style={{ marginTop: space.xs }}>
          {actionLabel}
        </Button>
      ) : null}

      {secondaryLabel && onSecondary ? (
        <Button onPress={onSecondary} variant="ghost" size="sm">
          {secondaryLabel}
        </Button>
      ) : null}
    </Animated.View>
  );
}
