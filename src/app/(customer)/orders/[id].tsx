/**
 * Order detail.
 *
 * Ordered by what the customer wants at each point in the order's life:
 * the timeline first (where is it), then delivery and driver contact, then the
 * line items and money, then the reference numbers.
 *
 * The tracking code copies on tap and the driver's number dials, because those
 * are the two things anyone ever actually does from this screen. Sharing the
 * whole order lives in the header, so the code row can stay a single
 * unambiguous action rather than a menu.
 *
 * Polling: an order that's in flight refreshes every 45s while the screen is
 * open. A settled one doesn't — there's nothing left to change, and polling a
 * finished order is just battery.
 */

import React, { useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Pressable, Icon, Surface, Badge, StatusBadge, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber } from '@/lib/contact';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { getOrder } from '@/lib/services/orders.service';
import { toast } from '@/lib/toast';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn:  () => getOrder(String(id)),
    enabled:  !!id,
    // Keep an in-flight order fresh; leave a settled one alone.
    refetchInterval: q => {
      const status = q.state.data?.order.status;
      return status && status !== 'DELIVERED' && status !== 'CANCELLED' ? 45_000 : false;
    },
  });

  const order = data?.order;

  const copyTracking = useCallback(async (code: string) => {
    await Clipboard.setStringAsync(code);
    toast.success('Tracking code copied to your clipboard.');
  }, []);

  const callDriver = useCallback((phone: string) => {
    void callNumber(phone);
  }, []);

  const shareOrder = useCallback(async () => {
    if (!order) return;
    await Share.share({
      message: order.delivery?.tracking_code
        ? `Envolve order ${order.order_number} — track it with code ${order.delivery.tracking_code}`
        : `Envolve order ${order.order_number}`,
    });
  }, [order]);

  const itemCount = useMemo(
    () => order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
    [order],
  );

  const { refreshing, onRefresh } = useRefresh(refetch);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Order" />
          <View style={{ padding: gutter, gap: space.base }}>
            <Skeleton width="100%" height={120} radius="lg" />
            <Skeleton width="100%" height={220} radius="lg" />
            <Skeleton width="100%" height={160} radius="lg" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ── Error ── */
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
              subtitle="It may have been removed, or your connection dropped."
              actionLabel="Try again"
              onAction={() => void refetch()}
              secondaryLabel="Back to orders"
              onSecondary={() => router.replace('/(customer)/orders' as never)}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const address = [order.delivery_address, order.delivery_city, order.delivery_state]
    .filter(Boolean).join(', ');


  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title={order.order_number}
          subtitle={formatDate(order.created_at)}
          right={
            <Pressable
              onPress={shareOrder}
              haptic="light"
              pressScale={0.92}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share order"
            >
              <Icon name="share" size={18} color={color.text} />
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space['2xl'] }}
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
              {order.delivery ? (
                <StatusBadge status={order.delivery.status} kind="delivery" />
              ) : null}
            </View>

            {order.placed_by ? (
              <Surface tone="info" level="none" padded="md" rounded="md">
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Icon name="team" size={16} color={color.info} filled />
                  <Text variant="caption" style={{ flex: 1, color: '#155e75' }}>
                    Placed for you by {order.placed_by.name} ({order.placed_by.role.toLowerCase()}).
                  </Text>
                </View>
              </Surface>
            ) : null}

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

          {/* ── Payment outstanding ── */}
          {order.payment_status === 'UNPAID' && order.status !== 'CANCELLED' ? (
            <Animated.View entering={FadeInDown.delay(60).duration(320)}>
              <Surface tone="warning" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="clock" size={17} color={color.warning} filled />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ color: '#92400e' }}>Payment outstanding</Text>
                    <Text variant="caption" style={{ color: '#a16207' }}>
                      We’ll confirm your order once payment clears. If you’ve already
                      transferred, our team will update this shortly.
                    </Text>
                  </View>
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── Delivery ── */}
          <Section title="Delivery" delay={100}>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.md }}>
                <Row icon="location" label="Address" value={address || 'Not provided'} />

                {order.notes ? <Row icon="document" label="Notes" value={order.notes} /> : null}

                {order.delivery?.tracking_code ? (
                  <Pressable
                    onPress={() => void copyTracking(order.delivery!.tracking_code)}
                    haptic="light"
                    pressOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <Icon name="track" size={16} color={color.textTertiary} />
                      <View style={{ flex: 1 }}>
                        <Text variant="caption" tone="tertiary">Tracking code</Text>
                        <Text variant="mono">{order.delivery.tracking_code}</Text>
                      </View>
                      <Icon name="copy" size={16} color={color.brand} />
                    </View>
                  </Pressable>
                ) : null}

                {order.delivery?.driver ? (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md,
                    paddingTop: space.md,
                    borderTopWidth: layout.hairlineWidth,
                    borderTopColor: color.borderSubtle,
                  }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: radius.full,
                      backgroundColor: color.accentSoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="truck" size={17} color={color.accent} filled />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" tone="tertiary">Your driver</Text>
                      <Text variant="bodyMedium">{order.delivery.driver.name}</Text>
                    </View>
                    {order.delivery.driver.phone ? (
                      <Button
                        size="sm"
                        variant="tinted"
                        onPress={() => callDriver(order.delivery!.driver!.phone!)}
                        icon={<Icon name="phone" size={14} color={color.brand} />}
                      >
                        Call
                      </Button>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </Surface>
          </Section>

          {/* ── Items ── */}
          <Section title={`Items (${itemCount})`} delay={140}>
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
                    width: 52, height: 52,
                    borderRadius: radius.md,
                    backgroundColor: color.surfaceSubtle,
                    alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
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
                      <Icon name="product" size={20} color={color.textDisabled} />
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyMedium" numberOfLines={2}>{item.product.brand_name}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {[item.product.generic_name, item.product.product_strength, item.product.pack_size]
                        .filter(Boolean).join(' · ') || item.product.sku}
                    </Text>
                    <Text variant="caption" tone="disabled">
                      {item.quantity} × {formatNaira(item.unit_price)}
                    </Text>
                  </View>

                  <Text variant="bodyMedium">{formatNaira(item.subtotal)}</Text>
                </View>
              ))}
            </Surface>
          </Section>

          {/* ── Totals ── */}
          <Section title="Payment" delay={180}>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.sm }}>
                <Total label="Subtotal" value={formatNaira(order.subtotal)} />
                {order.discount > 0 ? (
                  <Total label="Discount" value={`− ${formatNaira(order.discount)}`} tone="success" />
                ) : null}
                <Total label="Delivery" value={formatNaira(order.delivery_fee)} />

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
                    <Text variant="caption" tone="tertiary">Payment reference</Text>
                    <Text variant="mono" tone="secondary">{order.payment_reference}</Text>
                  </View>
                ) : null}
              </View>
            </Surface>
          </Section>

          <Button
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(customer)/catalog' as never)}
            icon={<Icon name="shop" size={16} color={color.text} />}
          >
            Order these again
          </Button>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function Section({ title, delay, children }: {
  title: string; delay: number; children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(320)} style={{ gap: space.sm }}>
      <Text variant="overline" tone="tertiary">{title}</Text>
      {children}
    </Animated.View>
  );
}

function Row({ icon, label, value }: {
  icon: 'location' | 'document'; label: string; value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <Icon name={icon} size={16} color={color.textTertiary} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" tone="tertiary">{label}</Text>
        <Text variant="callout">{value}</Text>
      </View>
    </View>
  );
}

function Total({ label, value, tone }: {
  label: string; value: string; tone?: 'success';
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant="callout" tone={tone ?? 'default'}>{value}</Text>
    </View>
  );
}
