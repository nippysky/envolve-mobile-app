/**
 * History — runs this driver has closed.
 *
 * Deliberately read-only. A driver can't reopen a delivered run, and the API
 * has no transition out of DELIVERED for them, so offering an action here would
 * be a button that always fails.
 *
 * The counters at the top are the numbers a driver actually gets asked about at
 * the end of a week: how many completed, how many failed, and how much cash
 * they were responsible for collecting.
 */

import React, { useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Pressable, Icon, Surface, StatusBadge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatTile } from '@/components/admin/StatTile';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import {
  listMyDeliveries, SETTLED, type DriverDelivery, type DeliveryStatus,
} from '@/lib/services/driver.service';

type Filter = 'all' | 'DELIVERED' | 'FAILED';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'FAILED',    label: 'Failed' },
];

export default function DriverHistoryScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const deliveriesQ = useInfiniteQuery({
    queryKey: ['deliveries', 'mine', 'history'],
    queryFn:  ({ pageParam = 1 }) => listMyDeliveries({ page: pageParam as number, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 60_000,
  });

  // Closed runs only — the live ones belong on Today.
  const settled = useMemo(
    () => (deliveriesQ.data?.pages.flatMap(p => p.records) ?? [])
      .filter(d => SETTLED.includes(d.status)),
    [deliveriesQ.data],
  );

  const shown = useMemo(
    () => (filter === 'all' ? settled : settled.filter(d => d.status === filter)),
    [settled, filter],
  );

  const stats = useMemo(() => {
    const delivered = settled.filter(d => d.status === 'DELIVERED');
    return {
      delivered: delivered.length,
      failed:    settled.filter(d => d.status === 'FAILED' || d.status === 'RETURNED').length,
      value:     delivered.reduce((s, d) => s + (d.order?.total ?? 0), 0),
    };
  }, [settled]);


  const { refreshing, onRefresh } = useRefresh(deliveriesQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          title="History"
          subtitle={settled.length > 0 ? `${settled.length} closed runs` : undefined}
          scrollY={scrollY}
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <StatTile
              index={0}
              icon="check-circle"
              label="Delivered"
              value={String(stats.delivered)}
              hint="Completed runs"
              loading={deliveriesQ.isLoading}
            />
            <StatTile
              index={1}
              icon="money"
              label="Value delivered"
              value={formatNaira(stats.value)}
              hint="Goods handed over"
              loading={deliveriesQ.isLoading}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {FILTERS.map(f => {
              const active = filter === f.value;
              const count = f.value === 'all' ? settled.length
                : f.value === 'DELIVERED' ? stats.delivered
                : stats.failed;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  haptic="light"
                  pressScale={0.95}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1, height: 34,
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 5,
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
                    {f.label}
                  </Text>
                  {count > 0 ? (
                    <Text variant="caption" style={{
                      fontSize: 10, fontWeight: '700',
                      color: active ? 'rgba(255,255,255,0.7)' : color.textTertiary,
                    }}>
                      {count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Animated.FlatList
          data={shown}
          keyExtractor={d => String(d.id)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: layout.tabBarHeight + space.xl,
            gap: space.sm,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (deliveriesQ.hasNextPage && !deliveriesQ.isFetchingNextPage) {
              void deliveriesQ.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand}
            />
          }
          renderItem={({ item, index }) => (
            <HistoryRow
              delivery={item}
              index={index}
              onPress={() => router.push(`/(driver)/deliveries/${item.id}` as never)}
            />
          )}
          ListEmptyComponent={
            deliveriesQ.isLoading ? (
              <View style={{ gap: space.sm }}>
                {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : deliveriesQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load your history"
                actionLabel="Retry"
                onAction={() => void deliveriesQ.refetch()}
              />
            ) : settled.length > 0 ? (
              <EmptyState
                iconName="filter"
                compact
                title="Nothing here"
                subtitle="No runs match this filter."
                actionLabel="Show all"
                onAction={() => setFilter('all')}
              />
            ) : (
              <EmptyState
                iconName="clipboard"
                title="No completed runs yet"
                subtitle="Deliveries appear here once you close them."
                actionLabel="See today’s runs"
                onAction={() => router.push('/(driver)/deliveries' as never)}
              />
            )
          }
          ListFooterComponent={deliveriesQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>
    </View>
  );
}

function HistoryRow({ delivery, index, onPress }: {
  delivery: DriverDelivery; index: number; onPress: () => void;
}) {
  const order    = delivery.order;
  const customer = order?.customer;
  const name = customer
    ? (customer.company_name ?? `${customer.first_name} ${customer.last_name}`.trim())
    : 'Unknown pharmacy';

  const closedAt = delivery.delivered_at ?? delivery.updated_at;
  const ok = delivery.status === 'DELIVERED';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
      <Pressable onPress={onPress} haptic="light" pressScale={0.985}>
        <Surface level="sm" padded="md" rounded="lg">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{
              width: 34, height: 34, borderRadius: radius.full,
              backgroundColor: ok ? color.successSoft : color.dangerSoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon
                name={ok ? 'check' : 'alert'}
                size={15}
                color={ok ? color.success : color.danger}
                filled
              />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {order?.order_number ?? delivery.tracking_code} · {formatDate(closedAt)}
              </Text>
              <View style={{ marginTop: 2 }}>
                <StatusBadge status={delivery.status} kind="delivery" size="sm" />
              </View>
            </View>

            <Text variant="bodyMedium" tone={ok ? 'default' : 'disabled'}>
              {formatNaira(order?.total ?? 0)}
            </Text>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}
