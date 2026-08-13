/**
 * Product detail — console.
 *
 * Staff read; admins edit inline. Editing is per-field-group rather than a
 * separate form screen, because the common case is changing one number — a
 * price, a minimum stock level — and a round trip through an edit screen for
 * one field is friction with no payoff.
 *
 * The activation guard is mirrored from the API: a product with no selling
 * price cannot be set ACTIVE. The API rejects it; this screen explains why
 * before you try, and offers the price field instead.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira, formatDate } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAdminProduct, updateProduct, type ProductStatus,
} from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';

const STATUS_TONE: Record<ProductStatus, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success', DRAFT: 'warning', DISCONTINUED: 'neutral',
};

const STATUSES: ProductStatus[] = ['DRAFT', 'ACTIVE', 'DISCONTINUED'];

export default function ConsoleProductDetailScreen() {
  const { sku } = useLocalSearchParams<{ sku: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';

  const [editing, setEditing] = useState(false);
  const [busy,    setBusy]    = useState(false);

  const [price,   setPrice]   = useState('');
  const [minOrd,  setMinOrd]  = useState('');
  const [minStock, setMinStock] = useState('');
  const [shelf,   setShelf]   = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['products', 'detail', sku],
    queryFn:  () => getAdminProduct(String(sku)),
    enabled:  !!sku,
  });

  const product = data?.product;

  useEffect(() => {
    if (!product) return;
    setPrice(product.selling_price > 0 ? String(product.selling_price) : '');
    setMinOrd(String(product.minimum_order));
    setMinStock(String(product.minimum_stock_level));
    setShelf(product.shelf_location ?? '');
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async () => {
    if (!product || busy) return;

    const p = parseFloat(price);
    if (price && (!Number.isFinite(p) || p < 0)) {
      toast.error('Enter a valid selling price.', 'Check the price');
      return;
    }

    setBusy(true);
    try {
      await updateProduct(product.sku, {
        selling_price:       price ? p : undefined,
        minimum_order:       minOrd ? parseInt(minOrd, 10) : undefined,
        minimum_stock_level: minStock ? parseInt(minStock, 10) : undefined,
        shelf_location:      shelf.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditing(false);
      toast.success('Product updated.');
    } catch (err) {
      toast.error((err as Error).message, 'Could not save');
    } finally {
      setBusy(false);
    }
  }, [product, busy, price, minOrd, minStock, shelf, queryClient]);

  const setStatus = useCallback(async (next: ProductStatus) => {
    if (!product || busy) return;

    // Mirrors the server guard so the rejection is explained, not just returned.
    if (next === 'ACTIVE' && product.selling_price <= 0) {
      toast.error('Set a selling price before activating this product.', 'No price set');
      setEditing(true);
      return;
    }

    setBusy(true);
    try {
      await updateProduct(product.sku, { status: next });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Product is now ${next.toLowerCase()}.`);
    } catch (err) {
      toast.error((err as Error).message, 'Could not change status');
    } finally {
      setBusy(false);
    }
  }, [product, busy, queryClient]);

  /* ── Loading / error ── */
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Product" />
          <View style={{ padding: gutter, gap: space.base }}>
            <Skeleton width="100%" height={180} radius="lg" />
            <Skeleton width="70%" height={24} />
            <Skeleton width="100%" height={140} radius="lg" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Product" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Couldn’t load this product"
              actionLabel="Try again"
              onAction={() => void refetch()}
              secondaryLabel="Back to products"
              onSecondary={() => router.replace('/(staff)/products' as never)}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const unpriced = product.selling_price <= 0;
  const heroSize = width - gutter * 2;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title={product.brand_name}
          subtitle={product.sku}
          right={
            isAdmin ? (
              <Pressable
                onPress={() => setEditing(e => !e)}
                haptic="light"
                pressScale={0.92}
                hitSlop={8}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={editing ? 'Stop editing' : 'Edit product'}
              >
                <Icon name={editing ? 'close' : 'edit'} size={18} color={color.text} />
              </Pressable>
            ) : undefined
          }
        />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: layout.tabBarHeight + space['3xl'],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.brand} />
          }
        >
          {/* ── Image ── */}
          <Animated.View entering={FadeInDown.duration(320)}>
            <View style={{
              height: heroSize * 0.55,
              borderRadius: radius.xl,
              backgroundColor: color.surfaceSubtle,
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {product.primary_image ? (
                <Image
                  source={{ uri: product.primary_image }}
                  style={{ width: '70%', height: '70%' }}
                  contentFit="contain"
                  transition={240}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={{ alignItems: 'center', gap: space.sm }}>
                  <Icon name="image" size={34} color={color.textDisabled} />
                  <Text variant="caption" tone="disabled">No image uploaded</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Headline ── */}
          <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Badge tone={STATUS_TONE[product.status]} size="sm" dot>
                {product.status.toLowerCase()}
              </Badge>
              {unpriced ? <Badge tone="danger" size="sm">No price set</Badge> : null}
              {product.category ? <Badge tone="neutral" size="sm">{product.category.name}</Badge> : null}
            </View>

            <Text variant="title2">{product.brand_name}</Text>
            {product.generic_name ? (
              <Text variant="callout" tone="tertiary">
                {product.generic_name}
                {product.product_strength ? ` · ${product.product_strength}` : ''}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <Text variant="display" tone={unpriced ? 'disabled' : 'default'}>
                {unpriced ? 'No price' : formatNaira(product.final_price ?? product.selling_price)}
              </Text>
              {product.final_price != null && product.final_price < product.selling_price ? (
                <Text variant="callout" tone="disabled" style={{ textDecorationLine: 'line-through' }}>
                  {formatNaira(product.selling_price)}
                </Text>
              ) : null}
            </View>
          </Animated.View>

          {/* ── Unpriced warning ── */}
          {unpriced ? (
            <Animated.View entering={FadeInDown.delay(90).duration(320)}>
              <Surface tone="warning" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="alert" size={17} color={color.warning} filled />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ color: '#92400e' }}>This product can’t be sold</Text>
                    <Text variant="caption" style={{ color: '#a16207' }}>
                      It has no selling price, so it can’t be activated or added to an
                      order. {isAdmin ? 'Set one below.' : 'Ask an admin to set one.'}
                    </Text>
                  </View>
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── Edit ── */}
          {isAdmin && editing ? (
            <Animated.View entering={FadeIn.duration(240)} style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Edit</Text>
              <Surface level="sm" padded="base" rounded="lg">
                <View style={{ gap: space.base }}>
                  <Input
                    label="Selling price"
                    hint="Naira, per pack"
                    placeholder="0"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    editable={!busy}
                    leading={<Text variant="callout" tone="tertiary">₦</Text>}
                  />

                  <View style={{ flexDirection: 'row', gap: space.md }}>
                    <Input
                      label="Minimum order"
                      hint="Packs"
                      value={minOrd}
                      onChangeText={setMinOrd}
                      keyboardType="number-pad"
                      editable={!busy}
                      containerStyle={{ flex: 1 }}
                    />
                    <Input
                      label="Reorder level"
                      hint="Flags as low"
                      value={minStock}
                      onChangeText={setMinStock}
                      keyboardType="number-pad"
                      editable={!busy}
                      containerStyle={{ flex: 1 }}
                    />
                  </View>

                  <Input
                    label="Shelf location"
                    placeholder="e.g. A3-04"
                    value={shelf}
                    onChangeText={setShelf}
                    autoCapitalize="characters"
                    editable={!busy}
                  />

                  <Button fullWidth loading={busy} disabled={busy} onPress={save} haptic="medium">
                    Save changes
                  </Button>
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── Status ── */}
          {isAdmin ? (
            <Animated.View entering={FadeInDown.delay(120).duration(320)} style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Status</Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {STATUSES.map(s => {
                  const active   = product.status === s;
                  const blocked  = s === 'ACTIVE' && unpriced;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => void setStatus(s)}
                      disabled={busy || active}
                      haptic="light"
                      pressScale={0.95}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active, disabled: busy || active }}
                      style={{
                        paddingHorizontal: space.base, height: 36,
                        justifyContent: 'center', borderRadius: radius.full,
                        backgroundColor: active ? color.text : color.surface,
                        borderWidth: layout.hairlineWidth,
                        borderColor: active ? color.text : color.border,
                        opacity: blocked ? 0.45 : 1,
                      }}
                    >
                      <Text variant="caption" style={{
                        color: active ? '#fff' : color.textSecondary,
                        fontWeight: active ? '700' : '500',
                      }}>
                        {s.toLowerCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          {/* ── Facts ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Details</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <Fact label="Stock on hand" value={`${product.total_stock} packs`} />
              <Fact label="Reorder level" value={`${product.minimum_stock_level} packs`} />
              <Fact label="Minimum order" value={`${product.minimum_order} packs`} />
              <Fact label="Pack size" value={product.pack_size} />
              <Fact label="Per carton" value={product.quantity_per_carton ? `${product.quantity_per_carton} packs` : null} />
              <Fact label="Manufacturer" value={product.manufacturer?.name ?? null} />
              <Fact label="Shelf" value={product.shelf_location} />
              <Fact
                label="Last cost"
                value={product.last_cost_price ? formatNaira(product.last_cost_price) : null}
              />
              <Fact label="Updated" value={formatDate(product.updated_at)} last />
            </Surface>
          </Animated.View>

          {!isAdmin ? (
            <Surface tone="subtle" level="none" padded="md" rounded="md">
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Icon name="lock" size={14} color={color.textTertiary} />
                <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                  Products are managed by admins. You have read access so you can
                  quote prices and stock.
                </Text>
              </View>
            </Surface>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Fact({ label, value, last = false }: {
  label: string; value: string | null; last?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', gap: space.base,
      paddingHorizontal: space.base, paddingVertical: space.md,
      borderBottomWidth: last ? 0 : layout.hairlineWidth,
      borderBottomColor: color.borderSubtle,
    }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant="callout" tone={value ? 'default' : 'disabled'} numberOfLines={1}>
        {value ?? 'Not set'}
      </Text>
    </View>
  );
}
