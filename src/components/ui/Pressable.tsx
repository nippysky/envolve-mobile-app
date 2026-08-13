/**
 * Press physics.
 *
 * Every tappable surface in the app routes through this so press feedback is
 * identical everywhere. Two things make it feel expensive rather than cheap:
 *
 *   1. A spring, not a timing curve. Real objects don't ease — they settle.
 *   2. Haptics fire on press-IN, not on release. Feedback that arrives after
 *      you've already committed feels laggy; feedback at the moment of contact
 *      feels like the device responded to you.
 */

import React, { useCallback } from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export type HapticStrength = 'none' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far the element scales down while held. Defaults to the token. */
  pressScale?: number;
  /** Opacity while held — for text-only controls where scale reads oddly. */
  pressOpacity?: number;
  haptic?: HapticStrength;
  children?: React.ReactNode;
}

async function fireHaptic(strength: HapticStrength) {
  if (strength === 'none') return;
  try {
    switch (strength) {
      case 'light':   return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':  return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':   return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success': return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning': return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':   return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // Haptics are unavailable on some devices and in simulators — never fatal.
  }
}

export function Pressable({
  style,
  pressScale = motion.pressScale,
  pressOpacity,
  haptic = 'light',
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableProps) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  const handlePressIn = useCallback<NonNullable<RNPressableProps['onPressIn']>>((e) => {
    scale.value = withSpring(pressScale, motion.spring);
    if (pressOpacity !== undefined) {
      opacity.value = withTiming(pressOpacity, { duration: motion.duration.fast });
    }
    void fireHaptic(haptic);
    onPressIn?.(e);
  }, [haptic, onPressIn, opacity, pressOpacity, pressScale, scale]);

  const handlePressOut = useCallback<NonNullable<RNPressableProps['onPressOut']>>((e) => {
    scale.value = withSpring(1, motion.spring);
    if (pressOpacity !== undefined) {
      opacity.value = withTiming(1, { duration: motion.duration.fast });
    }
    onPressOut?.(e);
  }, [onPressOut, opacity, pressOpacity, scale]);

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
