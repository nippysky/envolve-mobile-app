/**
 * Product detail — signed-in customer.
 *
 * The public version of this screen shows everything and gates the action bar.
 * Here the action bar is the point, so it gets the affordances that matter:
 * a stepper seeded at the product's minimum order, a live "already in your
 * basket" line, and stock-aware bounds.
 *
 * Minimum order is enforced at the stepper rather than at submit. The API
 * rejects quantities below `minimum_order`, and discovering that after tapping
 * "Add to basket" teaches the customer nothing about what to do next.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  FadeIn, FadeInDown, useAnimatedScrollHandler, useAnimatedStyle,
  useSharedValue, interpolate, Extrapolation,
} from 'react-native-reanimated';

import {
  Text, Button, Pressable, Icon, Surface, Skeleton, Badge, QuantityStepper, EmptyState,
} from '@/components/ui';
import { color, space, radius, gutter, elevation, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useBasket } from '@/hooks/use-basket';
import { getProduct } from '@/lib/services/catalog.service';
import { toast } from '@/lib/toast';

export default function CustomerProductScreen() {
  const { sku } = useLocalSearchParams<{ sku: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const basket = useBasket();

  const [activeImage, setActiveImage] = useState(0);
  const [qty,         setQty]         = useState(1);
  const [adding,      setAdding]      = useState(false);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['catalog', 'product', sku],
    queryFn:  () => getProduct(String(sku)),
    enabled:  !!sku,
  });

  const product = data?.product;

  // Primary image first — matches the ordering the web gallery uses.
  const images = useMemo(() => {
    const list = product?.images ?? [];
    return [...list].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  }, [product]);

  const minOrder = product?.minimum_order ?? 1;
  const maxOrder = product ? Math.max(minOrder, product.total_stock) : 999;

  // Seed the stepper at the minimum once the product resolves. Starting at 1
  // for a product with a minimum of 10 shows a number that can't be ordered.
  useEffect(() => {
    if (product) setQty(product.minimum_order || 1);
  }, [product]);

  const hasDiscount = product?.final_price != null && product.final_price < product.selling_price;
  const price    = hasDiscount ? product!.final_price! : (product?.selling_price ?? 0);
  const unpriced = price <= 0;
  const inBasket = product ? basket.quantityOf(product.id) : 0;

  const heroHeight = width * 0.9;

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-heroHeight, 0, heroHeight], [-heroHeight / 2, 0, heroHeight * 0.3], Extrapolation.CLAMP) },
      { scale:      interpolate(scrollY.value, [-heroHeight, 0], [1.4, 1], Extrapolation.CLAMP) },
    ],
  }));

  const addToBasket = useCallback(async () => {
    if (!product || adding) return;
    setAdding(true);
    try {
      await basket.add(product.id, qty);
      toast.success(`${qty} × ${product.brand_name}`, 'Added to basket');
    } catch (err) {
      toast.error((err as Error).message, 'Could not add');
    } finally {
      setAdding(false);
    }
  }, [product, qty, adding, basket]);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <Skeleton width="100%" height={heroHeight} radius={0} />
        <View style={{ padding: gutter, gap: space.md }}>
          <Skeleton width="70%" height={24} />
          <Skeleton width="45%" height={16} />
          <Skeleton width="35%" height={28} />
        </View>
      </View>
    );
  }

  /* ── Error ── */
  if (isError || !product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            iconName="alert"
            tone="danger"
            title="Product not found"
            subtitle="It may have been removed or is no longer stocked."
            actionLabel="Try again"
            onAction={() => void refetch()}
            secondaryLabel="Go back"
            onSecondary={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const specs: [string, string | null][] = [
    ['Generic name', product.generic_name],
    ['Strength',     product.product_strength],
    ['Pack size',    product.pack_size],
    ['Manufacturer', product.manufacturer?.name ?? null],
    ['Category',     product.category?.name ?? null],
    ['SKU',          product.sku],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 170 }}
      >
        {/* ── Hero ── */}
        <Animated.View style={[{ height: heroHeight, backgroundColor: color.surfaceSubtle }, heroStyle]}>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e =>
                setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))
              }
            >
              {images.map(img => (
                <View
                  key={img.id}
                  style={{ width, height: heroHeight, alignItems: 'center', justifyContent: 'center', padding: space['2xl'] }}
                >
                  <Image
                    source={{ uri: img.url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                    transition={260}
                    cachePolicy="memory-disk"
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="product" size={64} color={color.textDisabled} />
            </View>
          )}

          {images.length > 1 ? (
            <View style={{
              position: 'absolute', bottom: space.base, left: 0, right: 0,
              flexDirection: 'row', justifyContent: 'center', gap: space.xs,
            }}>
              {images.map((img, i) => (
                <View
                  key={img.id}
                  style={{
                    width: i === activeImage ? 18 : 6,
                    height: 6,
                    borderRadius: radius.full,
                    backgroundColor: i === activeImage ? color.text : color.borderStrong,
                  }}
                />
              ))}
            </View>
          ) : null}
        </Animated.View>

        {/* ── Detail sheet ── */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{
            marginTop: -radius['2xl'],
            backgroundColor: color.bg,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingHorizontal: gutter,
            paddingTop: space.xl,
            gap: space.lg,
          }}
        >
          {/* Title block */}
          <View style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {product.category ? (
                <Badge tone="neutral" size="sm">{product.category.name}</Badge>
              ) : null}
              {product.in_stock
                ? <Badge tone="success" size="sm" dot>In stock</Badge>
                : <Badge tone="danger"  size="sm" dot>Out of stock</Badge>}
            </View>

            <Text variant="title2">{product.brand_name}</Text>

            {product.generic_name ? (
              <Text variant="callout" tone="tertiary">
                {product.generic_name}
                {product.product_strength ? ` · ${product.product_strength}` : ''}
              </Text>
            ) : null}
          </View>

          {/* Price */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            {unpriced ? (
              <Text variant="title3" tone="tertiary">Price on request</Text>
            ) : (
              <>
                <Text variant="display">{formatNaira(price)}</Text>
                {hasDiscount ? (
                  <>
                    <Text variant="callout" tone="disabled" style={{ textDecorationLine: 'line-through' }}>
                      {formatNaira(product.selling_price)}
                    </Text>
                    <Badge tone="danger" size="sm">
                      −{Math.round(product.discount_percentage ?? 0)}%
                    </Badge>
                  </>
                ) : null}
              </>
            )}
          </View>

          {/* Already in basket */}
          {inBasket > 0 ? (
            <Surface tone="brand" level="none" padded="md" rounded="md">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Icon name="cart" size={16} color={color.brand} filled />
                <Text variant="callout" style={{ flex: 1, color: '#006a8a' }}>
                  {inBasket} already in your basket
                </Text>
                <Pressable onPress={() => router.push('/(customer)/cart' as never)} haptic="light" pressOpacity={0.6}>
                  <Text variant="label" tone="brand">View</Text>
                </Pressable>
              </View>
            </Surface>
          ) : null}

          {/* Ordering constraints — stated up front, not discovered at submit. */}
          <Surface tone="subtle" level="none" padded="base" rounded="lg">
            <View style={{ gap: space.sm }}>
              <ConstraintRow
                icon="clipboard"
                label="Minimum order"
                value={`${minOrder} ${minOrder === 1 ? 'pack' : 'packs'}`}
              />
              <ConstraintRow
                icon="inventory"
                label="Available"
                value={product.in_stock ? `${product.total_stock} packs` : 'Out of stock'}
              />
              {product.quantity_per_carton ? (
                <ConstraintRow
                  icon="products"
                  label="Per carton"
                  value={`${product.quantity_per_carton} packs`}
                />
              ) : null}
            </View>
          </Surface>

          {/* Specs */}
          <View style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Product details</Text>
            <Surface level="sm" padded="none" rounded="lg">
              {specs.filter(([, v]) => !!v).map(([label, value], i, arr) => (
                <View
                  key={label}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center', gap: space.base,
                    paddingHorizontal: space.base, paddingVertical: space.md,
                    borderBottomWidth: i === arr.length - 1 ? 0 : layout.hairlineWidth,
                    borderBottomColor: color.borderSubtle,
                  }}
                >
                  <Text variant="callout" tone="tertiary">{label}</Text>
                  <Text variant="callout" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
                    {value}
                  </Text>
                </View>
              ))}
            </Surface>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* ── Floating back button ── */}
      <Pressable
        onPress={() => router.back()}
        haptic="light"
        pressScale={0.92}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          position: 'absolute', top: insets.top + space.sm, left: gutter,
          width: 38, height: 38, borderRadius: radius.full,
          backgroundColor: 'rgba(255,255,255,0.86)',
          alignItems: 'center', justifyContent: 'center',
          ...elevation.md,
        }}
      >
        <Icon name="back" size={17} color={color.text} />
      </Pressable>

      {/* ── Action bar ── */}
      <Animated.View
        entering={FadeIn.delay(200).duration(300)}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingHorizontal: gutter,
          paddingTop: space.md,
          paddingBottom: Math.max(insets.bottom, space.md),
          backgroundColor: color.surface,
          borderTopWidth: layout.hairlineWidth,
          borderTopColor: color.border,
          gap: space.md,
        }}
      >
        {!product.in_stock ? (
          <Button variant="secondary" size="lg" fullWidth disabled>
            Out of stock
          </Button>
        ) : unpriced ? (
          <Button variant="secondary" size="lg" fullWidth disabled>
            Contact us for pricing
          </Button>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
            <QuantityStepper
              value={qty}
              onChange={setQty}
              min={minOrder}
              max={maxOrder}
              disabled={adding}
            />
            <Button
              size="lg"
              onPress={addToBasket}
              loading={adding}
              disabled={adding}
              haptic="medium"
              style={{ flex: 1 }}
            >
              {adding ? 'Adding…' : `Add · ${formatNaira(price * qty)}`}
            </Button>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

/* ── Constraint row ─────────────────────────────────────────────────────── */

function ConstraintRow({
  icon, label, value,
}: {
  icon: 'clipboard' | 'inventory' | 'products';
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Icon name={icon} size={15} color={color.textTertiary} />
      <Text variant="callout" tone="tertiary" style={{ flex: 1 }}>{label}</Text>
      <Text variant="label">{value}</Text>
    </View>
  );
}
