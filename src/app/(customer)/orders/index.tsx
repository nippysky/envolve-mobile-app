/**
 * Order history.
 *
 * Each card leads with the thing the customer opened the screen to find out —
 * where the order is right now — and treats the order number as a reference,
 * not a headline. The product thumbnails act as the recognition cue; people
 * remember what they bought long before they remember ENV-2026-000147.
 *
 * The filter rail is client-side over the fetched pages rather than a server
 * round-trip. `/api/orders/my` doesn't take a status filter, and adding one to
 * the web for a list this short would be a worse trade than filtering here.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

import {
  Text, Pressable, Icon, Surface, Badge, StatusBadge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { listMyOrders, type OrderSummary } from '@/lib/services/orders.service';

type Filter = 'all' | 'active' | 'delivered' | 'cancelled';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

function matches(order: OrderSummary, filter: Filter): boolean {
  switch (filter) {
    case 'delivered': return order.status === 'DELIVERED';
    case 'cancelled': return order.status === 'CANCELLED';
    case 'active':    return order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
    default:          return true;
  }
}

export default function OrdersScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const ordersQ = useInfiniteQuery({
    queryKey: ['orders', 'mine'],
    queryFn:  ({ pageParam = 1 }) => listMyOrders(pageParam as number, 10),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const all = useMemo(
    () => ordersQ.data?.pages.flatMap(p => p.records) ?? [],
    [ordersQ.data],
  );

  const orders = useMemo(() => all.filter(o => matches(o, filter)), [all, filter]);

  const openOrder = useCallback((id: number) => {
    router.push(`/(customer)/orders/${id}` as never);
  }, [router]);

  const hasAnyOrders = all.length > 0;


  const { refreshing, onRefresh } = useRefresh(ordersQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          title="Orders"
          subtitle={hasAnyOrders ? `${all.length} placed` : undefined}
          scrollY={scrollY}
          right={
            <Pressable
              onPress={() => router.push('/(customer)/track' as never)}
              haptic="light"
              pressScale={0.92}
              accessibilityRole="button"
              accessibilityLabel="Track an order"
              style={{
                width: 40, height: 40, borderRadius: radius.full,
                backgroundColor: color.surface,
                borderWidth: layout.hairlineWidth,
                borderColor: color.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="track" size={18} color={color.text} />
            </Pressable>
          }
        />

        {hasAnyOrders ? (
          <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: gutter, paddingVertical: space.md }}>
            {FILTERS.map(f => {
              const active = filter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
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
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Animated.FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: layout.tabBarHeight + space.xl,
            gap: space.md,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (ordersQ.hasNextPage && !ordersQ.isFetchingNextPage) {
              void ordersQ.fetchNextPage();
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
            <OrderCard order={item} index={index} onPress={() => openOrder(item.id)} />
          )}
          ListEmptyComponent={
            ordersQ.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : ordersQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load your orders"
                subtitle="Check your connection and try again."
                actionLabel="Retry"
                onAction={() => void ordersQ.refetch()}
              />
            ) : hasAnyOrders ? (
              <EmptyState
                iconName="filter"
                compact
                title="Nothing here"
                subtitle="No orders match this filter."
                actionLabel="Show all orders"
                onAction={() => setFilter('all')}
              />
            ) : (
              <EmptyState
                iconName="orders"
                tone="brand"
                title="No orders yet"
                subtitle="Your first order will appear here once you check out."
                actionLabel="Browse the catalogue"
                onAction={() => router.push('/(customer)/catalog' as never)}
              />
            )
          }
          ListFooterComponent={
            ordersQ.isFetchingNextPage ? <RowSkeleton /> : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────── */

function OrderCard({ order, index, onPress }: {
  order: OrderSummary;
  index: number;
  onPress: () => void;
}) {
  // Delivery status is the more specific signal once a delivery exists.
  const showDelivery = !!order.delivery_status
    && order.status !== 'CANCELLED'
    && order.status !== 'DELIVERED';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(340)}>
      <Pressable onPress={onPress} haptic="light" pressScale={0.985}>
        <Surface level="sm" padded="base" rounded="lg">
          <View style={{ gap: space.md }}>
            {/* Top row */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <StatusBadge status={order.status} kind="order" size="sm" />
                  {showDelivery ? (
                    <StatusBadge status={order.delivery_status!} kind="delivery" size="sm" />
                  ) : null}
                  {order.payment_status === 'UNPAID' ? (
                    <Badge tone="warning" size="sm">Awaiting payment</Badge>
                  ) : null}
                </View>
                <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
                  {order.order_number} · {formatDate(order.created_at)}
                </Text>
              </View>

              <Icon name="chevron-right" size={16} color={color.textDisabled} />
            </View>

            {/* Items */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flexDirection: 'row' }}>
                {order.preview_items.slice(0, 3).map((it, i) => (
                  <View
                    key={`${it.sku}-${i}`}
                    style={{
                      width: 40, height: 40,
                      borderRadius: radius.sm,
                      backgroundColor: color.surfaceSubtle,
                      borderWidth: 2, borderColor: color.surface,
                      marginLeft: i === 0 ? 0 : -10,
                      alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {it.primary_image ? (
                      <Image
                        source={{ uri: it.primary_image }}
                        style={{ width: '76%', height: '76%' }}
                        contentFit="contain"
                        transition={180}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Icon name="product" size={16} color={color.textDisabled} />
                    )}
                  </View>
                ))}
              </View>

              <Text variant="caption" tone="tertiary" style={{ flex: 1 }} numberOfLines={1}>
                {order.preview_items[0]?.brand_name ?? 'Order items'}
                {order.preview_items.length > 1
                  ? ` +${order.preview_items.length - 1} more`
                  : ''}
              </Text>

              <Text variant="headline">{formatNaira(order.total)}</Text>
            </View>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}
