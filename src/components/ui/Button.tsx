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
import { type } from '@/constants/typography';

interface Props extends PressableProps {
  children:   React.ReactNode;
  variant?:   'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?:      'sm' | 'md' | 'lg';
  loading?:   boolean;
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
      style={(state) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        (isDisabled || state.pressed) && styles.dimmed,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.brand : Colors.white}
          size="small"
        />
      ) : (
        <Text style={[
          styles.label,
          styles[`label_${variant}`],
          size === 'lg' ? type.btnLg : size === 'sm' ? type.btnSm : type.btn,
        ]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    flexDirection:  'row',
    gap:            8,
  },
  fullWidth: { width: '100%' },
  dimmed:    { opacity: 0.55 },

  // Variants
  primary:   { backgroundColor: Colors.brand },
  secondary: { backgroundColor: Colors.teal },
  outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.brand },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: Colors.danger },

  // Sizes
  size_sm: { paddingHorizontal: 16, paddingVertical: 9  },
  size_md: { paddingHorizontal: 20, paddingVertical: 13 },
  size_lg: { paddingHorizontal: 24, paddingVertical: 16 },

  // Labels
  label: {},
  label_primary:   { color: Colors.white },
  label_secondary: { color: Colors.white },
  label_outline:   { color: Colors.brand },
  label_ghost:     { color: Colors.brand },
  label_danger:    { color: Colors.white },
});
