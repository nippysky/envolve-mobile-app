/**
 * Surface — the card primitive.
 *
 * Enforces the elevation rule: a raised surface always pairs its shadow with a
 * hairline border. Shadow alone on a light background reads as a floating
 * sticker; the border is what makes it sit in the page.
 */

import React from 'react';
import { View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { color, elevation, radius, space } from '@/constants/theme';

export type SurfaceElevation = keyof typeof elevation;

export interface SurfaceProps extends ViewProps {
  level?:    SurfaceElevation;
  padded?:   boolean | keyof typeof space;
  rounded?:  keyof typeof radius;
  /** Tinted variants for inline callouts. */
  tone?:     'default' | 'subtle' | 'muted' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
  /** Drop the border — for surfaces sitting on a tinted parent. */
  borderless?: boolean;
  style?:    StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const TONE_BG: Record<NonNullable<SurfaceProps['tone']>, string> = {
  default: color.surface,
  subtle:  color.surfaceSubtle,
  muted:   color.surfaceMuted,
  brand:   color.brandSoft,
  success: color.successSoft,
  warning: color.warningSoft,
  danger:  color.dangerSoft,
  info:    color.infoSoft,
};

const TONE_BORDER: Record<NonNullable<SurfaceProps['tone']>, string> = {
  default: color.border,
  subtle:  color.borderSubtle,
  muted:   color.borderSubtle,
  brand:   '#a4e0ee',
  success: '#bbf7d0',
  warning: '#fde68a',
  danger:  '#fecaca',
  info:    '#a5f3fc',
};

export function Surface({
  level      = 'sm',
  padded     = false,
  rounded    = 'lg',
  tone       = 'default',
  borderless = false,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const pad =
    padded === true  ? space.base
    : padded === false ? 0
    : space[padded];

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: TONE_BG[tone],
          borderRadius:    radius[rounded],
          padding:         pad,
        },
        !borderless && {
          borderWidth: 1,
          borderColor: TONE_BORDER[tone],
        },
        elevation[level],
        style,
      ]}
    >
      {children}
    </View>
  );
}
