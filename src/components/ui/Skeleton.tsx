/**
 * Skeleton — shimmer placeholder.
 *
 * A looping opacity pulse rather than a sliding gradient: it costs one
 * animated value instead of a masked gradient per row, which matters on long
 * lists, and it reads as calmer.
 */

import React, { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { color, radius as radii } from '@/constants/theme';

export interface SkeletonProps {
  width?:  DimensionValue;
  height?: number;
  radius?: keyof typeof radii | number;
  style?:  StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius = 'sm', style }: SkeletonProps) {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 700 }),
        withTiming(0.5, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: typeof radius === 'number' ? radius : radii[radius], backgroundColor: color.surfaceMuted },
        animated,
        style,
      ]}
    />
  );
}

/* ── Composed skeletons ──────────────────────────────────────────────────── */

import { View } from 'react-native';
import { space } from '@/constants/theme';

/** One list row: avatar block + two text lines. */
export function RowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
      <Skeleton width={44} height={44} radius="md" />
      <View style={{ flex: 1, gap: space.sm, justifyContent: 'center' }}>
        <Skeleton width="60%" height={13} />
        <Skeleton width="40%" height={11} />
      </View>
    </View>
  );
}

/** Catalogue grid tile: image block, title, price. */
export function ProductCardSkeleton() {
  return (
    <View style={{ flex: 1, gap: space.sm }}>
      <Skeleton width="100%" height={132} radius="lg" />
      <Skeleton width="80%" height={13} />
      <Skeleton width="45%" height={12} />
    </View>
  );
}
