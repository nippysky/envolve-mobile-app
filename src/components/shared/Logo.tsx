/**
 * Brand mark.
 *
 * Uses expo-image rather than RN's Image for the memory cache and the
 * contentFit behaviour — the logo appears on nearly every auth surface, so it
 * should decode once and stay resident.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/Text';
import { color, space } from '@/constants/theme';

const MARK = require('../../../assets/images/logo.png');

export interface LogoProps {
  /** Height of the mark in points. Width scales with the aspect ratio. */
  size?: number;
  /** Show the wordmark beneath the symbol. */
  withWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Logo({ size = 48, withWordmark = false, style }: LogoProps) {
  return (
    <View style={[{ alignItems: 'center', gap: space.sm }, style]}>
      <Image
        source={MARK}
        style={{ height: size, width: size * 2.75 }}
        contentFit="contain"
        // Cached in memory and on disk — this renders on most auth screens.
        cachePolicy="memory-disk"
        transition={200}
        accessibilityLabel="Envolve Pharmaceuticals"
      />

      {withWordmark ? (
        <Text variant="overline" tone="tertiary" style={{ color: color.textTertiary }}>
          PHARMACEUTICALS
        </Text>
      ) : null}
    </View>
  );
}
