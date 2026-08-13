/**
 * Orders — console.
 *
 * Unlike the customer's order list, this one is a work queue. It leads with
 * search (staff arrive knowing an order number or a pharmacy name) and filters
 * on the two axes that actually decide what happens next: fulfilment status and
 * payment status.
 *
 * Both filters go to the server rather than being applied client-side. The
 * customer list can filter locally because a pharmacy has a handful of orders;
 * the console sees every order on the platform, so filtering a page of 20 would
 * just hide rows without finding the ones you wanted.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Surface, Badge, StatusBadge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira, formatDate } from '@/lib/format';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listOrders, type AdminOrder, type OrderStatus, type PaymentStatus,
} from '@/lib/services/admin.service';

const STATUSES: { value: OrderStatus | null; label: string }[] = [
  { value: null,         label: 'All' },
  { value: 'PENDING',    label: 'Pending' },
  { value: 'CONFIRMED',  label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Packing' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'DELIVERED',  label: 'Delivered' },
  { value: 'CANCELLED',  label: 'Cancelled' },
];

const PAYMENTS: { value: PaymentStatus | null; label: string }[] = [
  { value: null,       label: 'Any payment' },
  { value: 'UNPAID',   label: 'Unpaid' },
  { value: 'PAID',     label: 'Paid' },
  { value: 'FAILED',   label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export default function ConsoleOrdersScreen() {
  const router = useRouter();

  const [rawSearch, setRawSearch] = useState('');
  const [status,    setStatus]    = useState<OrderStatus | null>(null);
  const [payment,   setPayment]   = useState<PaymentStatus | null>(null);

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const ordersQ = useInfiniteQuery({
    queryKey: ['orders', 'console', search, status, payment],
    queryFn:  ({ pageParam = 1 }) => listOrders({
      page: pageParam as number, limit: 20, search, status, payment_status: payment,
    }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 20_000,
  });

  const orders = useMemo(
    () => ordersQ.data?.pages.flatMap(p => p.records) ?? [],
    [ordersQ.data],
  );

  const total = ordersQ.data?.pages[0]?.pagination.total ?? 0;
  const filtered = !!search || !!status || !!payment;

  const openOrder = useCallback((id: number) => {
    router.push(`/(staff)/orders/${id}` as never);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          title="Orders"
          subtitle={total > 0 ? `${total.toLocaleString()} matching` : undefined}
          scrollY={scrollY}
          right={
            <Pressable
              onPress={() => router.push('/(staff)/orders/new' as never)}
              haptic="medium"
              pressScale={0.92}
              accessibilityRole="button"
              accessibilityLabel="Place an order for a customer"
              style={{
                width: 40, height: 40, borderRadius: radius.full,
                backgroundColor: color.text,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="plus" size={18} color="#fff" />
            </Pressable>
          }
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <Input
            placeholder="Order number, pharmacy or contact"
            value={rawSearch}
            onChangeText={setRawSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            leading={<Icon name="search" size={17} color={color.textTertiary} />}
            trailing={rawSearch ? <Icon name="close" size={16} color={color.textTertiary} /> : undefined}
            onTrailingPress={rawSearch ? () => setRawSearch('') : undefined}
          />

          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
          >
            {STATUSES.map(s => (
              <Chip
                key={s.label}
                label={s.label}
                active={status === s.value}
                onPress={() => setStatus(s.value)}
              />
            ))}
          </Animated.ScrollView>

          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
          >
            {PAYMENTS.map(p => (
              <Chip
                key={p.label}
                label={p.label}
                active={payment === p.value}
                tone="soft"
                onPress={() => setPayment(p.value)}
              />
            ))}
          </Animated.ScrollView>
        </View>

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
              refreshing={ordersQ.isRefetching && !ordersQ.isFetchingNextPage}
              onRefresh={() => void ordersQ.refetch()}
              tintColor={color.brand}
            />
          }
          renderItem={({ item, index }) => (
            <OrderRow order={item} index={index} onPress={() => openOrder(item.id)} />
          )}
          ListEmptyComponent={
            ordersQ.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : ordersQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load orders"
                actionLabel="Retry"
                onAction={() => void ordersQ.refetch()}
              />
            ) : filtered ? (
              <EmptyState
                iconName="filter"
                compact
                title="No orders match"
                subtitle="Try a different search or clear the filters."
                actionLabel="Clear filters"
                onAction={() => { setRawSearch(''); setStatus(null); setPayment(null); }}
              />
            ) : (
              <EmptyState
                iconName="orders"
                tone="brand"
                title="No orders yet"
                subtitle="Orders placed by customers — or by your team on their behalf — appear here."
                actionLabel="Place an order"
                onAction={() => router.push('/(staff)/orders/new' as never)}
              />
            )
          }
          ListFooterComponent={ordersQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function Chip({ label, active, onPress, tone = 'solid' }: {
  label: string; active: boolean; onPress: () => void; tone?: 'solid' | 'soft';
}) {
  const activeBg = tone === 'solid' ? color.text : color.brandSoft;
  const activeFg = tone === 'solid' ? '#fff' : color.brand;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: space.md, height: 32,
        justifyContent: 'center', borderRadius: radius.full,
        backgroundColor: active ? activeBg : color.surface,
        borderWidth: layout.hairlineWidth,
        borderColor: active ? activeBg : color.border,
      }}
    >
      <Text variant="caption" style={{
        color: active ? activeFg : color.textSecondary,
        fontWeight: active ? '700' : '500',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function OrderRow({ order, index, onPress }: {
  order: AdminOrder; index: number; onPress: () => void;
}) {
  const customer = order.customer;
  const name = customer
    ? (customer.company_name ?? `${customer.first_name} ${customer.last_name}`.trim())
    : 'Unknown customer';

  const showDelivery = !!order.delivery
    && order.status !== 'CANCELLED'
    && order.status !== 'DELIVERED';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}>
      <Pressable onPress={onPress} haptic="light" pressScale={0.985}>
        <Surface level="sm" padded="base" rounded="lg">
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {order.order_number} · {formatDate(order.created_at)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="headline">{formatNaira(order.total)}</Text>
                <Text variant="caption" tone="disabled">
                  {order.item_count} {order.item_count === 1 ? 'line' : 'lines'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={order.status} kind="order" size="sm" />
              <StatusBadge status={order.payment_status} kind="payment" size="sm" />
              {showDelivery ? (
                <StatusBadge status={order.delivery!.status} kind="delivery" size="sm" />
              ) : null}
              {order.delivery && !order.delivery.driver_id ? (
                <Badge tone="warning" size="sm">No driver</Badge>
              ) : null}
            </View>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}
