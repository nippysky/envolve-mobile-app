/**
 * Your account — console.
 *
 * Deliberately thin. A staff member's own record is maintained in the web
 * console, and `/api/customers/me` is customer-only, so there's no
 * self-service profile endpoint for internal roles. Rather than build a form
 * against an endpoint that doesn't exist, this shows what the session knows and
 * says plainly who to ask for a change.
 *
 * Password reset is the one thing they *can* self-serve — it goes through the
 * same staff forgot-password flow as the sign-in screen.
 */

import React from 'react';
import { View, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Pressable, Icon, Surface, Badge,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import type { IconName } from '@/components/ui/Icon';

const SUPPORT_EMAIL = 'info@envolvepharm.com.ng';

const ROLE_BLURB: Record<string, string> = {
  STAFF:  'Orders, customers and deliveries for the accounts assigned to you.',
  DRIVER: 'Your delivery assignments and handovers.',
};

export default function ConsoleProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  const initials = name.split(' ').filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase()).join('') || '—';

  const role = user?.role ?? 'STAFF';

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
        <ScreenHeader variant="compact" back title="Your account" />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: space['2xl'],
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
                    <Text variant="title3" numberOfLines={1}>{name || 'Your account'}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>{user?.email}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  {/* Only STAFF reaches this screen now — admins sign in on the
                      web console — so there's no role to distinguish against. */}
                  <Badge tone="neutral" size="sm" dot>
                    {role.toLowerCase()}
                  </Badge>
                </View>

                <Text variant="caption" tone="tertiary">
                  {ROLE_BLURB[role] ?? 'Console access.'}
                </Text>
              </View>
            </Surface>
          </Animated.View>

          {/* ── Accountability ── */}
          <Animated.View entering={FadeInDown.delay(60).duration(320)}>
            <Surface tone="subtle" level="none" padded="base" rounded="lg">
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Icon name="shield" size={16} color={color.accent} filled />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  Every action you take in the console — status changes, payments
                  recorded, approvals — is logged against your name with a
                  timestamp.
                </Text>
              </View>
            </Surface>
          </Animated.View>

          {/* ── Security ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Security</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <Row
                icon="lock"
                label="Change your password"
                hint="Sends a code to your work email"
                onPress={() => router.push('/(auth)/forgot-password?audience=staff' as never)}
                last
              />
            </Surface>
          </Animated.View>

          {/* ── Changes ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Your details</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.md }}>
                <Detail label="Name"  value={name || '—'} />
                <Detail label="Email" value={user?.email ?? '—'} />
                <Detail label="Role"  value={role.toLowerCase()} />
              </View>
            </Surface>

            <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs }}>
              <Icon name="info" size={13} color={color.textDisabled} />
              <Text variant="caption" tone="disabled" style={{ flex: 1 }}>
                Staff records are maintained by the office. Ask them, or email{' '}
                {SUPPORT_EMAIL}, to change your name, email or role.
              </Text>
            </View>

            <Button
              variant="secondary"
              fullWidth
              onPress={() => void Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Account change request')}`,
              )}
              icon={<Icon name="email" size={16} color={color.text} />}
            >
              Request a change
            </Button>
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

/**
 * A tappable settings row.
 *
 * `Pressable`, not `Button` — `Button` sizes itself to a fixed height for a
 * single line of label text, so a row with a title *and* a hint gets its second
 * line clipped. `minHeight` lets this grow to fit whatever it holds while still
 * guaranteeing a 44pt target.
 */
function Row({ icon, label, hint, onPress, last = false }: {
  icon: IconName; label: string; hint: string; onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.base,
        paddingVertical: space.md,
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

      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="tertiary">{hint}</Text>
      </View>

      <Icon name="chevron-right" size={15} color={color.textDisabled} />
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.base }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant="callout" style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
