/**
 * Quantity stepper.
 *
 * Details that matter here more than they look like they should:
 *
 *   • The number never reflows the control. It sits in a fixed-width slot
 *     sized for four digits, so going 9 → 10 doesn't shove the buttons
 *     sideways under the thumb that's tapping them.
 *   • The minus button becomes a bin at the minimum when `onRemove` is given.
 *     Tapping "−" on a quantity of 1 should remove the line, not do nothing.
 *   • Bounds are enforced silently. A disabled button that also fires haptics
 *     lies about what it did.
 *   • `min` defaults to 1 but the catalogue's `minimum_order` should be passed
 *     through — the API rejects anything below it, and finding that out at
 *     checkout instead of at the stepper is a bad trade.
 */

import React, { useCallback } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { Pressable } from './Pressable';
import { Icon } from './Icon';
import { color, space, radius, layout } from '@/constants/theme';

export interface QuantityStepperProps {
  value:     number;
  onChange:  (next: number) => void;
  min?:      number;
  max?:      number;
  /** When set, pressing "−" at `min` removes instead of no-oping. */
  onRemove?: () => void;
  disabled?: boolean;
  size?:     'sm' | 'md';
  style?:    StyleProp<ViewStyle>;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  onRemove,
  disabled = false,
  size = 'md',
  style,
}: QuantityStepperProps) {
  const dim  = size === 'sm' ? 30 : 36;
  const icon = size === 'sm' ? 14 : 16;

  const atMin = value <= min;
  const atMax = value >= max;

  const decrement = useCallback(() => {
    if (atMin) { onRemove?.(); return; }
    onChange(value - 1);
  }, [atMin, onRemove, onChange, value]);

  const increment = useCallback(() => {
    if (atMax) return;
    onChange(value + 1);
  }, [atMax, onChange, value]);

  const removesOnDecrement = atMin && !!onRemove;
  const decrementDisabled  = disabled || (atMin && !onRemove);

  const button = (
    kind: 'minus' | 'plus',
    onPress: () => void,
    isDisabled: boolean,
    danger = false,
  ) => (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={isDisabled ? undefined : 'light'}
      pressScale={0.9}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={
        kind === 'plus' ? 'Increase quantity'
        : danger ? 'Remove item'
        : 'Decrease quantity'
      }
      accessibilityState={{ disabled: isDisabled }}
      style={{
        width: dim,
        height: dim,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.surface,
        borderWidth: layout.hairlineWidth,
        borderColor: color.border,
        opacity: isDisabled ? 0.38 : 1,
      }}
    >
      <Icon
        name={danger ? 'trash' : kind}
        size={icon}
        color={danger ? color.danger : color.text}
      />
    </Pressable>
  );

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {button('minus', decrement, decrementDisabled, removesOnDecrement)}

      {/* Fixed slot — the control must not resize as the number grows. */}
      <View style={{ minWidth: 34, alignItems: 'center' }}>
        <Text variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      </View>

      {button('plus', increment, disabled || atMax)}
    </View>
  );
}
