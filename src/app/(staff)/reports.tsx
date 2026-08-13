/**
 * Reports.
 *
 * The same `/api/reports/summary` the overview uses, given room to show the
 * breakdowns the overview can only hint at. The endpoint self-scopes by role,
 * so a rep sees their own book here without a filter and without being able to
 * remove one.
 *
 * Admins additionally get a per-rep view via `staff_id`. That's the one place
 * this screen does something the overview can't, and it's the reason it exists
 * separately rather than being a longer overview.
 *
 * Bars are drawn as proportional fills rather than a charting library. At this
 * width a labelled horizontal bar is more readable than a pie or donut, and it
 * degrades gracefully to a single row when there's one category.
 */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Pressable, Icon, Surface, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatTile } from '@/components/admin/StatTile';
import { Sparkline } from '@/components/admin/Sparkline';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { getReportSummary, listStaff } from '@/lib/services/admin.service';

const PERIODS = [
  { value: 7,  label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export default function ReportsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [period, setPeriod] = useState(30);
  const [repId,  setRepId]  = useState<number | null>(null);

  const repsQ = useQuery({
    queryKey: ['staff', 'reps'],
    queryFn:  () => listStaff({ role: 'STAFF', limit: 100 }),
    enabled:  isAdmin,
    staleTime: 5 * 60_000,
  });

  const summaryQ = useQuery({
    queryKey: ['reports', 'summary', period, repId],
    queryFn:  () => getReportSummary(period, repId ?? undefined),
    staleTime: 60_000,
  });

  const s       = summaryQ.data;
  const loading = summaryQ.isLoading;

  const categoryMax = useMemo(
    () => Math.max(...(s?.revenueByCategory.map(c => c.revenue) ?? [0]), 0),
    [s],
  );

  const statusTotal = useMemo(
    () => (s?.ordersByStatus ?? []).reduce((sum, o) => sum + o.count, 0),
    [s],
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Reports"
          subtitle={s ? (s.scope === 'staff' ? 'Your accounts' : 'Platform-wide') : undefined}
        />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: layout.tabBarHeight + space['2xl'],
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={summaryQ.isRefetching}
              onRefresh={() => void summaryQ.refetch()}
              tintColor={color.brand}
            />
          }
        >
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
                    flex: 1, height: 34,
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: radius.full,
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

          {/* ── Rep filter (admin) ── */}
          {isAdmin && (repsQ.data?.records.length ?? 0) > 0 ? (
            <View style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Sales rep</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}
              >
                <Pressable
                  onPress={() => setRepId(null)}
                  haptic="light"
                  pressScale={0.95}
                  style={repChip(repId === null)}
                >
                  <Text variant="caption" style={repText(repId === null)}>Everyone</Text>
                </Pressable>

                {(repsQ.data?.records ?? []).map(rep => (
                  <Pressable
                    key={rep.id}
                    onPress={() => setRepId(rep.id)}
                    haptic="light"
                    pressScale={0.95}
                    style={repChip(repId === rep.id)}
                  >
                    <Text variant="caption" style={repText(repId === rep.id)}>
                      {rep.first_name} {rep.last_name[0]}.
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {summaryQ.isError ? (
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Couldn’t load the report"
              actionLabel="Retry"
              onAction={() => void summaryQ.refetch()}
            />
          ) : (
            <>
              {/* ── KPIs ── */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                <StatTile index={0} icon="money" label="Revenue"
                  value={formatNaira(s?.kpis.revenue ?? 0)}
                  trend={s?.kpis.revenueTrend} loading={loading} />
                <StatTile index={1} icon="orders" label="Orders"
                  value={String(s?.kpis.orders ?? 0)}
                  trend={s?.kpis.ordersTrend} loading={loading} />
                <StatTile index={2} icon="chart" label="Average order"
                  value={formatNaira(s?.kpis.avgOrderValue ?? 0)}
                  hint="Per order" loading={loading} />
                <StatTile index={3} icon="customers" label="New customers"
                  value={String(s?.kpis.newCustomers ?? 0)}
                  trend={s?.kpis.newCustomersTrend} loading={loading} />
              </View>

              {/* ── Revenue ── */}
              <Animated.View entering={FadeInDown.delay(100).duration(320)} style={{ gap: space.sm }}>
                <Text variant="overline" tone="tertiary">Revenue by day</Text>
                <Surface level="sm" padded="base" rounded="lg">
                  {loading
                    ? <Skeleton width="100%" height={84} radius="md" />
                    : <Sparkline data={s?.revenueByDay ?? []} height={100} />}
                </Surface>
              </Animated.View>

              {/* ── Category mix ── */}
              {s && s.revenueByCategory.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(140).duration(320)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Revenue by category</Text>
                  <Surface level="sm" padded="base" rounded="lg">
                    <View style={{ gap: space.md }}>
                      {s.revenueByCategory.slice(0, 8).map((c, i) => (
                        <Bar
                          key={c.category}
                          index={i}
                          label={c.category || 'Uncategorised'}
                          value={formatNaira(c.revenue)}
                          fraction={categoryMax > 0 ? c.revenue / categoryMax : 0}
                        />
                      ))}
                    </View>
                  </Surface>
                </Animated.View>
              ) : null}

              {/* ── Order mix ── */}
              {s && s.ordersByStatus.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(180).duration(320)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Orders by status</Text>
                  <Surface level="sm" padded="base" rounded="lg">
                    <View style={{ gap: space.md }}>
                      {s.ordersByStatus.map((o, i) => (
                        <Bar
                          key={o.status}
                          index={i}
                          label={o.status.toLowerCase()}
                          value={`${o.count} (${statusTotal > 0 ? Math.round((o.count / statusTotal) * 100) : 0}%)`}
                          fraction={statusTotal > 0 ? o.count / statusTotal : 0}
                          tone="accent"
                        />
                      ))}
                    </View>
                  </Surface>
                </Animated.View>
              ) : null}

              {/* ── Delivery mix ── */}
              {s && s.deliveryMetrics.byStatus.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(220).duration(320)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Deliveries by status</Text>
                  <Surface level="sm" padded="none" rounded="lg">
                    {s.deliveryMetrics.byStatus.map((d, i, arr) => (
                      <View
                        key={d.status}
                        style={{
                          flexDirection: 'row', justifyContent: 'space-between',
                          paddingHorizontal: space.base, paddingVertical: space.md,
                          borderBottomWidth: i === arr.length - 1 ? 0 : layout.hairlineWidth,
                          borderBottomColor: color.borderSubtle,
                        }}
                      >
                        <Text variant="callout" tone="tertiary">
                          {d.status.replace(/_/g, ' ').toLowerCase()}
                        </Text>
                        <Text variant="bodyMedium">{d.count}</Text>
                      </View>
                    ))}
                  </Surface>
                </Animated.View>
              ) : null}

              {/* ── Top customers ── */}
              {s && s.topCustomers.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(260).duration(320)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Top customers</Text>
                  <Surface level="sm" padded="none" rounded="lg">
                    {s.topCustomers.map((c, i, arr) => (
                      <Rank
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
                <Animated.View entering={FadeInDown.delay(300).duration(320)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Top products</Text>
                  <Surface level="sm" padded="none" rounded="lg">
                    {s.topProducts.map((p, i, arr) => (
                      <Rank
                        key={p.id}
                        rank={i + 1}
                        title={p.name}
                        subtitle={`${p.units} packs · ${p.sku}`}
                        value={formatNaira(p.revenue)}
                        last={i === arr.length - 1}
                      />
                    ))}
                  </Surface>
                </Animated.View>
              ) : null}

              {!loading && s && s.kpis.orders === 0 ? (
                <EmptyState
                  iconName="chart"
                  compact
                  title="No trading in this period"
                  subtitle="Try a longer window, or check back once orders come in."
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function repChip(active: boolean) {
  return {
    paddingHorizontal: space.md,
    height: 30,
    justifyContent: 'center' as const,
    borderRadius: radius.full,
    backgroundColor: active ? color.brandSoft : color.surface,
    borderWidth: layout.hairlineWidth,
    borderColor: active ? color.brand : color.border,
  };
}

function repText(active: boolean) {
  return {
    color: active ? color.brand : color.textSecondary,
    fontWeight: (active ? '700' : '500') as '700' | '500',
  };
}

function Bar({ index, label, value, fraction, tone = 'brand' }: {
  index: number; label: string; value: string; fraction: number;
  tone?: 'brand' | 'accent';
}) {
  return (
    <Animated.View entering={FadeIn.delay(index * 45).duration(300)} style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="caption" tone="tertiary">{value}</Text>
      </View>
      <View style={{
        height: 6, borderRadius: radius.full,
        backgroundColor: color.surfaceMuted, overflow: 'hidden',
      }}>
        <View style={{
          // Floor at 2% so a tiny-but-nonzero value stays visible.
          width: `${Math.max(fraction * 100, fraction > 0 ? 2 : 0)}%`,
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: tone === 'accent' ? color.accent : color.brand,
        }} />
      </View>
    </Animated.View>
  );
}

function Rank({ rank, title, subtitle, value, last }: {
  rank: number; title: string; subtitle: string; value: string; last: boolean;
}) {
  return (
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
}
