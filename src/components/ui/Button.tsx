/**
 * Button.
 *
 * Built on the shared Pressable so press physics and haptics match every other
 * tappable surface. Sizes map to the tap-target minimum — the small variant is
 * still 36pt tall with padding that brings its hit area to 44.
 */

import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable, type HapticStrength } from './Pressable';
import { Text } from './Text';
import { color, radius, space, elevation } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'tinted' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children:    React.ReactNode;
  onPress?:    () => void;
  variant?:    Variant;
  size?:       Size;
  loading?:    boolean;
  disabled?:   boolean;
  fullWidth?:  boolean;
  /** Rendered before the label. */
  icon?:       React.ReactNode;
  /** Rendered after the label. */
  trailingIcon?: React.ReactNode;
  haptic?:     HapticStrength;
  style?:      StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 46, lg: 54 };
const PAD_X:  Record<Size, number> = { sm: space.md, md: space.lg, lg: space.xl };
const RADIUS: Record<Size, number> = { sm: radius.sm, md: radius.md, lg: radius.lg };

/** Background, border and label colour per variant. */
const VARIANT: Record<Variant, { bg: string; border: string; fg: string; raised: boolean }> = {
  primary:   { bg: color.brand,        border: color.brand,       fg: color.textInverse, raised: true  },
  secondary: { bg: color.surface,      border: color.border,      fg: color.text,        raised: true  },
  // Transparent with a visible edge — for secondary actions sitting on a card,
  // where a filled surface would read as a second primary.
  outline:   { bg: 'transparent',      border: color.borderStrong, fg: color.text,       raised: false },
  tinted:    { bg: color.brandSoft,    border: color.brandBorder, fg: color.brand,       raised: false },
  ghost:     { bg: 'transparent',      border: 'transparent',     fg: color.text,        raised: false },
  danger:    { bg: color.danger,       border: color.danger,      fg: color.textInverse, raised: true  },
};

export function Button({
  children,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  fullWidth = false,
  icon,
  trailingIcon,
  haptic    = 'light',
  style,
  accessibilityLabel,
}: ButtonProps) {
  const v          = VARIANT[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      haptic={isDisabled ? 'none' : haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          height:          HEIGHT[size],
          paddingHorizontal: PAD_X[size],
          borderRadius:    RADIUS[size],
          backgroundColor: v.bg,
          borderWidth:     variant === 'ghost' ? 0 : 1,
          borderColor:     v.border,
          flexDirection:   'row',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             space.sm,
        },
        // Only filled buttons carry a shadow. Tinted and ghost sit flat by
        // design — elevating them would compete with the primary action.
        v.raised && elevation.sm,
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            variant={size === 'lg' ? 'headline' : size === 'sm' ? 'label' : 'bodyMedium'}
            style={{ color: v.fg, fontWeight: '600' }}
            numberOfLines={1}
          >
            {children}
          </Text>
          {trailingIcon ? <View>{trailingIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}
