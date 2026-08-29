/**
 * Role selection — the first screen everyone sees.
 *
 * Two doors: customer and staff. They authenticate against different endpoints
 * and land in completely different products, so the split has to happen before
 * either sign-in form.
 *
 * The labels are deliberately plain — "Customer login", "Staff login". They
 * used to read "Pharmacy account" and "Staff & drivers", which asked a driver
 * to recognise themselves in a compound label and a pharmacist to work out
 * that "account" meant "sign in".
 *
 * Choosing a door animates rather than cutting: the chosen card lifts and the
 * other retreats, then the stack slides the sign-in screen in. The screen you
 * land on carries the same accent colour, so it reads as one movement into
 * that context rather than two unrelated screens.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, Easing,
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';

import { Text, Pressable, Icon, Surface } from '@/components/ui';
import { color, space, radius, gutter, elevation } from '@/constants/theme';
import { Logo } from '@/components/shared/Logo';

/** How long the cards animate before the stack takes over. */
const HANDOFF_MS = 220;

interface Door {
  key:   'customer' | 'staff';
  icon:  React.ComponentProps<typeof Icon>['name'];
  title: string;
  hint:  string;
  href:  string;
  tint:  string;
}

const DOORS: Door[] = [
  {
    key:   'customer',
    icon:  'shop',
    title: 'Customer login',
    hint:  'Order and track deliveries',
    href:  '/(auth)/customer-login',
    tint:  color.brand,
  },
  {
    key:   'staff',
    icon:  'shield',
    title: 'Staff login',
    hint:  'Sales and delivery console',
    href:  '/(auth)/staff-login',
    tint:  color.accent,
  },
];

type Phase = 'idle' | 'chosen' | 'dismissed';

function DoorCard({ door, index, phase, onPress }: {
  door: Door; index: number; phase: Phase; onPress: () => void;
}) {
  // Drives the leave animation. A shared value rather than React state so the
  // work stays off the JS thread while the navigation is being scheduled.
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(phase === 'idle' ? 0 : 1, {
      duration: HANDOFF_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [phase, p]);

  const animated = useAnimatedStyle(() => {
    if (phase === 'chosen') {
      return { opacity: 1, transform: [{ scale: 1 + p.value * 0.02 }, { translateY: -p.value * 4 }] };
    }
    if (phase === 'dismissed') {
      return { opacity: 1 - p.value, transform: [{ scale: 1 - p.value * 0.05 }, { translateY: p.value * 10 }] };
    }
    return { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] };
  }, [phase]);

  // Two wrappers, not one. The entering animation and `animated` both drive
  // opacity and transform, and Reanimated warns that a layout animation will
  // overwrite style props set on the same node. The outer view owns the
  // entrance, the inner one owns the choose-a-door movement.
  return (
    <Animated.View entering={FadeInDown.delay(140 + index * 70).duration(440)}>
      <Animated.View style={animated}>
        <Pressable
          onPress={onPress}
          haptic="medium"
          pressScale={0.985}
          accessibilityRole="button"
          accessibilityLabel={`${door.title}. ${door.hint}`}
        >
          <Surface level="md" rounded="xl" padded="lg">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
              <View
                style={{
                  width: 46, height: 46,
                  borderRadius: radius.full,
                  backgroundColor: `${door.tint}14`,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name={door.icon} size={21} color={door.tint} filled />
              </View>

              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="headline">{door.title}</Text>
                <Text variant="caption" tone="tertiary">{door.hint}</Text>
              </View>

              <Icon name="chevron-right" size={17} color={color.textDisabled} />
            </View>
          </Surface>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default function RoleSelectScreen() {
  const router = useRouter();
  const [choice, setChoice] = useState<Door['key'] | null>(null);

  // Coming back with the hardware or on-screen back button must restore both
  // cards. Without this the dismissed one stays faded out on return.
  useFocusEffect(
    useCallback(() => {
      setChoice(null);
    }, []),
  );

  const choose = useCallback((door: Door) => {
    if (choice) return;              // one door at a time
    setChoice(door.key);
    setTimeout(() => router.push(door.href as never), HANDOFF_MS);
  }, [choice, router]);

  const phaseFor = (key: Door['key']): Phase =>
    choice === null ? 'idle' : choice === key ? 'chosen' : 'dismissed';

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <LinearGradient
        colors={[`${color.brand}12`, 'transparent']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 340 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <Animated.View
            entering={FadeIn.duration(520)}
            style={{ alignItems: 'center', paddingTop: space['3xl'], paddingBottom: space.xl }}
          >
            <Logo size={52} />
          </Animated.View>

          {/* Heading */}
          <Animated.View entering={FadeInDown.duration(440)} style={{ marginBottom: space.xl }}>
            <Text variant="title1" align="center" style={{ marginBottom: space.xs }}>
              Welcome back
            </Text>
            <Text variant="callout" tone="tertiary" align="center">
              Sign in to continue
            </Text>
          </Animated.View>

          {/* Doors */}
          <View style={{ gap: space.md }}>
            {DOORS.map((d, i) => (
              <DoorCard
                key={d.key}
                door={d}
                index={i}
                phase={phaseFor(d.key)}
                onPress={() => choose(d)}
              />
            ))}
          </View>

          <View style={{ flex: 1, minHeight: space.xl }} />

          {/* Secondary paths */}
          <Animated.View entering={FadeInDown.delay(300).duration(440)} style={{ gap: space.sm }}>
            <Pressable
              onPress={() => router.push('/(auth)/sign-up')}
              haptic="light"
              pressOpacity={0.6}
              accessibilityRole="button"
              style={{
                paddingVertical: space.md,
                alignItems: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.border,
                backgroundColor: color.surface,
                ...elevation.sm,
              }}
            >
              <Text variant="bodyMedium">
                New pharmacy?{' '}
                <Text variant="bodyMedium" tone="brand" weight="600">Create an account</Text>
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(public)/catalogue')}
              haptic="light"
              pressOpacity={0.6}
              accessibilityRole="button"
              style={{ alignItems: 'center', paddingVertical: space.sm }}
            >
              <Text variant="caption" tone="tertiary">
                Browse the catalogue without signing in
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
