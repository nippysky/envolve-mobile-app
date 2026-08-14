/**
 * Deliveries — console.
 *
 * A dispatch board. Sorted by the API newest-first, filtered by status, and
 * with the two actions that actually move work along inline on each card:
 * assign a driver, and advance the status.
 *
 * Two things the API enforces that this screen encodes rather than discovers:
 *
 *   • **`driver_id` is the driver-table id.** `/api/staff` returns drivers with
 *     both `id` (the user id) and `driver_record_id`. Passing the wrong one
 *     assigns nobody, or the wrong person. The picker sends
 *     `driver_record_id`.
 *   • **`cash_collected` is explicit.** Marking a delivery DELIVERED does not
 *     imply money changed hands. For a cash-on-delivery order the driver is
 *     asked separately, because a handover without collection must not leave
 *     the books showing paid.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, StatusBadge,
  EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber } from '@/lib/contact';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listDeliveries, updateDelivery, listStaff,
  type AdminDelivery, type DeliveryStatus,
} from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';

const STATUSES: { value: DeliveryStatus | null; label: string }[] = [
  { value: null,                label: 'All' },
  { value: 'AWAITING_DISPATCH', label: 'Awaiting dispatch' },
  { value: 'ASSIGNED',          label: 'Assigned' },
  { value: 'IN_TRANSIT',        label: 'In transit' },
  { value: 'OUT_FOR_DELIVERY',  label: 'Out for delivery' },
  { value: 'DELIVERED',         label: 'Delivered' },
  { value: 'FAILED',            label: 'Failed' },
  { value: 'RETURNED',          label: 'Returned' },
];

/** Legal forward moves. Failed and returned are offered from any live state. */
const NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  AWAITING_DISPATCH: ['IN_TRANSIT'],
  ASSIGNED:          ['IN_TRANSIT'],
  IN_TRANSIT:        ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY:  ['DELIVERED'],
  DELIVERED:         [],
  FAILED:            [],
  RETURNED:          [],
};

const NEXT_LABEL: Record<DeliveryStatus, string> = {
  AWAITING_DISPATCH: 'Awaiting dispatch',
  ASSIGNED:          'Assigned',
  IN_TRANSIT:        'Mark in transit',
  OUT_FOR_DELIVERY:  'Out for delivery',
  DELIVERED:         'Mark delivered',
  FAILED:            'Mark failed',
  RETURNED:          'Mark returned',
};

export default function DeliveriesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [rawSearch, setRawSearch] = useState('');
  const [status,    setStatus]    = useState<DeliveryStatus | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [busyId,    setBusyId]    = useState<number | null>(null);

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const deliveriesQ = useInfiniteQuery({
    queryKey: ['deliveries', 'console', search, status],
    queryFn:  ({ pageParam = 1 }) =>
      listDeliveries({ page: pageParam as number, limit: 20, search, status }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 20_000,
  });

  // Drivers for the assignment sheet — only fetched once a card opens one.
  const driversQ = useQuery({
    queryKey: ['staff', 'drivers'],
    queryFn:  () => listStaff({ role: 'DRIVER', limit: 100 }),
    enabled:  assigning !== null,
    staleTime: 5 * 60_000,
  });

  const deliveries = useMemo(
    () => deliveriesQ.data?.pages.flatMap(p => p.records) ?? [],
    [deliveriesQ.data],
  );

  const total    = deliveriesQ.data?.pages[0]?.pagination.total ?? 0;
  const filtered = !!search || !!status;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  const assignDriver = useCallback(async (deliveryId: number, driverRecordId: number | null) => {
    setBusyId(deliveryId);
    try {
      await updateDelivery(deliveryId, { driver_id: driverRecordId });
      await invalidate();
      setAssigning(null);
      toast.success(driverRecordId ? 'Driver assigned.' : 'Driver removed.');
    } catch (err) {
      toast.error((err as Error).message, 'Could not assign driver');
    } finally {
      setBusyId(null);
    }
  }, [invalidate]);

  const move = useCallback(async (
    delivery: AdminDelivery,
    next: DeliveryStatus,
    cashCollected?: boolean,
  ) => {
    setBusyId(delivery.id);
    try {
      await updateDelivery(delivery.id, { status: next, cash_collected: cashCollected });
      await invalidate();
      toast.success(`Marked ${next.replace(/_/g, ' ').toLowerCase()}.`);
    } catch (err) {
      toast.error((err as Error).message, 'Could not update delivery');
    } finally {
      setBusyId(null);
    }
  }, [invalidate]);

  /**
   * Delivering an unpaid order forks: the driver either collected the cash or
   * didn't, and only they know. Asking is the whole point — inferring would put
   * unverified money on the books.
   */
  const completeDelivery = useCallback((delivery: AdminDelivery) => {
    const unpaid = delivery.order?.payment_status !== 'PAID';
    if (!unpaid) { void move(delivery, 'DELIVERED'); return; }

    Alert.alert(
      'Was payment collected?',
      `${delivery.order?.order_number ?? 'This order'} is marked unpaid. Did the driver collect ${formatNaira(delivery.order?.total ?? 0)} at handover?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'No — still unpaid', onPress: () => void move(delivery, 'DELIVERED', false) },
        { text: 'Yes — cash collected', onPress: () => void move(delivery, 'DELIVERED', true) },
      ],
    );
  }, [move]);

  const markFailed = useCallback((delivery: AdminDelivery) => {
    Alert.alert(
      'Delivery failed?',
      'The customer is notified and the order stays open for a second attempt.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark failed', style: 'destructive', onPress: () => void move(delivery, 'FAILED') },
      ],
    );
  }, [move]);


  const { refreshing, onRefresh } = useRefresh(deliveriesQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Deliveries"
          subtitle={total > 0 ? `${total.toLocaleString()} matching` : undefined}
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <Input
            placeholder="Tracking code or order number"
            value={rawSearch}
            onChangeText={setRawSearch}
            autoCapitalize="characters"
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
            {STATUSES.map(s => {
              const active = status === s.value;
              return (
                <Pressable
                  key={s.label}
                  onPress={() => setStatus(s.value)}
                  haptic="light"
                  pressScale={0.95}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
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
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        </View>

        <Animated.FlatList
          data={deliveries}
          keyExtractor={d => String(d.id)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
            gap: space.md,
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
            <DeliveryCard
              delivery={item}
              index={index}
              busy={busyId === item.id}
              assigning={assigning === item.id}
              drivers={driversQ.data?.records ?? []}
              driversLoading={driversQ.isLoading}
              onToggleAssign={() => setAssigning(a => (a === item.id ? null : item.id))}
              onPickDriver={driverRecordId => void assignDriver(item.id, driverRecordId)}
              onAdvance={next =>
                next === 'DELIVERED' ? completeDelivery(item) : void move(item, next)}
              onFail={() => markFailed(item)}
              onOpenOrder={() => item.order && router.push(`/(staff)/orders/${item.order.id}` as never)}
            />
          )}
          ListEmptyComponent={
            deliveriesQ.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : deliveriesQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load deliveries"
                actionLabel="Retry"
                onAction={() => void deliveriesQ.refetch()}
              />
            ) : filtered ? (
              <EmptyState
                iconName="filter"
                compact
                title="Nothing matches"
                actionLabel="Clear filters"
                onAction={() => { setRawSearch(''); setStatus(null); }}
              />
            ) : (
              <EmptyState
                iconName="truck"
                tone="brand"
                title="No deliveries yet"
                subtitle="A delivery is created when an order is confirmed."
              />
            )
          }
          ListFooterComponent={deliveriesQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>
    </View>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────── */

function DeliveryCard({
  delivery, index, busy, assigning, drivers, driversLoading,
  onToggleAssign, onPickDriver, onAdvance, onFail, onOpenOrder,
}: {
  delivery: AdminDelivery;
  index: number;
  busy: boolean;
  assigning: boolean;
  drivers: { id: number; first_name: string; last_name: string; phone: string | null; driver_record_id: number | null; vehicle_plate: string | null }[];
  driversLoading: boolean;
  onToggleAssign: () => void;
  onPickDriver: (driverRecordId: number | null) => void;
  onAdvance: (next: DeliveryStatus) => void;
  onFail: () => void;
  onOpenOrder: () => void;
}) {
  const order    = delivery.order;
  const customer = order?.customer;
  const name = customer
    ? (customer.company_name ?? `${customer.first_name} ${customer.last_name}`.trim())
    : 'Unknown customer';

  const address = [order?.delivery_address, order?.delivery_city, order?.delivery_state]
    .filter(Boolean).join(', ');

  const nextStates = NEXT[delivery.status];
  const isLive = delivery.status !== 'DELIVERED'
    && delivery.status !== 'FAILED'
    && delivery.status !== 'RETURNED';

  const unpaid = order?.payment_status !== 'PAID';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}>
      <Surface level="sm" padded="base" rounded="lg">
        <View style={{ gap: space.md }}>
          {/* Head */}
          <Pressable onPress={onOpenOrder} haptic="light" pressOpacity={0.7}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {order?.order_number ?? '—'} · {delivery.tracking_code}
                </Text>
              </View>
              <Text variant="headline">{formatNaira(order?.total ?? 0)}</Text>
            </View>
          </Pressable>

          {/* Status */}
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <StatusBadge status={delivery.status} kind="delivery" size="sm" />
            {order ? <StatusBadge status={order.payment_status} kind="payment" size="sm" /> : null}
            {unpaid && isLive ? <Badge tone="warning" size="sm">Collect on delivery</Badge> : null}
          </View>

          {/* Address */}
          {address ? (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Icon name="location" size={14} color={color.textTertiary} />
              <Text variant="caption" tone="tertiary" style={{ flex: 1 }} numberOfLines={2}>
                {address}
              </Text>
            </View>
          ) : null}

          {/* Driver */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            paddingTop: space.sm,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.borderSubtle,
          }}>
            <View style={{
              width: 30, height: 30, borderRadius: radius.full,
              backgroundColor: delivery.driver ? color.accentSoft : color.warningSoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon
                name={delivery.driver ? 'truck' : 'alert'}
                size={14}
                color={delivery.driver ? color.accent : color.warning}
                filled
              />
            </View>

            <View style={{ flex: 1 }}>
              {delivery.driver ? (
                <>
                  <Text variant="callout" numberOfLines={1}>
                    {delivery.driver.first_name} {delivery.driver.last_name}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {delivery.driver.phone ?? 'No phone on file'}
                  </Text>
                </>
              ) : (
                <Text variant="callout" tone="warning">No driver assigned</Text>
              )}
            </View>

            {delivery.driver?.phone ? (
              <Pressable
                onPress={() => void callNumber(delivery.driver?.phone)}
                haptic="light"
                pressScale={0.92}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Call driver"
                style={{
                  width: 32, height: 32, borderRadius: radius.full,
                  backgroundColor: color.brandSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="phone" size={14} color={color.brand} />
              </Pressable>
            ) : null}

            {isLive ? (
              <Pressable onPress={onToggleAssign} haptic="light" pressOpacity={0.6} hitSlop={8} disabled={busy}>
                <Text variant="label" tone="brand">
                  {assigning ? 'Close' : delivery.driver ? 'Change' : 'Assign'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Driver picker */}
          {assigning ? (
            <Animated.View entering={FadeIn.duration(220)} style={{ gap: space.xs }}>
              <View style={{ height: layout.hairlineWidth, backgroundColor: color.borderSubtle }} />

              {driversLoading ? (
                <RowSkeleton />
              ) : drivers.length === 0 ? (
                <Text variant="caption" tone="tertiary" style={{ paddingVertical: space.md }}>
                  No drivers on the team yet. Add one from Team.
                </Text>
              ) : (
                <>
                  {drivers
                    // A driver with no driver record can't be assigned — the
                    // API keys assignment on the driver table, not the user.
                    .filter(d => d.driver_record_id !== null)
                    .map(d => {
                      const active = delivery.driver?.id === d.driver_record_id;
                      return (
                        <Pressable
                          key={d.id}
                          onPress={() => onPickDriver(d.driver_record_id)}
                          haptic="light"
                          pressOpacity={0.6}
                          disabled={busy}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: space.md,
                            paddingVertical: space.md, minHeight: layout.tapTarget,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text variant="body">{d.first_name} {d.last_name}</Text>
                            <Text variant="caption" tone="tertiary">
                              {d.vehicle_plate ?? 'No vehicle on file'}
                            </Text>
                          </View>
                          {active ? <Icon name="check" size={16} color={color.brand} /> : null}
                        </Pressable>
                      );
                    })}

                  {delivery.driver ? (
                    <Pressable
                      onPress={() => onPickDriver(null)}
                      haptic="light"
                      pressOpacity={0.6}
                      disabled={busy}
                      style={{ paddingVertical: space.md }}
                    >
                      <Text variant="label" tone="danger">Unassign</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </Animated.View>
          ) : null}

          {/* Actions */}
          {isLive ? (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {nextStates.map(next => (
                <Button
                  key={next}
                  size="sm"
                  style={{ flex: 1 }}
                  loading={busy}
                  disabled={busy || (!delivery.driver && next !== 'DELIVERED')}
                  onPress={() => onAdvance(next)}
                  haptic="medium"
                >
                  {NEXT_LABEL[next]}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onPress={onFail}
                disabled={busy}
              >
                <Text variant="caption" tone="danger">Failed</Text>
              </Button>
            </View>
          ) : delivery.delivered_at ? (
            <Text variant="caption" tone="tertiary">
              Delivered {formatDate(delivery.delivered_at)}
            </Text>
          ) : null}

          {/* Why the advance button is disabled */}
          {isLive && !delivery.driver && nextStates.length > 0 ? (
            <Text variant="caption" tone="disabled">
              Assign a driver before dispatching.
            </Text>
          ) : null}
        </View>
      </Surface>
    </Animated.View>
  );
}
