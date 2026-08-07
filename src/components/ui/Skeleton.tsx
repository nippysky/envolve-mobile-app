/**
 * Skeleton loader — animated shimmer using Reanimated.
 * Drop-in replacement for any placeholder shape.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

interface Props {
  width?:  number | `${number}%`;
  height?: number;
  radius?: number;
  style?:  ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: Props) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800 }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: Colors.bgMuted,
        },
        animStyle,
        style,
      ]}
    />
  );
}

/** Pre-built skeleton for a product card */
export function ProductCardSkeleton() {
  return (
    <View style={card.wrapper}>
      <Skeleton height={130} radius={12} style={card.image} />
      <View style={card.body}>
        <Skeleton width="50%" height={10} />
        <Skeleton height={14} style={card.gap} />
        <Skeleton width="70%" height={10} style={card.gap} />
        <Skeleton width="40%" height={16} style={{ ...card.gap, marginTop: 8 }} />
      </View>
    </View>
  );
}

/** Pre-built skeleton for a list row */
export function RowSkeleton() {
  return (
    <View style={row.wrapper}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={row.body}>
        <Skeleton width="60%" height={13} />
        <Skeleton width="80%" height={11} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  wrapper: { borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.white, padding: 0 },
  image:   { width: '100%', borderRadius: 0 },
  body:    { padding: 12 },
  gap:     { marginTop: 6 },
});

const row = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  body:    { flex: 1 },
});
