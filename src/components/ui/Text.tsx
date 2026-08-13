/**
 * Typography component.
 *
 * Screens should never reach for raw `<Text>` with inline font sizes — that's
 * how a design system drifts. Pick a variant; the scale does the rest.
 */

import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { color, text as typeScale } from '@/constants/theme';

export type TextVariant = keyof typeof typeScale;
export type TextTone =
  | 'default' | 'secondary' | 'tertiary' | 'disabled'
  | 'inverse' | 'brand' | 'success' | 'warning' | 'danger';

const TONE: Record<TextTone, string> = {
  default:   color.text,
  secondary: color.textSecondary,
  tertiary:  color.textTertiary,
  disabled:  color.textDisabled,
  inverse:   color.textInverse,
  brand:     color.brand,
  success:   color.success,
  warning:   color.warning,
  danger:    color.danger,
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?:    TextTone;
  align?:   TextStyle['textAlign'];
  /** Convenience for one-off weight bumps without leaving the scale. */
  weight?:  TextStyle['fontWeight'];
  children?: React.ReactNode;
}

export function Text({
  variant = 'body',
  tone    = 'default',
  align,
  weight,
  style,
  children,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        { color: TONE[tone] },
        align  ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
