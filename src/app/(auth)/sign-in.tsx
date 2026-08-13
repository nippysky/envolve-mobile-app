/**
 * Role selection.
 *
 * Two doors: customer and staff. Mirrors the web, which splits these because
 * the two audiences authenticate against different endpoints and land in
 * completely different products.
 *
 * The cards stagger in on mount — 60ms apart. Simultaneous entrance reads as a
 * single block; staggered reads as composed.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { Text, Pressable, Icon, Surface } from '@/components/ui';
import { color, space, radius, gutter, elevation } from '@/constants/theme';
import { Logo } from '@/components/shared/Logo';

interface Door {
  key:   string;
  icon:  React.ComponentProps<typeof Icon>['name'];
  title: string;
  body:  string;
  href:  string;
  tint:  string;
}

const DOORS: Door[] = [
  {
    key:   'customer',
    icon:  'shop',
    title: 'Pharmacy account',
    body:  'Browse the catalogue, place orders and track deliveries.',
    href:  '/(auth)/customer-login',
    tint:  color.brand,
  },
  {
    key:   'staff',
    icon:  'shield',
    title: 'Staff & drivers',
    body:  'Operations console and delivery assignments.',
    href:  '/(auth)/staff-login',
    tint:  color.accent,
  },
];

function DoorCard({ door, index, onPress }: {
  door: Door; index: number; onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 60).duration(420)}>
      <Pressable onPress={onPress} haptic="medium" pressScale={0.98}>
        <Surface level="md" rounded="xl" padded="lg">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
            <View
              style={{
                width: 52, height: 52,
                borderRadius: radius.lg,
                backgroundColor: `${door.tint}14`,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={door.icon} size={24} color={door.tint} filled />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{door.title}</Text>
              <Text variant="callout" tone="tertiary">{door.body}</Text>
            </View>

            <Icon name="chevron-right" size={18} color={color.textDisabled} />
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}

export default function RoleSelectScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <LinearGradient
        colors={[`${color.brand}12`, 'transparent']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 360 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <Animated.View
            entering={FadeIn.duration(500)}
            style={{ alignItems: 'center', paddingTop: space['3xl'], paddingBottom: space['2xl'] }}
          >
            <Logo size={56} />
          </Animated.View>

          {/* Heading */}
          <Animated.View entering={FadeInDown.duration(420)} style={{ marginBottom: space['2xl'] }}>
            <Text variant="title1" align="center" style={{ marginBottom: space.sm }}>
              Welcome back
            </Text>
            <Text variant="body" tone="secondary" align="center">
              Choose how you&rsquo;d like to sign in.
            </Text>
          </Animated.View>

          {/* Doors */}
          <View style={{ gap: space.md }}>
            {DOORS.map((d, i) => (
              <DoorCard
                key={d.key}
                door={d}
                index={i}
                onPress={() => router.push(d.href as never)}
              />
            ))}
          </View>

          <View style={{ flex: 1, minHeight: space['2xl'] }} />

          {/* Secondary paths */}
          <Animated.View entering={FadeInDown.delay(280).duration(420)} style={{ gap: space.base }}>
            <Pressable
              onPress={() => router.push('/(auth)/sign-up')}
              haptic="light"
              pressOpacity={0.6}
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
              style={{ alignItems: 'center', paddingVertical: space.sm }}
            >
              <Text variant="callout" tone="tertiary">
                Browse the catalogue without signing in
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
