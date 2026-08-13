/**
 * Toast presentation.
 *
 * react-native-toast-message ships a default look that belongs to a different
 * app — coloured left bars, system font, square corners. This replaces it with
 * a single card shape shared by all three tones, where only the leading glyph
 * and its tint change. One shape, three accents, no layout shift between them.
 *
 * Design notes:
 *   • The card is dark, not white. A white toast over a white screen needs a
 *     heavy shadow to separate; a dark one separates on contrast alone and
 *     reads as system-level rather than in-page.
 *   • Tap dismisses. There is no close button — a 44pt target for something
 *     that leaves on its own is wasted furniture.
 *   • Title is optional. When absent the message takes the title's weight, so
 *     a one-liner never looks like a card missing its heading.
 *
 * `toast.*` in `@/lib/toast` takes (message, title) — the title is the second
 * argument because most calls only ever pass a message.
 */

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Text } from './Text';
import { Pressable } from './Pressable';
import { Icon, type IconName } from './Icon';
import { color, space, radius, gutter, elevation, layout } from '@/constants/theme';

type Tone = 'success' | 'error' | 'info';

const TONES: Record<Tone, { icon: IconName; tint: string }> = {
  success: { icon: 'check-circle', tint: '#4ade80' },
  error:   { icon: 'alert',        tint: '#f87171' },
  info:    { icon: 'info',         tint: '#7dd3fc' },
};

function ToastCard({ tone, params }: { tone: Tone; params: ToastConfigParams<unknown> }) {
  const { text1, text2, hide } = params;
  const { icon, tint } = TONES[tone];

  // text1 is the title, text2 the message — but a single-argument call puts the
  // message in text1. Detecting that here keeps the card honest either way.
  const hasTitle = !!text1 && !!text2;
  const title    = hasTitle ? text1 : undefined;
  const message  = hasTitle ? text2 : text1;

  return (
    <Animated.View entering={FadeInUp.duration(260)} style={{ width: '100%', paddingHorizontal: gutter }}>
      <Pressable
        onPress={() => hide()}
        pressScale={0.98}
        accessibilityRole="alert"
        accessibilityLabel={[title, message].filter(Boolean).join('. ')}
        style={{
          flexDirection: 'row',
          alignItems: hasTitle ? 'flex-start' : 'center',
          gap: space.md,
          paddingHorizontal: space.base,
          paddingVertical: space.md,
          borderRadius: radius.lg,
          backgroundColor: color.surfaceDark,
          borderWidth: layout.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.10)',
          ...elevation.lg,
          shadowColor: '#000',
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.full,
            backgroundColor: `${tint}22`,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: hasTitle ? 1 : 0,
          }}
        >
          <Icon name={icon} size={15} color={tint} filled />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          {title ? (
            <Text variant="bodyMedium" numberOfLines={1} style={{ color: '#fff' }}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text
              variant={title ? 'caption' : 'bodyMedium'}
              numberOfLines={3}
              style={{ color: title ? 'rgba(255,255,255,0.66)' : '#fff' }}
            >
              {message}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const toastConfig: ToastConfig = {
  success: props => <ToastCard tone="success" params={props} />,
  error:   props => <ToastCard tone="error"   params={props} />,
  info:    props => <ToastCard tone="info"    params={props} />,
};

/**
 * Drop-in for the bare `<Toast />` at the app root. Offsets below the notch so
 * the card never sits under the status bar on a device with a dynamic island.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  return <Toast config={toastConfig} topOffset={insets.top + space.sm} />;
}
