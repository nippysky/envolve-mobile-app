/**
 * Account — driver.
 *
 * Thin by necessity: a driver's record (vehicle, region, status) is maintained
 * in the web console, and there's no self-service endpoint for internal
 * roles. Rather than render a form against an API that doesn't exist, this
 * shows what the session knows and says who to ask.
 *
 * Password reset is the one thing a driver can self-serve — same staff flow as
 * the sign-in screen.
 */

import React from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Pressable, Icon, Surface, Badge,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber } from '@/lib/contact';
import { useAuth } from '@/contexts/AuthContext';
import { listMyDeliveries, SETTLED } from '@/lib/services/driver.service';

const SUPPORT_EMAIL = 'info@envolvepharm.com.ng';
const DISPATCH_PHONE = '+2348055136726';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // A single page is enough for the two counters — this is a summary, not a
  // report, and History has the full picture.
  const deliveriesQ = useQuery({
    queryKey: ['deliveries', 'mine', 'summary'],
    queryFn:  () => listMyDeliveries({ limit: 50 }),
    staleTime: 60_000,
  });

  const records   = deliveriesQ.data?.records ?? [];
  const active    = records.filter(d => !SETTLED.includes(d.status)).length;
  const delivered = records.filter(d => d.status === 'DELIVERED').length;

  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  const initials = name.split(' ').filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase()).join('') || '—';

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You’ll need your work email and password to sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader title="Account" />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: layout.tabBarHeight + space['2xl'],
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Identity ── */}
          <Animated.View entering={FadeInDown.duration(340)}>
            <Surface level="sm" padded="base" rounded="xl">
              <View style={{ gap: space.base }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: radius.full,
                    backgroundColor: color.surfaceDark,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text variant="title3" style={{ color: '#fff' }}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title3" numberOfLines={1}>{name || 'Driver'}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>{user?.email}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <Badge tone="brand" size="sm" dot>driver</Badge>
                  {active > 0 ? (
                    <Badge tone="warning" size="sm">{active} on the road</Badge>
                  ) : (
                    <Badge tone="success" size="sm">All clear</Badge>
                  )}
                  {delivered > 0 ? (
                    <Badge tone="neutral" size="sm">{delivered} delivered</Badge>
                  ) : null}
                </View>
              </View>
            </Surface>
          </Animated.View>

          {/* ── Accountability ── */}
          <Animated.View entering={FadeInDown.delay(60).duration(320)}>
            <Surface tone="subtle" level="none" padded="base" rounded="lg">
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Icon name="shield" size={16} color={color.accent} filled />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  Status changes and any cash you confirm collecting are recorded
                  against your name with a timestamp.
                </Text>
              </View>
            </Surface>
          </Animated.View>

          {/* ── Shortcuts ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Your work</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <Row
                icon="truck"
                label="Today’s runs"
                hint={active > 0 ? `${active} to deliver` : 'Nothing assigned'}
                onPress={() => router.push('/(driver)/deliveries' as never)}
              />
              <Row
                icon="clipboard"
                label="History"
                hint="Runs you’ve closed"
                onPress={() => router.push('/(driver)/history' as never)}
                last
              />
            </Surface>
          </Animated.View>

          {/* ── Help ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Need a hand?</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <Row
                icon="phone"
                label="Call dispatch"
                hint="+234 805 513 6726"
                onPress={() => void callNumber(DISPATCH_PHONE)}
              />
              <Row
                icon="lock"
                label="Change your password"
                hint="Sends a code to your work email"
                onPress={() => router.push('/(auth)/forgot-password?audience=staff' as never)}
                last
              />
            </Surface>

            <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs }}>
              <Icon name="info" size={13} color={color.textDisabled} />
              <Text variant="caption" tone="disabled" style={{ flex: 1 }}>
                Your vehicle details and assignments are managed by the office.
                Contact them, or email {SUPPORT_EMAIL}, to change them.
              </Text>
            </View>
          </Animated.View>

          <Button
            variant="ghost"
            fullWidth
            onPress={confirmSignOut}
            icon={<Icon name="logout" size={16} color={color.danger} />}
          >
            <Text variant="bodyMedium" tone="danger">Sign out</Text>
          </Button>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ icon, label, hint, onPress, last = false }: {
  icon: 'truck' | 'clipboard' | 'phone' | 'lock';
  label: string;
  hint: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: space.base, paddingVertical: space.md,
        minHeight: layout.tapTarget,
        borderBottomWidth: last ? 0 : layout.hairlineWidth,
        borderBottomColor: color.borderSubtle,
      }}
    >
      <View style={{
        width: 32, height: 32, borderRadius: radius.full,
        backgroundColor: color.surfaceMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={15} color={color.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>{hint}</Text>
      </View>
      <Icon name="chevron-right" size={15} color={color.textDisabled} />
    </Pressable>
  );
}
