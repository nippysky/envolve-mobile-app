import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

interface Props extends PressableProps {
  children:  React.ReactNode;
  variant?:  'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?:     'sm' | 'md' | 'lg';
  loading?:  boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  fullWidth = false,
  disabled,
  onPress,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;

  async function handlePress(e: Parameters<NonNullable<PressableProps['onPress']>>[0]) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  }

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        (isDisabled || pressed) && styles.dimmed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.brand : Colors.white}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`]]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    flexDirection:   'row',
    gap:             8,
  },
  fullWidth: { width: '100%' },
  dimmed:    { opacity: 0.6 },

  // Variants
  primary: {
    backgroundColor: Colors.brand,
  },
  secondary: {
    backgroundColor: Colors.teal,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth:     1.5,
    borderColor:     Colors.brand,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.danger,
  },

  // Sizes
  size_sm: { paddingHorizontal: 14, paddingVertical: 8  },
  size_md: { paddingHorizontal: 20, paddingVertical: 13 },
  size_lg: { paddingHorizontal: 24, paddingVertical: 16 },

  // Labels
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  label_primary:   { color: Colors.white },
  label_secondary: { color: Colors.white },
  label_outline:   { color: Colors.brand },
  label_ghost:     { color: Colors.brand },
  label_danger:    { color: Colors.white },

  labelSize_sm: { fontSize: 13 },
  labelSize_md: { fontSize: 15 },
  labelSize_lg: { fontSize: 16 },
});
