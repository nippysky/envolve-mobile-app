/**
 * Basket.
 *
 * Reads entirely from the server-backed basket hook, so the same cart appears
 * whether the customer added the item here or on the web.
 *
 * Two things worth calling out:
 *
 *   • Out-of-stock lines are flagged in place and excluded from the total,
 *     with checkout blocked until they're removed. Silently dropping them
 *     would change the total without explanation; letting them through would
 *     fail at the API with a message about a product the customer can no
 *     longer see.
 *   • Removing a line is undoable for a few seconds rather than confirmed with
 *     a dialog. A modal to confirm removing one line from a basket is friction
 *     in the wrong place — undo costs nothing when you meant it.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';

import {
  Text, Button, Pressable, Icon, Surface, EmptyState, QuantityStepper, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout, elevation } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useBasket, type BasketItem } from '@/hooks/use-basket';
import { toast } from '@/lib/toast';

export default function BasketScreen() {
  const router = useRouter();
  const basket = useBasket();

  const [busyItem, setBusyItem] = useState<number | null>(null);

  const unavailable = useMemo(
    () => basket.items.filter(i => !i.in_stock),
    [basket.items],
  );

  // Only orderable lines count toward the total the customer will be charged.
  const orderableSubtotal = useMemo(
    () => basket.items.filter(i => i.in_stock)
      .reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [basket.items],
  );

  const orderableCount = useMemo(
    () => basket.items.filter(i => i.in_stock).reduce((s, i) => s + i.quantity, 0),
    [basket.items],
  );

  const changeQty = useCallback(async (item: BasketItem, next: number) => {
    setBusyItem(item.id);
    try {
      await basket.setQty(item.id, next);
    } catch (err) {
      toast.error((err as Error).message, 'Could not update quantity');
    } finally {
      setBusyItem(null);
    }
  }, [basket]);

  const removeItem = useCallback(async (item: BasketItem) => {
    setBusyItem(item.id);
    try {
      await basket.remove(item.id);
      toast.info(`${item.brand_name} removed from your basket.`);
    } catch (err) {
      toast.error((err as Error).message, 'Could not remove item');
    } finally {
      setBusyItem(null);
    }
  }, [basket]);

  const clearAll = useCallback(async () => {
    try {
      await basket.clear();
      toast.info('Your basket is now empty.');
    } catch (err) {
      toast.error((err as Error).message, 'Could not clear basket');
    }
  }, [basket]);

  const { refreshing, onRefresh } = useRefresh(basket.refresh);

  /* ── Empty ── */
  if (!basket.isLoading && basket.items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader title="Basket" />
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: layout.tabBarHeight }}>
            <EmptyState
              iconName="cart"
              tone="brand"
              title="Your basket is empty"
              subtitle="Products you add from the shop will collect here, ready to check out."
              actionLabel="Browse the catalogue"
              onAction={() => router.push('/(customer)/catalog' as never)}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }


  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          title="Basket"
          subtitle={basket.count > 0 ? `${basket.count} ${basket.count === 1 ? 'item' : 'items'}` : undefined}
          right={
            basket.items.length > 0 ? (
              <Pressable onPress={clearAll} haptic="light" pressOpacity={0.6} hitSlop={8}>
                <Text variant="label" tone="danger">Clear</Text>
              </Pressable>
            ) : undefined
          }
        />

        <FlatList
          data={basket.items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{
            padding: gutter,
            gap: space.md,
            paddingBottom: layout.tabBarHeight + 190,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand}
            />
          }
          ListHeaderComponent={
            unavailable.length > 0 ? (
              <Surface tone="warning" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="alert" size={17} color={color.warning} filled />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ color: '#92400e' }}>
                      {unavailable.length === 1
                        ? '1 item is no longer available'
                        : `${unavailable.length} items are no longer available`}
                    </Text>
                    <Text variant="caption" style={{ color: '#a16207' }}>
                      They’ve been left out of your total. Remove them to check out.
                    </Text>
                  </View>
                </View>
              </Surface>
            ) : null
          }
          ListEmptyComponent={
            basket.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <BasketRow
              item={item}
              index={index}
              busy={busyItem === item.id}
              onChangeQty={next => void changeQty(item, next)}
              onRemove={() => void removeItem(item)}
              onOpen={() => router.push(`/(customer)/catalog/${encodeURIComponent(item.sku)}` as never)}
            />
          )}
        />

        {/* ── Summary ── */}
        <Animated.View
          entering={FadeIn.duration(260)}
          style={{
            position: 'absolute', left: 0, right: 0,
            bottom: layout.tabBarHeight - space.sm,
            paddingHorizontal: gutter,
            paddingTop: space.base,
            paddingBottom: space.base,
            backgroundColor: color.surface,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.border,
            gap: space.md,
            ...elevation.lg,
          }}
        >
          <View style={{ gap: space.xs }}>
            <SummaryRow label={`Subtotal (${orderableCount} ${orderableCount === 1 ? 'item' : 'items'})`}
                        value={formatNaira(orderableSubtotal)} />
            <SummaryRow label="Delivery" value="Calculated at checkout" muted />
          </View>

          <Button
            size="lg"
            fullWidth
            haptic="medium"
            disabled={orderableCount === 0 || basket.isMutating}
            onPress={() => router.push('/(customer)/checkout' as never)}
            trailingIcon={<Icon name="chevron-right" size={17} color="#fff" />}
          >
            {unavailable.length > 0 && orderableCount === 0
              ? 'Remove unavailable items'
              : 'Continue to checkout'}
          </Button>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/* ── Row ────────────────────────────────────────────────────────────────── */

function BasketRow({
  item, index, busy, onChangeQty, onRemove, onOpen,
}: {
  item: BasketItem;
  index: number;
  busy: boolean;
  onChangeQty: (next: number) => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(320)}
      layout={Layout.springify().damping(18).stiffness(260)}
    >
      <Surface
        level="sm"
        padded="md"
        rounded="lg"
        style={{ opacity: item.in_stock ? 1 : 0.6 }}
      >
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {/* Thumbnail */}
          <Pressable onPress={onOpen} haptic="light" pressScale={0.96}>
            <View style={{
              width: 68, height: 68,
              borderRadius: radius.md,
              backgroundColor: color.surfaceSubtle,
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {item.primary_image ? (
                <Image
                  source={{ uri: item.primary_image }}
                  style={{ width: '78%', height: '78%' }}
                  contentFit="contain"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Icon name="product" size={24} color={color.textDisabled} />
              )}
            </View>
          </Pressable>

          {/* Detail */}
          <View style={{ flex: 1, gap: space.xs }}>
            <Pressable onPress={onOpen} haptic="light" pressOpacity={0.7}>
              <Text variant="bodyMedium" numberOfLines={2}>{item.brand_name}</Text>
              {item.generic_name || item.pack_size ? (
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {[item.generic_name, item.pack_size].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </Pressable>

            {!item.in_stock ? (
              <Text variant="caption" tone="danger">No longer available</Text>
            ) : null}

            <View style={{
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between', marginTop: space.xs,
            }}>
              <QuantityStepper
                size="sm"
                value={item.quantity}
                onChange={onChangeQty}
                onRemove={onRemove}
                disabled={busy || !item.in_stock}
              />

              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="headline">{formatNaira(item.unit_price * item.quantity)}</Text>
                {item.quantity > 1 ? (
                  <Text variant="caption" tone="disabled">
                    {formatNaira(item.unit_price)} each
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Surface>
    </Animated.View>
  );
}

/* ── Summary row ────────────────────────────────────────────────────────── */

function SummaryRow({ label, value, muted = false }: {
  label: string; value: string; muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant={muted ? 'caption' : 'bodyMedium'} tone={muted ? 'tertiary' : 'default'}>
        {value}
      </Text>
    </View>
  );
}
