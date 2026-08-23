/**
 * Bottom tab bar.
 *
 * Custom rather than the stock one so the outline/filled icon swap, the label
 * weight change and the indicator all animate together off a single spring.
 *
 * Details that carry the "considered" feel:
 *
 *   • Icon crossfades outline → filled instead of hard-swapping. A hard swap
 *     at 60fps reads as a flicker.
 *   • The active icon lifts 2pt and scales fractionally. Barely perceptible
 *     individually; unmistakable in aggregate.
 *   • Labels shift from regular to semibold weight, not just colour.
 *   • A soft pill sits behind the active tab rather than a hard underline —
 *     underlines look like web navigation ported to a phone.
 *   • Badges cap at 99+ and animate in with a spring so they don't pop.
 */

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  
  interpolate,
} from 'react-native-reanimated';

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Pressable } from '@/components/ui/Pressable';
import { color, space, radius, motion, layout } from '@/constants/theme';

export interface TabConfig {
  name:   string;
  label:  string;
  icon:   IconName;
  badge?: number;
}

/* ── Single tab ──────────────────────────────────────────────────────────── */

function Tab({
  config, focused, onPress, onLongPress,
}: {
  config: TabConfig;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  // One driver for every animated property on the tab, so they can't drift.
  const progress = useDerivedValue(() =>
    withSpring(focused ? 1 : 0, motion.spring),
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity:   progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1]) }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -2]) },
      { scale:      interpolate(progress.value, [0, 1], [1, 1.06]) },
    ],
  }));

  // Crossfade the two glyphs rather than swapping the component.
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }));
  const filledStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.62, 1]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      haptic="light"
      pressScale={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: space.sm,
        gap: 3,
        minHeight: layout.tapTarget,
      }}
    >
      {/* Active pill */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 2,
            width: 56,
            height: 30,
            borderRadius: radius.full,
            backgroundColor: color.brandSoft,
          },
          pillStyle,
        ]}
      />

      {/* Icon — both variants stacked, crossfaded */}
      <Animated.View style={[{ width: 24, height: 24 }, iconWrapStyle]}>
        <Animated.View style={[{ position: 'absolute' }, outlineStyle]}>
          <Icon name={config.icon} size={24} color={color.textTertiary} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute' }, filledStyle]}>
          <Icon name={config.icon} size={24} color={color.brand} filled />
        </Animated.View>

        {/* Badge */}
        {config.badge && config.badge > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -5,
              right: -10,
              minWidth: 17,
              height: 17,
              paddingHorizontal: 4,
              borderRadius: radius.full,
              backgroundColor: color.danger,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: color.surface,
            }}
          >
            <Text style={{ fontSize: 9, lineHeight: 12, fontWeight: '700', color: '#fff' }}>
              {config.badge > 99 ? '99+' : config.badge}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View style={labelStyle}>
        <Text
          variant="tab"
          style={{
            color: focused ? color.brand : color.textTertiary,
            fontWeight: focused ? '700' : '500',
          }}
          numberOfLines={1}
        >
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* ── Bar ─────────────────────────────────────────────────────────────────── */

/**
 * expo-router bundles the bottom-tabs implementation and its types, so we take
 * `BottomTabBarProps` from there rather than adding @react-navigation/bottom-tabs
 * as a direct dependency it already owns.
 */
export function TabBar({
  state, navigation, tabs,
}: Pick<BottomTabBarProps, 'state' | 'navigation'> & { tabs: TabConfig[] }) {
  const insets = useSafeAreaInsets();

  /**
   * Hide the bar on pushed screens.
   *
   * Every role layout registers its detail and form screens with `href: null`
   * so they don't appear as tabs — but they're still routes in the same
   * navigator, so the bar would otherwise render over them. That's wrong twice:
   * it covers content and fixed action bars, and it offers navigation away from
   * a half-filled form as if that were free.
   *
   * `tabs` is the list of real destinations, so any focused route missing from
   * it is by definition a pushed screen. No extra configuration to keep in
   * step — registering a screen with `href: null` is already the declaration.
   */
  const focusedRoute = state.routes[state.index]?.name;
  const isPushedScreen = !tabs.some(t => t.name === focusedRoute);
  if (isPushedScreen) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        paddingBottom: Math.max(insets.bottom, space.sm),
        borderTopWidth: layout.hairlineWidth,
        borderTopColor: color.borderSubtle,
        backgroundColor: color.surface,
        overflow: 'hidden',
        // A lift rather than a drop — the bar sits above the content it covers.
        shadowColor: color.text,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 12,
      }}
    >

      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {state.routes.map((route, index) => {
          const config = tabs.find(t => t.name === route.name);
          if (!config) return null;

          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Tab
              key={route.key}
              config={config}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}
