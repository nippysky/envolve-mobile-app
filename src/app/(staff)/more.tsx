/**
 * More — the console's secondary hub.
 *
 * Everything that doesn't earn a permanent tab: inventory, deliveries, team,
 * reports, settings, audit. Each row carries live context rather than just a
 * label — low-stock count, unassigned deliveries — so the hub answers "does
 * anything need me?" without being opened one screen at a time.
 *
 * ADMIN-only destinations are hidden rather than disabled. A greyed-out
 * Settings row tells a staff member the app has settings and they can't have
 * them, which is a worse experience than it simply not being their screen.
 */

import React from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Pressable, Icon, Surface, Badge,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  getInventoryStats, listDeliveries, listStaff,
} from '@/lib/services/admin.service';
import { getUnreadCount } from '@/lib/services/account.service';
import type { IconName } from '@/components/ui/Icon';

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'ADMIN';

  const statsQ = useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn:  getInventoryStats,
    staleTime: 60_000,
  });

  // Deliveries still awaiting dispatch are the operational backlog. `limit: 1`
  // because only the total is wanted.
  const awaitingQ = useQuery({
    queryKey: ['deliveries', 'awaiting-count'],
    queryFn:  () => listDeliveries({ status: 'AWAITING_DISPATCH', limit: 1 }),
    staleTime: 30_000,
  });

  const teamQ = useQuery({
    queryKey: ['staff', 'count'],
    queryFn:  () => listStaff({ limit: 1 }),
    enabled:  isAdmin,
    staleTime: 5 * 60_000,
  });

  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn:  getUnreadCount,
    staleTime: 30_000,
  });

  const lowStock  = statsQ.data?.low_stock_count ?? 0;
  const expiring  = statsQ.data?.expiring_count ?? 0;
  const awaiting  = awaitingQ.data?.pagination.total ?? 0;
  const teamSize  = teamQ.data?.pagination.total ?? 0;
  const unread    = unreadQ.data?.unread_count ?? 0;

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

  const refreshAll = () => {
    void statsQ.refetch();
    void awaitingQ.refetch();
    void unreadQ.refetch();
    if (isAdmin) void teamQ.refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader title="More" />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: layout.tabBarHeight + space['2xl'],
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={statsQ.isRefetching}
              onRefresh={refreshAll}
              tintColor={color.brand}
            />
          }
        >
          {/* ── Operations ── */}
          <Animated.View entering={FadeInDown.duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Operations</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <Row
                icon="truck"
                label="Deliveries"
                hint={awaiting > 0
                  ? `${awaiting} awaiting dispatch`
                  : 'Assign drivers and track shipments'}
                alert={awaiting > 0 ? awaiting : undefined}
                onPress={() => router.push('/(staff)/deliveries' as never)}
              />
              <Row
                icon="inventory"
                label="Inventory"
                hint={lowStock > 0 || expiring > 0
                  ? [
                      lowStock > 0 ? `${lowStock} low` : null,
                      expiring > 0 ? `${expiring} expiring` : null,
                    ].filter(Boolean).join(' · ')
                  : 'Batches, stock levels and expiry'}
                alert={lowStock > 0 ? lowStock : undefined}
                onPress={() => router.push('/(staff)/inventory' as never)}
              />
              <Row
                icon="products"
                label="Products"
                hint={isAdmin ? 'Catalogue, pricing and images' : 'Browse the catalogue'}
                onPress={() => router.push('/(staff)/products' as never)}
                last
              />
            </Surface>
          </Animated.View>

          {/* ── Insight ── */}
          <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Insight</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <Row
                icon="reports"
                label="Reports"
                hint={isAdmin ? 'Platform revenue and performance' : 'Your accounts’ performance'}
                onPress={() => router.push('/(staff)/reports' as never)}
                last={!isAdmin}
              />
              {isAdmin ? (
                <Row
                  icon="shield"
                  label="Audit trail"
                  hint="Who did what, and when"
                  onPress={() => router.push('/(staff)/audit' as never)}
                  last
                />
              ) : null}
            </Surface>
          </Animated.View>

          {/* ── Administration ── */}
          {isAdmin ? (
            <Animated.View entering={FadeInDown.delay(100).duration(320)} style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Administration</Text>
              <Surface level="sm" padded="none" rounded="lg">
                <Row
                  icon="team"
                  label="Team"
                  hint={teamSize > 0 ? `${teamSize} staff and drivers` : 'Staff and drivers'}
                  onPress={() => router.push('/(staff)/team' as never)}
                />
                <Row
                  icon="settings"
                  label="Settings"
                  hint="Company details, VAT, referrals"
                  onPress={() => router.push('/(staff)/settings' as never)}
                  last
                />
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── You ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">You</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <Row
                icon="notifications"
                label="Notifications"
                hint={unread > 0 ? `${unread} unread` : 'All caught up'}
                alert={unread > 0 ? unread : undefined}
                onPress={() => router.push('/(staff)/notifications' as never)}
              />
              <Row
                icon="profile"
                label="Your account"
                hint={user?.email ?? ''}
                onPress={() => router.push('/(staff)/profile' as never)}
                last
              />
            </Surface>
          </Animated.View>

          <Button
            variant="ghost"
            fullWidth
            onPress={confirmSignOut}
            icon={<Icon name="logout" size={16} color={color.danger} />}
          >
            <Text variant="bodyMedium" tone="danger">Sign out</Text>
          </Button>

          <Text variant="caption" tone="disabled" align="center">
            Signed in as {user?.first_name} {user?.last_name} · {user?.role?.toLowerCase()}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ icon, label, hint, alert, onPress, last = false }: {
  icon: IconName;
  label: string;
  hint: string;
  /** Renders a count chip and tints the glyph — use for things needing action. */
  alert?: number;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={alert ? `${label}, ${alert} need attention` : label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: space.base, paddingVertical: space.md,
        minHeight: layout.tapTarget,
        borderBottomWidth: last ? 0 : layout.hairlineWidth,
        borderBottomColor: color.borderSubtle,
      }}
    >
      <View style={{
        width: 34, height: 34, borderRadius: radius.full,
        backgroundColor: alert ? color.warningSoft : color.surfaceMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon
          name={icon}
          size={16}
          color={alert ? color.warning : color.textSecondary}
          filled={!!alert}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>{hint}</Text>
      </View>

      {alert ? (
        <Badge tone="warning" size="sm">{alert > 99 ? '99+' : alert}</Badge>
      ) : null}

      <Icon name="chevron-right" size={15} color={color.textDisabled} />
    </Pressable>
  );
}
