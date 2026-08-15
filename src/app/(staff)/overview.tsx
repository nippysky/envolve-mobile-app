/**
 * Console overview.
 *
 * `/api/reports/summary` already scopes itself by role — a staff member gets
 * figures filtered through their assigned customers, an admin gets the
 * platform. The response carries `scope` so this screen can say which it's
 * showing rather than leaving a rep to wonder whose revenue they're looking at.
 *
 * The action strip below the KPIs is the point of the screen. Someone opening
 * the console on a phone is almost always doing one of three things: placing an
 * order for a customer on the phone to them, approving a pharmacy that just
 * signed up, or chasing a delivery. Those get buttons; everything else is a tab
 * away.
 */

import React, { useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Pressable, Icon, Surface, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatTile } from '@/components/admin/StatTile';
import { Sparkline } from '@/components/admin/Sparkline';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useAuth } from '@/contexts/AuthContext';
import { getReportSummary, listCustomers, AWAITING_REVIEW } from '@/lib/services/admin.service';
import { useUnreadCount } from '@/hooks/use-unread-count';
import { NotificationBell } from '@/components/shared/NotificationBell';
import type { IconName } from '@/components/ui/Icon';

const PERIODS = [
  { value: 7,  label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export default function OverviewScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [period, setPeriod] = useState(30);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const summaryQ = useQuery({
    queryKey: ['reports', 'summary', period],
    queryFn:  () => getReportSummary(period),
    staleTime: 60_000,
  });

  // Pending reviews drive the approvals badge. `limit: 1` because only the
  // total is needed — pulling a page of records to count them would be waste.
  const pendingQ = useQuery({
    queryKey: ['customers', 'pending-count'],
    queryFn:  () => listCustomers({ status: AWAITING_REVIEW, limit: 1 }),
    staleTime: 30_000,
  });

  const { unread, refetch: refetchUnread } = useUnreadCount();

  const s        = summaryQ.data;
  const loading  = summaryQ.isLoading;
  const pending  = pendingQ.data?.pagination.total ?? 0;
  const isAdmin  = user?.role === 'ADMIN';

  const inFlight = useMemo(() => {
    if (!s) return 0;
    return s.ordersByStatus
      .filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.count, 0);
  }, [s]);


  const { refreshing, onRefresh } = useRefresh(summaryQ.refetch, pendingQ.refetch, refetchUnread);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          eyebrow={s ? (s.scope === 'staff' ? 'Your accounts' : 'Platform') : undefined}
          title={`Hello, ${user?.first_name ?? 'there'}`}
          subtitle={
            s?.scope === 'staff'
              ? 'Figures below cover the customers assigned to you.'
              : 'Figures below cover the whole platform.'
          }
          scrollY={scrollY}
          right={
            <NotificationBell
              count={unread}
              onPress={() => router.push('/(staff)/notifications' as never)}
            />
          }
        />

        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: layout.tabBarHeight + space['2xl'],
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand}
            />
          }
        >
          {/* ── Quick actions ── */}
          <Animated.View entering={FadeInDown.duration(320)} style={{ gap: space.sm }}>
            <QuickAction
              icon="cart"
              title="Place an order for a customer"
              hint="They're on the phone — take it now"
              tone="brand"
              onPress={() => router.push('/(staff)/orders/new' as never)}
            />
            {pending > 0 ? (
              <QuickAction
                icon="user-plus"
                title={pending === 1 ? '1 pharmacy awaiting review' : `${pending} pharmacies awaiting review`}
                hint="Verify PCN certificates and approve"
                tone="warning"
                badge={pending}
                onPress={() => router.push(`/(staff)/customers?status=${AWAITING_REVIEW}` as never)}
              />
            ) : null}
          </Animated.View>

          {/* ── Period ── */}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {PERIODS.map(p => {
              const active = period === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPeriod(p.value)}
                  haptic="light"
                  pressScale={0.95}
                  style={{
                    paddingHorizontal: space.md, height: 32,
                    justifyContent: 'center', borderRadius: radius.full,
                    backgroundColor: active ? color.text : color.surface,
                    borderWidth: layout.hairlineWidth,
                    borderColor: active ? color.text : color.border,
                  }}
                >
                  <Text variant="caption" style={{
                    color: active ? '#fff' : color.textSecondary,
                    fontWeight: active ? '700' : '500',
                  }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {summaryQ.isError ? (
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Couldn’t load your figures"
              subtitle="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => void summaryQ.refetch()}
            />
          ) : (
            <>
              {/* ── KPIs ── */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                <StatTile
                  index={0}
                  icon="money"
                  label="Revenue"
                  value={formatNaira(s?.kpis.revenue ?? 0)}
                  trend={s?.kpis.revenueTrend}
                  loading={loading}
                />
                <StatTile
                  index={1}
                  icon="orders"
                  label="Orders"
                  value={String(s?.kpis.orders ?? 0)}
                  trend={s?.kpis.ordersTrend}
                  loading={loading}
                />
                <StatTile
                  index={2}
                  icon="chart"
                  label="Average order"
                  value={formatNaira(s?.kpis.avgOrderValue ?? 0)}
                  hint="Across the period"
                  loading={loading}
                />
                <StatTile
                  index={3}
                  icon="customers"
                  label="New customers"
                  value={String(s?.kpis.newCustomers ?? 0)}
                  trend={s?.kpis.newCustomersTrend}
                  loading={loading}
                />
              </View>

              {/* ── Revenue shape ── */}
              <Animated.View entering={FadeInDown.delay(120).duration(340)} style={{ gap: space.sm }}>
                <Text variant="overline" tone="tertiary">Revenue by day</Text>
                <Surface level="sm" padded="base" rounded="lg">
                  {loading
                    ? <Skeleton width="100%" height={84} radius="md" />
                    : <Sparkline data={s?.revenueByDay ?? []} />}
                </Surface>
              </Animated.View>

              {/* ── Live operations ── */}
              <Animated.View entering={FadeInDown.delay(160).duration(340)} style={{ gap: space.sm }}>
                <Text variant="overline" tone="tertiary">Right now</Text>
                <Surface level="sm" padded="none" rounded="lg">
                  <LiveRow
                    icon="orders"
                    label="Orders in flight"
                    value={String(inFlight)}
                    hint="Not yet delivered or cancelled"
                    onPress={() => router.push('/(staff)/orders' as never)}
                  />
                  <LiveRow
                    icon="truck"
                    label="Active shipments"
                    value={String(s?.kpis.activeShipments ?? 0)}
                    hint="Assigned or on the road"
                    onPress={() => router.push('/(staff)/deliveries' as never)}
                  />
                  <LiveRow
                    icon="customers"
                    label="Total customers"
                    value={String(s?.kpis.totalCustomers ?? 0)}
                    hint={s?.scope === 'staff' ? 'Assigned to you' : 'All pharmacies'}
                    onPress={() => router.push('/(staff)/customers' as never)}
                    last
                  />
                </Surface>
              </Animated.View>

              {/* ── Top customers ── */}
              {s && s.topCustomers.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(200).duration(340)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Top customers</Text>
                  <Surface level="sm" padded="none" rounded="lg">
                    {s.topCustomers.slice(0, 5).map((c, i, arr) => (
                      <RankRow
                        key={c.id}
                        rank={i + 1}
                        title={c.company ?? c.name}
                        subtitle={`${c.orders} ${c.orders === 1 ? 'order' : 'orders'}`}
                        value={formatNaira(c.revenue)}
                        last={i === arr.length - 1}
                      />
                    ))}
                  </Surface>
                </Animated.View>
              ) : null}

              {/* ── Top products ── */}
              {s && s.topProducts.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(240).duration(340)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Top products</Text>
                  <Surface level="sm" padded="none" rounded="lg">
                    {s.topProducts.slice(0, 5).map((p, i, arr) => (
                      <RankRow
                        key={p.id}
                        rank={i + 1}
                        title={p.name}
                        subtitle={`${p.units} ${p.units === 1 ? 'pack' : 'packs'} · ${p.sku}`}
                        value={formatNaira(p.revenue)}
                        onPress={() => router.push(`/(staff)/products/${encodeURIComponent(p.sku)}` as never)}
                        last={i === arr.length - 1}
                      />
                    ))}
                  </Surface>
                </Animated.View>
              ) : null}

              {isAdmin ? (
                <Pressable
                  onPress={() => router.push('/(staff)/reports' as never)}
                  haptic="light"
                  pressOpacity={0.6}
                  style={{ alignItems: 'center', paddingVertical: space.md }}
                >
                  <Text variant="label" tone="brand">See the full report</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function QuickAction({ icon, title, hint, tone, badge, onPress }: {
  icon: IconName;
  title: string;
  hint: string;
  tone: 'brand' | 'warning';
  badge?: number;
  onPress: () => void;
}) {
  const bg     = tone === 'brand' ? color.text : color.warningSoft;
  const fg     = tone === 'brand' ? '#fff' : '#92400e';
  const subFg  = tone === 'brand' ? 'rgba(255,255,255,0.62)' : '#a16207';
  const chipBg = tone === 'brand' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.6)';

  return (
    <Pressable
      onPress={onPress}
      haptic="medium"
      pressScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        padding: space.base,
        borderRadius: radius.lg,
        backgroundColor: bg,
        borderWidth: tone === 'warning' ? layout.hairlineWidth : 0,
        borderColor: '#fde68a',
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: radius.full,
        backgroundColor: chipBg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={17} color={fg} filled />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" style={{ color: fg }}>{title}</Text>
        <Text variant="caption" style={{ color: subFg }}>{hint}</Text>
      </View>

      {badge ? (
        <View style={{
          minWidth: 24, height: 24, paddingHorizontal: 7,
          borderRadius: radius.full, backgroundColor: color.warning,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text variant="caption" style={{ color: '#fff', fontWeight: '800' }}>{badge}</Text>
        </View>
      ) : (
        <Icon name="chevron-right" size={17} color={subFg} />
      )}
    </Pressable>
  );
}

function LiveRow({ icon, label, value, hint, onPress, last = false }: {
  icon: IconName; label: string; value: string; hint: string;
  onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
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
        <Text variant="caption" tone="tertiary">{hint}</Text>
      </View>
      <Text variant="title3">{value}</Text>
      <Icon name="chevron-right" size={15} color={color.textDisabled} />
    </Pressable>
  );
}

function RankRow({ rank, title, subtitle, value, onPress, last = false }: {
  rank: number; title: string; subtitle: string; value: string;
  onPress?: () => void; last?: boolean;
}) {
  const body = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.md,
      paddingHorizontal: space.base, paddingVertical: space.md,
      borderBottomWidth: last ? 0 : layout.hairlineWidth,
      borderBottomColor: color.borderSubtle,
    }}>
      <View style={{
        width: 22, height: 22, borderRadius: radius.full,
        backgroundColor: rank <= 3 ? color.brandSoft : color.surfaceMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text variant="caption" style={{
          fontSize: 11, fontWeight: '700',
          color: rank <= 3 ? color.brand : color.textTertiary,
        }}>
          {rank}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>{title}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>{subtitle}</Text>
      </View>

      <Text variant="bodyMedium">{value}</Text>
    </View>
  );

  return onPress
    ? <Pressable onPress={onPress} haptic="light" pressOpacity={0.6}>{body}</Pressable>
    : body;
}
