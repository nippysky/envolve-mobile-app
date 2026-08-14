/**
 * Empty and error state.
 *
 * The glyph sits in a layered halo — a soft outer ring behind a tinted disc —
 * rather than floating grey on white. A lone low-contrast icon reads as a
 * rendering failure; the same icon on a plinth reads as intentional, and the
 * ring gives it enough presence to anchor a whole empty screen without
 * shouting.
 *
 * Actions are real buttons, both of them. The secondary used to render as a
 * ghost button, which on a plain background is indistinguishable from a line of
 * bold text — people don't tap what doesn't look tappable. It's now an outlined
 * button: clearly secondary to the primary, unmistakably still a button.
 *
 * Copy convention: `title` says what isn't there, `subtitle` says what to do
 * about it. "No orders yet" / "Your first order will appear here once you check
 * out." — never "No data found."
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

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
  tone?:        'neutral' | 'brand' | 'danger' | 'success' | 'warning';
  /** Tighten spacing when the state sits inside a card rather than a screen. */
  compact?:     boolean;
  style?:       StyleProp<ViewStyle>;
}

const TONES = {
  neutral: { disc: color.surfaceMuted, halo: color.surfaceSubtle, fg: color.textTertiary },
  brand:   { disc: color.brandSoft,    halo: '#e6f6fb',           fg: color.brand },
  danger:  { disc: color.dangerSoft,   halo: '#fef2f2',           fg: color.danger },
  success: { disc: color.successSoft,  halo: '#f0fdf4',           fg: color.success },
  warning: { disc: color.warningSoft,  halo: '#fffbeb',           fg: color.warning },
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

  const disc = compact ? 56 : 76;
  const halo = disc + (compact ? 18 : 28);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        {
          alignItems: 'center',
          paddingHorizontal: gutter,
          paddingVertical: compact ? space.xl : space['3xl'],
          gap: compact ? space.md : space.lg,
        },
        style,
      ]}
    >
      {/* Halo + disc. The ring is what stops the glyph reading as an
          afterthought on an otherwise blank screen. */}
      <Animated.View
        entering={ZoomIn.duration(380)}
        style={{
          width: halo,
          height: halo,
          borderRadius: halo / 2,
          backgroundColor: t.halo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            backgroundColor: t.disc,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={iconName} size={compact ? 24 : 32} color={t.fg} filled />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(80).duration(340)}
        style={{ gap: space.xs, alignItems: 'center' }}
      >
        <Text variant={compact ? 'headline' : 'title3'} align="center">{title}</Text>
        {subtitle ? (
          <Text
            variant="callout"
            tone="tertiary"
            align="center"
            style={{ maxWidth: 320, lineHeight: 21 }}
          >
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      {actionLabel && onAction ? (
        <Animated.View
          entering={FadeInDown.delay(140).duration(340)}
          style={{ width: '100%', maxWidth: 300, gap: space.sm, marginTop: space.xs }}
        >
          <Button onPress={onAction} variant="primary" size="lg" fullWidth haptic="medium">
            {actionLabel}
          </Button>

          {/* Outlined, not ghost — a secondary action still has to look like a
              button, or nobody taps it. */}
          {secondaryLabel && onSecondary ? (
            <Button onPress={onSecondary} variant="outline" fullWidth>
              {secondaryLabel}
            </Button>
          ) : null}
        </Animated.View>
      ) : secondaryLabel && onSecondary ? (
        <Animated.View
          entering={FadeInDown.delay(140).duration(340)}
          style={{ width: '100%', maxWidth: 300, marginTop: space.xs }}
        >
          <Button onPress={onSecondary} variant="outline" fullWidth>
            {secondaryLabel}
          </Button>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
