/**
 * The run — one delivery, driver's view.
 *
 * Built as a single primary action at the bottom of the screen that changes
 * with the state of the run: start it, mark it out for delivery, complete it.
 * A driver should never have to work out which button applies.
 *
 * ## The cash question
 *
 * Completing a delivery on an unpaid order asks, explicitly, whether money was
 * collected. It is not inferred from the handover, and there is no default.
 *
 * That matters because `cash_collected: true` marks the *order* PAID and writes
 * an audit entry against the driver's name. A driver who hands over a box
 * without taking payment — because the pharmacist will transfer later, because
 * the manager wasn't in — must not silently settle the books. And a driver who
 * did collect must be able to say so on the spot, or the money goes missing
 * from the record.
 *
 * The API refuses to infer it too; this screen just makes the question
 * unavoidable rather than letting it be skipped.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, StatusBadge,
  Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber } from '@/lib/contact';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import {
  listMyDeliveries, updateMyDelivery, DRIVER_NEXT, SETTLED,
  type DeliveryStatus,
} from '@/lib/services/driver.service';
import { openDirections } from '@/lib/directions';
import { toast } from '@/lib/toast';

const ACTION_LABEL: Record<DeliveryStatus, string> = {
  AWAITING_DISPATCH: 'Awaiting dispatch',
  ASSIGNED:          'Assigned',
  IN_TRANSIT:        'Start this run',
  OUT_FOR_DELIVERY:  'I’ve arrived — out for delivery',
  DELIVERED:         'Complete delivery',
  FAILED:            'Couldn’t deliver',
  RETURNED:          'Returned',
};

export default function DriverRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [busy,     setBusy]     = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [failNote, setFailNote] = useState('');

  const deliveryId = Number(id);

  /**
   * There's no `GET /api/deliveries/:id`, only the scoped list — so the run is
   * read out of the driver's own list rather than fetched alone. Paging until
   * found keeps it correct for a driver with a long history, and the list is
   * already cached from the previous screen in the common case.
   */
  const deliveriesQ = useInfiniteQuery({
    queryKey: ['deliveries', 'mine', 'all'],
    queryFn:  ({ pageParam = 1 }) => listMyDeliveries({ page: pageParam as number, limit: 50 }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 15_000,
  });

  const delivery = useMemo(
    () => deliveriesQ.data?.pages.flatMap(p => p.records).find(d => d.id === deliveryId),
    [deliveriesQ.data, deliveryId],
  );

  // Not on this page and more pages exist — keep paging until it turns up.
  // In an effect, not during render: fetching is a side effect, and React may
  // render a component more than once per commit.
  const searching = !delivery && deliveriesQ.hasNextPage;

  useEffect(() => {
    if (searching && !deliveriesQ.isFetchingNextPage) {
      void deliveriesQ.fetchNextPage();
    }
  }, [searching, deliveriesQ]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  }, [queryClient]);

  const move = useCallback(async (
    next: DeliveryStatus,
    opts: { cashCollected?: boolean; notes?: string } = {},
  ) => {
    if (!delivery || busy) return;
    setBusy(true);
    try {
      await updateMyDelivery(delivery.id, {
        status:         next,
        cash_collected: opts.cashCollected,
        notes:          opts.notes,
      });
      await invalidate();
      setFailOpen(false);
      setFailNote('');

      toast.success(
        next === 'DELIVERED'
          ? (opts.cashCollected ? 'Delivered and payment recorded.' : 'Delivered.')
          : `Marked ${next.replace(/_/g, ' ').toLowerCase()}.`,
      );

      if (SETTLED.includes(next)) router.back();
    } catch (err) {
      toast.error((err as Error).message, 'Could not update');
    } finally {
      setBusy(false);
    }
  }, [delivery, busy, invalidate, router]);

  /**
   * Completing an unpaid order forks on a question only the driver can answer.
   * Both branches are explicit — there is no "just mark delivered" shortcut
   * that quietly picks one.
   */
  const complete = useCallback(() => {
    if (!delivery) return;
    const unpaid = delivery.order?.payment_status !== 'PAID';

    if (!unpaid) { void move('DELIVERED'); return; }

    Alert.alert(
      'Did you collect payment?',
      `${formatNaira(delivery.order?.total ?? 0)} is outstanding on ${delivery.order?.order_number ?? 'this order'}. `
      + 'Only say yes if you have the money — this marks the order paid against your name.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'No — still unpaid',
          onPress: () => void move('DELIVERED', { cashCollected: false }),
        },
        {
          text: 'Yes — I collected it',
          onPress: () => void move('DELIVERED', { cashCollected: true }),
        },
      ],
    );
  }, [delivery, move]);

  const { refreshing, onRefresh } = useRefresh(deliveriesQ.refetch);

  /* ── Loading ── */
  if (deliveriesQ.isLoading || searching) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Delivery" />
          <View style={{ padding: gutter, gap: space.base }}>
            <Skeleton width="100%" height={130} radius="lg" />
            <Skeleton width="100%" height={190} radius="lg" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ── Not found ── */
  if (!delivery) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Delivery" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Run not found"
              subtitle="It may have been reassigned to another driver."
              actionLabel="Refresh"
              onAction={() => void deliveriesQ.refetch()}
              secondaryLabel="Back to today"
              onSecondary={() => router.replace('/(driver)/deliveries' as never)}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const order    = delivery.order;
  const customer = order?.customer;
  const name = customer
    ? (customer.company_name ?? `${customer.first_name} ${customer.last_name}`.trim())
    : 'Unknown pharmacy';

  const address = [order?.delivery_address, order?.delivery_city, order?.delivery_state]
    .filter(Boolean).join(', ');

  const unpaid     = order?.payment_status !== 'PAID';
  const nextStates = DRIVER_NEXT[delivery.status] ?? [];
  const forward    = nextStates.find(s => s !== 'FAILED');
  const canFail    = nextStates.includes('FAILED');
  const settled    = SETTLED.includes(delivery.status);


  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title={order?.order_number ?? 'Delivery'}
          subtitle={delivery.tracking_code}
        />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: settled ? space.xl : 220,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand}
            />
          }
        >
          {/* ── Payment banner — the thing most likely to go wrong ── */}
          {unpaid && !settled ? (
            <Animated.View entering={FadeInDown.duration(320)}>
              <Surface tone="warning" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: radius.full,
                    backgroundColor: color.warning,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="money" size={18} color="#fff" filled />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="title3" style={{ color: '#92400e' }}>
                      Collect {formatNaira(order?.total ?? 0)}
                    </Text>
                    <Text variant="caption" style={{ color: '#a16207' }}>
                      This order is unpaid. You’ll be asked to confirm when you complete it.
                    </Text>
                  </View>
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── Where ── */}
          <Animated.View entering={FadeInDown.delay(40).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Deliver to</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.md }}>
                <View>
                  <Text variant="title3" numberOfLines={2}>{name}</Text>
                  {address ? (
                    <Text variant="callout" tone="tertiary" style={{ marginTop: 2 }}>
                      {address}
                    </Text>
                  ) : (
                    <Text variant="callout" tone="disabled">No address on file</Text>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {customer?.phone ? (
                    <Button
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => void callNumber(customer.phone)}
                      icon={<Icon name="phone" size={15} color={color.text} />}
                    >
                      Call
                    </Button>
                  ) : null}
                  {address ? (
                    <Button
                      style={{ flex: 1.2 }}
                      onPress={() => openDirections(address)}
                      haptic="medium"
                      icon={<Icon name="location" size={15} color="#fff" />}
                    >
                      Directions
                    </Button>
                  ) : null}
                </View>
              </View>
            </Surface>
          </Animated.View>

          {/* ── Status ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(320)} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <StatusBadge status={delivery.status} kind="delivery" />
              {order ? <StatusBadge status={order.payment_status} kind="payment" /> : null}
            </View>

            <Surface level="sm" padded="base" rounded="lg">
              <OrderTimeline
                status={order?.order_status ?? 'CONFIRMED'}
                deliveryStatus={delivery.status}
                dispatchedAt={delivery.dispatched_at}
                deliveredAt={delivery.delivered_at}
              />
            </Surface>
          </Animated.View>

          {/* ── Order facts ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Order</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.md }}>
                <Fact label="Order number" value={order?.order_number ?? '—'} mono />
                <Fact label="Tracking code" value={delivery.tracking_code} mono />
                <Fact label="Value" value={formatNaira(order?.total ?? 0)} />
                {delivery.dispatched_at ? (
                  <Fact label="Dispatched" value={formatDate(delivery.dispatched_at)} />
                ) : null}
                {delivery.delivered_at ? (
                  <Fact label="Delivered" value={formatDate(delivery.delivered_at)} />
                ) : null}
                {delivery.notes ? <Fact label="Notes" value={delivery.notes} /> : null}
              </View>
            </Surface>
          </Animated.View>

          {/* ── Failure form ── */}
          {failOpen ? (
            <Animated.View entering={FadeIn.duration(240)}>
              <Surface tone="danger" level="none" padded="base" rounded="lg">
                <View style={{ gap: space.base }}>
                  <Text variant="bodyMedium" style={{ color: '#991b1b' }}>
                    What went wrong?
                  </Text>
                  <Text variant="caption" style={{ color: '#b91c1c' }}>
                    Dispatch sees this and will rearrange. The order stays open.
                  </Text>
                  <Input
                    placeholder="e.g. Premises closed, nobody to receive"
                    value={failNote}
                    onChangeText={setFailNote}
                    editable={!busy}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Button
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => { setFailOpen(false); setFailNote(''); }}
                      disabled={busy}
                    >
                      Back
                    </Button>
                    <Button
                      variant="danger"
                      style={{ flex: 1 }}
                      loading={busy}
                      disabled={busy || failNote.trim().length < 3}
                      onPress={() => void move('FAILED', { notes: failNote.trim() })}
                    >
                      Report
                    </Button>
                  </View>
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {settled ? (
            <Surface tone="subtle" level="none" padded="base" rounded="lg">
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <Icon
                  name={delivery.status === 'DELIVERED' ? 'check-circle' : 'alert'}
                  size={17}
                  color={delivery.status === 'DELIVERED' ? color.success : color.warning}
                  filled
                />
                <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                  This run is closed. Nothing further to do.
                </Text>
              </View>
            </Surface>
          ) : null}
        </ScrollView>

        {/* ── Action bar ── */}
        {!settled ? (
          <View
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              paddingHorizontal: gutter,
              paddingTop: space.base,
              paddingBottom: Math.max(insets.bottom, space.base),
              backgroundColor: color.surface,
              borderTopWidth: layout.hairlineWidth,
              borderTopColor: color.border,
              gap: space.sm,
            }}
          >
            {forward ? (
              <Button
                size="lg"
                fullWidth
                haptic="medium"
                loading={busy}
                disabled={busy || failOpen}
                onPress={() => (forward === 'DELIVERED' ? complete() : void move(forward))}
                icon={<Icon name={forward === 'DELIVERED' ? 'check' : 'truck'} size={17} color="#fff" />}
              >
                {ACTION_LABEL[forward]}
              </Button>
            ) : (
              <Surface tone="subtle" level="none" padded="md" rounded="md">
                <Text variant="caption" tone="tertiary" align="center">
                  Waiting on dispatch to assign this run to you.
                </Text>
              </Surface>
            )}

            {canFail && !failOpen ? (
              <Button
                variant="ghost"
                fullWidth
                size="sm"
                onPress={() => setFailOpen(true)}
                disabled={busy}
              >
                <Text variant="caption" tone="danger">Couldn’t deliver</Text>
              </Button>
            ) : null}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function Fact({ label, value, mono = false }: {
  label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.base }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text
        variant={mono ? 'mono' : 'callout'}
        style={{ flex: 1, textAlign: 'right' }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}
