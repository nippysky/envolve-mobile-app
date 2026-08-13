/**
 * Text field.
 *
 * Focus state animates the border colour rather than snapping — a small thing,
 * but snapping borders are one of the tells of a hastily built form. Errors
 * are announced to screen readers via accessibilityLiveRegion.
 */

import React, { forwardRef, useCallback, useState } from 'react';
import {
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Text } from './Text';
import { Pressable } from './Pressable';
import { color, motion, radius, space, text as typeScale, layout } from '@/constants/theme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?:      string;
  hint?:       string;
  error?:      string;
  /** Rendered inside the field, before the text. */
  leading?:    React.ReactNode;
  /** Rendered inside the field, after the text — e.g. a reveal toggle. */
  trailing?:   React.ReactNode;
  onTrailingPress?: () => void;
  required?:   boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Overrides applied to the TextInput itself — e.g. centred OTP tracking. */
  inputStyle?: StyleProp<TextStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label, hint, error, leading, trailing, onTrailingPress,
    required, containerStyle, inputStyle, onFocus, onBlur, editable = true, ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>((e) => {
    setFocused(true);
    focus.value = withTiming(1, { duration: motion.duration.fast });
    onFocus?.(e);
  }, [focus, onFocus]);

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>((e) => {
    setFocused(false);
    focus.value = withTiming(0, { duration: motion.duration.fast });
    onBlur?.(e);
  }, [focus, onBlur]);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: error
      ? color.danger
      : interpolateColor(focus.value, [0, 1], [color.border, color.brand]),
    // A soft ring on focus, matching the web's --shadow-glow.
    shadowOpacity: focus.value * 0.18,
  }));

  return (
    <View style={containerStyle}>
      {label ? (
        <View style={{ flexDirection: 'row', gap: 2, marginBottom: space.xs }}>
          <Text variant="label" tone="secondary">{label}</Text>
          {required ? <Text variant="label" tone="danger">*</Text> : null}
        </View>
      ) : null}

      <Animated.View
        style={[
          {
            flexDirection:   'row',
            alignItems:      'center',
            gap:             space.sm,
            minHeight:       layout.tapTarget + 4,
            paddingHorizontal: space.md,
            borderRadius:    radius.md,
            borderWidth:     1,
            backgroundColor: editable ? color.surface : color.surfaceMuted,
            shadowColor:     color.brand,
            shadowOffset:    { width: 0, height: 0 },
            shadowRadius:    6,
          },
          borderStyle,
        ]}
      >
        {leading ? <View>{leading}</View> : null}

        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={color.textDisabled}
          style={[
            typeScale.body,
            {
              flex: 1,
              color: editable ? color.text : color.textTertiary,
              // Vertical padding rather than a fixed height so multiline grows.
              paddingVertical: space.md,
            },
            inputStyle,
          ]}
        />

        {trailing ? (
          onTrailingPress ? (
            <Pressable onPress={onTrailingPress} haptic="light" hitSlop={8}>
              {trailing}
            </Pressable>
          ) : (
            <View>{trailing}</View>
          )
        ) : null}
      </Animated.View>

      {error ? (
        <Text
          variant="caption"
          tone="danger"
          style={{ marginTop: space.xs }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: space.xs }}>
          {hint}
        </Text>
      ) : null}

      {/* Keeps the ref-forwarding lint quiet about an unused focused flag while
          leaving it available for future variants (e.g. floating labels). */}
      {focused && false ? <View /> : null}
    </View>
  );
});
