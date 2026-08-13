/**
 * Screen header.
 *
 * Two presentations from one component:
 *
 *   • `large` (default) — the title sits left-aligned below the status bar at
 *     display weight, the way a native iOS large title does. Used for the root
 *     of a section, where the title is the first thing you read.
 *   • `compact` — a 44pt bar with the title centred between a back button and
 *     an optional trailing slot. Used for pushed screens, where the back
 *     affordance matters more than the title.
 *
 * The border only appears once content scrolls under it. A header that draws a
 * line against a screen that isn't scrolled reads as a seam; one that reveals
 * the line on scroll reads as depth. Pass `scrollY` to get that behaviour —
 * without it the border is simply always on.
 */

import React from 'react';
import { View, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle, interpolate, Extrapolation, type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { Pressable } from '@/components/ui/Pressable';
import { Icon } from '@/components/ui/Icon';
import { color, space, radius, gutter, layout } from '@/constants/theme';

export interface ScreenHeaderProps {
  title:     string;
  subtitle?: string;
  /** Small uppercase label above the title. Large variant only. */
  eyebrow?:  string;
  variant?:  'large' | 'compact';
  back?:     boolean;
  onBack?:   () => void;
  /** Trailing slot — action buttons, a notification bell, etc. */
  right?:    React.ReactNode;
  /** Drives the reveal-on-scroll bottom border. */
  scrollY?:  SharedValue<number>;
  transparent?: boolean;
  style?:    StyleProp<ViewStyle>;
}

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  variant = 'large',
  back = false,
  onBack,
  right,
  scrollY,
  transparent = false,
  style,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Fades in over the first 12pt of travel — enough to feel tied to the
  // gesture, short enough that it's fully drawn before you notice it missing.
  const borderStyle = useAnimatedStyle(() => ({
    opacity: scrollY
      ? interpolate(scrollY.value, [0, 12], [0, 1], Extrapolation.CLAMP)
      : 1,
  }));

  const backButton = back ? (
    <Pressable
      onPress={handleBack}
      haptic="light"
      pressScale={0.92}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={{
        width: 36, height: 36, borderRadius: radius.full,
        backgroundColor: color.surfaceMuted,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon name="back" size={17} color={color.text} />
    </Pressable>
  ) : null;

  return (
    <View
      style={[
        {
          paddingTop: insets.top + (Platform.OS === 'android' ? space.sm : space.xs),
          paddingHorizontal: gutter,
          paddingBottom: variant === 'large' ? space.md : space.sm,
          backgroundColor: transparent ? 'transparent' : color.bg,
        },
        style,
      ]}
    >
      {variant === 'compact' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: layout.tapTarget }}>
          <View style={{ width: 44, justifyContent: 'center' }}>{backButton}</View>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="headline" numberOfLines={1}>{title}</Text>
            {subtitle ? (
              <Text variant="caption" tone="tertiary" numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>

          <View style={{ width: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
            {right}
          </View>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {backButton ? <View style={{ alignSelf: 'flex-start' }}>{backButton}</View> : null}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
            <View style={{ flex: 1 }}>
              {eyebrow ? (
                <Text variant="overline" tone="brand">{eyebrow}</Text>
              ) : null}
              <Text variant="title1" numberOfLines={2}>{title}</Text>
              {subtitle ? (
                <Text variant="callout" tone="tertiary" numberOfLines={2} style={{ marginTop: 2 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {right}
          </View>
        </View>
      )}

      {!transparent ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: layout.hairlineWidth,
              backgroundColor: color.borderSubtle,
            },
            borderStyle,
          ]}
        />
      ) : null}
    </View>
  );
}
