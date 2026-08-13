/**
 * Revenue sparkline.
 *
 * Hand-rolled with react-native-svg-free primitives — plain Views — rather than
 * pulling a chart library in for one shape. A chart dependency would add build
 * weight and a second styling vocabulary for something that is, at this size,
 * a row of bars.
 *
 * Bars rather than a line: at ~30 points on a phone-width canvas a line becomes
 * a jitter with no readable trend, while bars keep each day legible and make
 * gaps (no trading) visible instead of interpolated over.
 *
 * The y-axis is deliberately not labelled. At this size a scale is unreadable;
 * the tile above carries the actual figure and this shows only the shape.
 */

import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { color, space, radius } from '@/constants/theme';

export interface SparklineProps {
  data:    { date: string; revenue: number }[];
  height?: number;
  /** Highlights the tallest bar. Off for very short series where it's obvious. */
  markPeak?: boolean;
  style?:  StyleProp<ViewStyle>;
}

export function Sparkline({ data, height = 84, markPeak = true, style }: SparklineProps) {
  const { bars, peakIndex } = useMemo(() => {
    if (data.length === 0) return { bars: [], peakIndex: -1 };

    const max = Math.max(...data.map(d => d.revenue), 0);
    let peak = 0;
    data.forEach((d, i) => { if (d.revenue > data[peak].revenue) peak = i; });

    return {
      // A zero-revenue day gets a visible 2% stub rather than nothing, so the
      // series reads as "no trading" instead of a rendering gap.
      bars: data.map(d => (max > 0 ? Math.max(d.revenue / max, 0.02) : 0.02)),
      peakIndex: max > 0 ? peak : -1,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <View style={[{ height, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text variant="caption" tone="disabled">No revenue in this period</Text>
      </View>
    );
  }

  return (
    <View style={[{ gap: space.sm }, style]}>
      <View style={{
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: data.length > 45 ? 1 : 2,
      }}>
        {bars.map((fraction, i) => {
          const isPeak = markPeak && i === peakIndex;
          return (
            <Animated.View
              key={data[i].date}
              entering={FadeIn.delay(Math.min(i, 30) * 12).duration(260)}
              style={{
                flex: 1,
                height: `${fraction * 100}%`,
                minHeight: 2,
                borderRadius: radius.xs,
                backgroundColor: isPeak ? color.brand : color.brandBorder,
              }}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="disabled">{shortDate(data[0].date)}</Text>
        <Text variant="caption" tone="disabled">{shortDate(data[data.length - 1].date)}</Text>
      </View>
    </View>
  );
}

/** The API returns YYYY-MM-DD; this avoids a Date parse just to slice a label. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  if (!month || !day) return iso;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''}`.trim();
}
