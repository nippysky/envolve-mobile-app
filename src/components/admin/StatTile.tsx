/**
 * KPI tile.
 *
 * The trend chip only renders when the API actually returned a trend. That
 * field is `null` whenever the previous period had zero of whatever's being
 * measured — a first month of trading, a new sales rep — because a percentage
 * change from zero is undefined, not "up 100%". Rendering it as 0% or ∞ would
 * be inventing a number, so it's simply absent.
 *
 * Trend colour is deliberately not hardcoded to "green is up". `inverted` flips
 * it for metrics where a rise is bad — refunds, failed deliveries.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { color, space, radius, layout, elevation } from '@/constants/theme';

export interface StatTileProps {
  label:    string;
  value:    string;
  /** Percentage change vs the previous period. `null` when undefined. */
  trend?:   number | null;
  /** Set when a rising number is a bad sign. */
  inverted?: boolean;
  icon?:    IconName;
  hint?:    string;
  loading?: boolean;
  index?:   number;
  style?:   StyleProp<ViewStyle>;
}

export function StatTile({
  label, value, trend, inverted = false, icon, hint,
  loading = false, index = 0, style,
}: StatTileProps) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  const up       = hasTrend && trend > 0;
  const flat     = hasTrend && trend === 0;
  const good     = inverted ? !up : up;

  const trendTint = flat ? color.textTertiary : good ? color.success : color.danger;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(340)}
      style={[
        {
          flex: 1,
          minWidth: 150,
          padding: space.base,
          borderRadius: radius.lg,
          backgroundColor: color.surface,
          borderWidth: layout.hairlineWidth,
          borderColor: color.borderSubtle,
          gap: space.sm,
          ...elevation.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {icon ? (
          <View style={{
            width: 26, height: 26, borderRadius: radius.full,
            backgroundColor: color.surfaceMuted,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={13} color={color.textTertiary} />
          </View>
        ) : null}
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
      </View>

      {loading ? (
        <Skeleton width="70%" height={26} />
      ) : (
        <Text variant="title2" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      )}

      {hasTrend && !loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon
            name={flat ? 'minus' : up ? 'chevron-up' : 'chevron-down'}
            size={11}
            color={trendTint}
          />
          <Text variant="caption" style={{ color: trendTint, fontWeight: '700' }}>
            {Math.abs(trend)}%
          </Text>
          <Text variant="caption" tone="disabled" numberOfLines={1} style={{ flex: 1 }}>
            vs previous
          </Text>
        </View>
      ) : hint && !loading ? (
        <Text variant="caption" tone="disabled" numberOfLines={1}>{hint}</Text>
      ) : null}
    </Animated.View>
  );
}
