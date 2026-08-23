/**
 * Order detail — console.
 *
 * Reuses the customer's `GET /api/orders/:id` (it's ownership-checked, and
 * staff pass the check) but presents it as a control surface: the actions come
 * first, the record second.
 *
 * Two rules encoded here that the API also enforces, so the UI never offers
 * something that will 403:
 *
 *   • **Manual payment confirmation is on-behalf only.** Orders a customer
 *     placed themselves are settled by the Paystack webhook. The action is
 *     hidden unless `placed_by` is set, rather than shown-and-rejected.
 *   • **Status moves forward.** The picker offers the next legal states plus
 *     cancel, not the whole enum. Letting someone set a dispatched order back
 *     to pending invites exactly the kind of inconsistency the audit trail
 *     then has to explain.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, StatusBadge, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber } from '@/lib/contact';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { getOrder } from '@/lib/services/orders.service';
import {
  updateOrderStatus, confirmOrderPayment, type OrderStatus,
} from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';

/** Legal forward transitions. Cancel is offered separately. */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    ['CONFIRMED'],
  CONFIRMED:  ['PROCESSING'],
  PROCESSING: ['DISPATCHED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:    'Pending',
  CONFIRMED:  'Confirm order',
  PROCESSING: 'Start packing',
  DISPATCHED: 'Mark dispatched',
  DELIVERED:  'Mark delivered',
  CANCELLED:  'Cancel order',
};

const RECEIVED_VIA = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Transfer' },
  { value: 'pos',           label: 'POS' },
  { value: 'other',         label: 'Other' },
] as const;

export default function ConsoleOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [busy,      setBusy]      = useState(false);
  const [payOpen,   setPayOpen]   = useState(false);
  const [via,       setVia]       = useState<typeof RECEIVED_VIA[number]['value']>('bank_transfer');
  const [reference, setReference] = useState('');
  const [payNote,   setPayNote]   = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn:  () => getOrder(String(id)),
    enabled:  !!id,
  });

  const order = data?.order;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  const moveStatus = useCallback(async (next: OrderStatus) => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.id, next);
      await invalidate();
      toast.success(`Order moved to ${next.toLowerCase()}.`);
    } catch (err) {
      toast.error((err as Error).message, 'Could not update status');
    } finally {
      setBusy(false);
    }
  }, [order, busy, invalidate]);

  const confirmCancel = useCallback(() => {
    if (!order) return;
    Alert.alert(
      `Cancel ${order.order_number}?`,
      'Reserved stock is released and the customer is notified. This cannot be undone.',
      [
        { text: 'Keep order', style: 'cancel' },
        { text: 'Cancel order', style: 'destructive', onPress: () => void moveStatus('CANCELLED') },
      ],
    );
  }, [order, moveStatus]);

  const settlePayment = useCallback(async () => {
    if (!order || busy) return;
    if (reference.trim().length < 2) {
      toast.error('Enter the teller, POS or transfer reference.', 'Reference required');
      return;
    }
    setBusy(true);
    try {
      await confirmOrderPayment(order.id, {
        received_via:      via,
        payment_reference: reference.trim(),
        payment_note:      payNote.trim() || undefined,
      });
      await invalidate();
      setPayOpen(false);
      setReference('');
      setPayNote('');
      toast.success('Payment recorded against this order.', 'Marked paid');
    } catch (err) {
      toast.error((err as Error).message, 'Could not confirm payment');
    } finally {
      setBusy(false);
    }
  }, [order, busy, reference, via, payNote, invalidate]);

  const itemCount = useMemo(
    () => order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
    [order],
  );

  const { refreshing, onRefresh } = useRefresh(refetch);

  /* ── Loading / error ── */
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Order" />
          <View style={{ padding: gutter, gap: space.base }}>
            <Skeleton width="100%" height={110} radius="lg" />
            <Skeleton width="100%" height={200} radius="lg" />
            <Skeleton width="100%" height={160} radius="lg" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Order" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Couldn’t load this order"
              actionLabel="Try again"
              onAction={() => void refetch()}
              secondaryLabel="Back to orders"
              onSecondary={() => router.replace('/(staff)/orders' as never)}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const customerName = order.customer.company_name
    ?? `${order.customer.first_name} ${order.customer.last_name}`.trim();

  const address = [order.delivery_address, order.delivery_city, order.delivery_state]
    .filter(Boolean).join(', ');

  const nextStates  = NEXT_STATUS[order.status];
  const canCancel   = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const isOnBehalf  = !!order.placed_by;
  const canSettle   = isOnBehalf
    && order.payment_status !== 'PAID'
    && order.status !== 'CANCELLED';


  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title={order.order_number}
          subtitle={formatDate(order.created_at)}
        />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: space['3xl'],
          }}
          // iOS insets the scroll view for the keyboard itself, which avoids the
          // KeyboardAvoidingView offset guesswork. Android is adjustResize (see
          // AndroidManifest), so the window already shrinks and this is a no-op.
          automaticallyAdjustKeyboardInsets
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
          {/* ── Status ── */}
          <Animated.View entering={FadeInDown.duration(320)} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <StatusBadge status={order.status} kind="order" />
              <StatusBadge status={order.payment_status} kind="payment" />
              {order.delivery ? <StatusBadge status={order.delivery.status} kind="delivery" /> : null}
            </View>

            {order.placed_by ? (
              <Surface tone="info" level="none" padded="md" rounded="md">
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Icon name="team" size={16} color={color.info} filled />
                  <Text variant="caption" style={{ flex: 1, color: '#155e75' }}>
                    Placed on the customer’s behalf by {order.placed_by.name} (
                    {order.placed_by.role.toLowerCase()}).
                  </Text>
                </View>
              </Surface>
            ) : null}
          </Animated.View>

          {/* ── Actions ── */}
          <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Actions</Text>

            {nextStates.length === 0 && !canCancel && !canSettle ? (
              <Surface tone="subtle" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Icon name="check-circle" size={16} color={color.success} filled />
                  <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                    This order is settled. Nothing further to do.
                  </Text>
                </View>
              </Surface>
            ) : (
              <View style={{ gap: space.sm }}>
                {nextStates.map(next => (
                  <Button
                    key={next}
                    size="lg"
                    fullWidth
                    haptic="medium"
                    loading={busy}
                    disabled={busy}
                    onPress={() => void moveStatus(next)}
                    icon={<Icon name="check" size={16} color="#fff" />}
                  >
                    {STATUS_LABEL[next]}
                  </Button>
                ))}

                {canSettle ? (
                  <Button
                    variant={payOpen ? 'secondary' : 'tinted'}
                    fullWidth
                    onPress={() => setPayOpen(o => !o)}
                    disabled={busy}
                    icon={<Icon name="money" size={16} color={payOpen ? color.text : color.brand} />}
                  >
                    {payOpen ? 'Cancel' : 'Record payment received'}
                  </Button>
                ) : null}

                {canCancel ? (
                  <Button
                    variant="ghost"
                    fullWidth
                    onPress={confirmCancel}
                    disabled={busy}
                  >
                    <Text variant="bodyMedium" tone="danger">Cancel order</Text>
                  </Button>
                ) : null}
              </View>
            )}

            {/* Why the settle action is missing on a self-served unpaid order. */}
            {!isOnBehalf && order.payment_status !== 'PAID' && order.status !== 'CANCELLED' ? (
              <Surface tone="subtle" level="none" padded="md" rounded="md">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="lock" size={14} color={color.textTertiary} />
                  <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                    The customer placed this order themselves, so Paystack settles it
                    automatically. Payment can’t be set by hand here.
                  </Text>
                </View>
              </Surface>
            ) : null}
          </Animated.View>

          {/* ── Record payment form ── */}
          {payOpen && canSettle ? (
            <Animated.View entering={FadeInDown.duration(280)}>
              <Surface level="sm" padded="base" rounded="lg">
                <View style={{ gap: space.base }}>
                  <Text variant="headline">Record payment</Text>
                  <Text variant="caption" tone="tertiary">
                    This writes to the audit trail against your name. Use the actual
                    reference from the teller slip, POS receipt or transfer.
                  </Text>

                  <View style={{ gap: space.sm }}>
                    <Text variant="label" tone="secondary">Received via</Text>
                    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                      {RECEIVED_VIA.map(v => {
                        const active = via === v.value;
                        return (
                          <Pressable
                            key={v.value}
                            onPress={() => setVia(v.value)}
                            haptic="light"
                            pressScale={0.95}
                            disabled={busy}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            style={{
                              paddingHorizontal: space.base, height: 36,
                              justifyContent: 'center', borderRadius: radius.full,
                              backgroundColor: active ? color.brandSoft : color.surface,
                              borderWidth: active ? 1.5 : layout.hairlineWidth,
                              borderColor: active ? color.brand : color.border,
                            }}
                          >
                            <Text variant="caption" style={{
                              color: active ? color.brand : color.textSecondary,
                              fontWeight: active ? '700' : '500',
                            }}>
                              {v.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <Input
                    label="Payment reference"
                    placeholder="Teller no. / POS slip / transfer ref"
                    value={reference}
                    onChangeText={setReference}
                    autoCapitalize="characters"
                    editable={!busy}
                    required
                  />

                  <Input
                    label="Note"
                    placeholder="Optional context for the audit trail"
                    value={payNote}
                    onChangeText={setPayNote}
                    editable={!busy}
                    multiline
                  />

                  <Button
                    fullWidth
                    loading={busy}
                    disabled={busy || reference.trim().length < 2}
                    onPress={settlePayment}
                    haptic="medium"
                  >
                    Confirm {formatNaira(order.total)} received
                  </Button>
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── Progress ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Progress</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <OrderTimeline
                status={order.status}
                deliveryStatus={order.delivery?.status ?? null}
                placedAt={order.created_at}
                dispatchedAt={order.delivery?.dispatched_at ?? null}
                deliveredAt={order.delivery?.delivered_at ?? null}
              />
            </Surface>
          </Animated.View>

          {/* ── Customer ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Customer</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.md }}>
                <Pressable
                  onPress={() => router.push(`/(staff)/customers/${order.customer.id}` as never)}
                  haptic="light"
                  pressOpacity={0.6}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium">{customerName}</Text>
                      <Text variant="caption" tone="tertiary">{order.customer.email}</Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={color.textDisabled} />
                  </View>
                </Pressable>

                {order.customer.phone ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => void callNumber(order.customer.phone)}
                    icon={<Icon name="phone" size={14} color={color.text} />}
                  >
                    {order.customer.phone}
                  </Button>
                ) : null}

                <View style={{
                  height: layout.hairlineWidth,
                  backgroundColor: color.borderSubtle,
                }} />

                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <Icon name="location" size={16} color={color.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" tone="tertiary">Deliver to</Text>
                    <Text variant="callout">{address || 'No address on file'}</Text>
                  </View>
                </View>

                {order.notes ? (
                  <View style={{ flexDirection: 'row', gap: space.md }}>
                    <Icon name="document" size={16} color={color.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" tone="tertiary">Notes</Text>
                      <Text variant="callout">{order.notes}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </Surface>
          </Animated.View>

          {/* ── Delivery ── */}
          {order.delivery ? (
            <Animated.View entering={FadeInDown.delay(180).duration(320)} style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Delivery</Text>
              <Surface level="sm" padded="base" rounded="lg">
                <View style={{ gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Icon name="track" size={16} color={color.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" tone="tertiary">Tracking code</Text>
                      <Text variant="mono">{order.delivery.tracking_code}</Text>
                    </View>
                  </View>

                  {order.delivery.driver ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <Icon name="truck" size={16} color={color.textTertiary} />
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" tone="tertiary">Driver</Text>
                        <Text variant="callout">{order.delivery.driver.name}</Text>
                      </View>
                      {order.delivery.driver.phone ? (
                        <Button
                          size="sm"
                          variant="tinted"
                          onPress={() => void callNumber(order.delivery?.driver?.phone)}
                          icon={<Icon name="phone" size={14} color={color.brand} />}
                        >
                          Call
                        </Button>
                      ) : null}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => router.push('/(staff)/deliveries' as never)}
                      haptic="light"
                      pressOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                        <Icon name="alert" size={16} color={color.warning} filled />
                        <Text variant="callout" tone="warning" style={{ flex: 1 }}>
                          No driver assigned yet
                        </Text>
                        <Text variant="label" tone="brand">Assign</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── Items ── */}
          <Animated.View entering={FadeInDown.delay(220).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Items ({itemCount})</Text>
            <Surface level="sm" padded="none" rounded="lg">
              {order.items.map((item, i) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row', gap: space.md,
                    padding: space.base,
                    borderBottomWidth: i === order.items.length - 1 ? 0 : layout.hairlineWidth,
                    borderBottomColor: color.borderSubtle,
                  }}
                >
                  <View style={{
                    width: 48, height: 48, borderRadius: radius.md,
                    backgroundColor: color.surfaceSubtle,
                    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {item.product.primary_image ? (
                      <Image
                        source={{ uri: item.product.primary_image }}
                        style={{ width: '76%', height: '76%' }}
                        contentFit="contain"
                        transition={180}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <Icon name="product" size={19} color={color.textDisabled} />
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyMedium" numberOfLines={2}>{item.product.brand_name}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {item.product.sku}
                      {item.product.shelf_location ? ` · shelf ${item.product.shelf_location}` : ''}
                    </Text>
                    <Text variant="caption" tone="disabled">
                      {item.quantity} × {formatNaira(item.unit_price)}
                    </Text>
                    {item.product.batch_number ? (
                      <Text variant="caption" tone="disabled">
                        Batch {item.product.batch_number}
                        {item.product.expiry_date ? ` · exp ${formatDate(item.product.expiry_date)}` : ''}
                      </Text>
                    ) : null}
                  </View>

                  <Text variant="bodyMedium">{formatNaira(item.subtotal)}</Text>
                </View>
              ))}
            </Surface>
          </Animated.View>

          {/* ── Totals ── */}
          <Animated.View entering={FadeInDown.delay(260).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Payment</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.sm }}>
                <TotalRow label="Subtotal" value={formatNaira(order.subtotal)} />
                {order.discount > 0 ? (
                  <TotalRow label="Discount" value={`− ${formatNaira(order.discount)}`} />
                ) : null}
                <TotalRow label="Delivery" value={formatNaira(order.delivery_fee)} />

                <View style={{
                  height: layout.hairlineWidth,
                  backgroundColor: color.borderSubtle,
                  marginVertical: space.xs,
                }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text variant="bodyMedium">Total</Text>
                  <Text variant="title3">{formatNaira(order.total)}</Text>
                </View>

                {order.payment_reference ? (
                  <View style={{ marginTop: space.sm }}>
                    <Text variant="caption" tone="tertiary">Reference</Text>
                    <Text variant="mono" tone="secondary">{order.payment_reference}</Text>
                  </View>
                ) : null}
              </View>
            </Surface>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant="callout">{value}</Text>
    </View>
  );
}
