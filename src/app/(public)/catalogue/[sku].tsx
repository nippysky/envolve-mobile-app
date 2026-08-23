/**
 * Public product detail.
 *
 * Mirrors the web detail page including the image carousel added there —
 * primary image first, thumbnails below, tap to swap.
 *
 * Visitors see everything. The action bar is where the gate sits: a visitor
 * gets "Sign in to order", a customer gets a quantity stepper and add-to-basket.
 * Showing the product fully and only gating the transaction is deliberate —
 * it's what makes the catalogue worth browsing publicly.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  FadeIn, FadeInDown, useAnimatedScrollHandler, useAnimatedStyle,
  useSharedValue, interpolate, Extrapolation,
} from 'react-native-reanimated';

import { Text, Button, Pressable, Icon, Surface, Skeleton, Badge } from '@/components/ui';
import { color, space, radius, gutter, elevation, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { useBasket } from '@/hooks/use-basket';
import { getProduct } from '@/lib/services/catalog.service';
import { toast } from '@/lib/toast';

export default function PublicProductScreen() {
  const { sku } = useLocalSearchParams<{ sku: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
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

  const isCustomer = user?.role === 'CUSTOMER';
  const hasDiscount = product?.final_price != null && product.final_price < product.selling_price;
  const price = hasDiscount ? product!.final_price! : (product?.selling_price ?? 0);
  const unpriced = price <= 0;

  const heroHeight = width * 0.9;

  // Hero parallaxes gently as the sheet of detail slides over it.
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.base, paddingHorizontal: gutter }}>
          <Icon name="alert" size={34} color={color.textDisabled} />
          <Text variant="title3" align="center">Product not found</Text>
          <Text variant="callout" tone="tertiary" align="center">
            It may have been removed or is no longer stocked.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button variant="outline" onPress={() => void refetch()}>Try again</Button>
            <Button onPress={() => router.back()}>Go back</Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
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

          {/* Pager dots — only when there's more than one */}
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
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              {product.category ? (
                <Badge tone="brand" dot={false} size="sm">{product.category.name}</Badge>
              ) : null}
              <Badge tone={product.in_stock ? 'success' : 'neutral'} size="sm">
                {product.in_stock ? `${product.total_stock} in stock` : 'Out of stock'}
              </Badge>
            </View>

            <Text variant="title1">{product.brand_name}</Text>

            {product.generic_name ? (
              <Text variant="body" tone="secondary">
                {product.generic_name}
                {product.product_strength ? ` · ${product.product_strength}` : ''}
              </Text>
            ) : null}
          </View>

          {/* Price */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            {unpriced ? (
              <Text variant="title2" tone="tertiary">Price on request</Text>
            ) : (
              <>
                <Text variant="display" style={{ fontSize: 30, lineHeight: 36 }}>
                  {formatNaira(price)}
                </Text>
                {hasDiscount ? (
                  <Text variant="body" tone="disabled" style={{ textDecorationLine: 'line-through' }}>
                    {formatNaira(product.selling_price)}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          {/* Spec grid */}
          <Surface level="sm" rounded="lg" padded="base">
            <View style={{ gap: space.md }}>
              {([
                ['SKU',           product.sku],
                ['Manufacturer',  product.manufacturer?.name],
                ['Pack size',     product.pack_size],
                ['Strength',      product.product_strength],
                ['Minimum order', product.minimum_order > 1 ? `${product.minimum_order} packs` : null],
                ['Per carton',    product.quantity_per_carton ? `${product.quantity_per_carton}` : null],
              ] as const)
                .filter(([, v]) => !!v)
                .map(([label, value], i, arr) => (
                  <View
                    key={label}
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: i < arr.length - 1 ? space.md : 0,
                      borderBottomWidth: i < arr.length - 1 ? layout.hairlineWidth : 0,
                      borderBottomColor: color.borderSubtle,
                    }}
                  >
                    <Text variant="callout" tone="tertiary">{label}</Text>
                    <Text variant="bodyMedium">{value}</Text>
                  </View>
                ))}
            </View>
          </Surface>

          {/* Compliance note — reassurance, and true */}
          <Surface tone="info" level="none" rounded="lg" padded="base">
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Icon name="shield" size={17} color={color.info} filled />
              <Text variant="caption" style={{ flex: 1, color: '#155e75' }}>
                Sourced through licensed channels. Batch numbers and expiry dates are
                supplied with every order for your records.
              </Text>
            </View>
          </Surface>
        </Animated.View>
      </Animated.ScrollView>

      {/* ── Floating back ── */}
      <Pressable
        onPress={() => router.back()}
        haptic="light"
        pressScale={0.9}
        style={{
          position: 'absolute',
          top: insets.top + space.sm,
          left: gutter,
          width: 40, height: 40, borderRadius: radius.full,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.92)',
          ...elevation.md,
        }}
      >
        <Icon name="back" size={18} color={color.text} />
      </Pressable>

      {/* ── Action bar ── */}
      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingHorizontal: gutter,
          paddingTop: space.md,
          paddingBottom: Math.max(insets.bottom, space.base),
          backgroundColor: color.surface,
          borderTopWidth: layout.hairlineWidth,
          borderTopColor: color.borderSubtle,
          shadowColor: color.text,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        {!isCustomer ? (
          /* Visitor / staff — the gate */
          <Animated.View entering={FadeIn.duration(300)} style={{ gap: space.sm }}>
            <Button
              size="lg"
              fullWidth
              onPress={() => router.push('/(auth)/sign-in')}
              icon={<Icon name="lock" size={15} color="#fff" />}
            >
              Sign in to order
            </Button>
            <Text variant="caption" tone="tertiary" align="center">
              Ordering is available to verified pharmacies
            </Text>
          </Animated.View>
        ) : !product.in_stock ? (
          <Button size="lg" fullWidth disabled>Out of stock</Button>
        ) : unpriced ? (
          <Button size="lg" fullWidth disabled>Price on request</Button>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            {/* Quantity stepper */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              borderRadius: radius.md, borderWidth: 1, borderColor: color.border,
              height: 50,
            }}>
              <Pressable
                onPress={() => setQty(q => Math.max(product.minimum_order, q - 1))}
                haptic="light"
                disabled={qty <= product.minimum_order}
                style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={13} color={qty <= product.minimum_order ? color.textDisabled : color.text} />
              </Pressable>

              <Text variant="headline" style={{ minWidth: 32, textAlign: 'center' }}>{qty}</Text>

              <Pressable
                onPress={() => setQty(q => Math.min(product.total_stock, q + 1))}
                haptic="light"
                disabled={qty >= product.total_stock}
                style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="plus" size={15} color={qty >= product.total_stock ? color.textDisabled : color.text} />
              </Pressable>
            </View>

            <Button
              size="lg"
              style={{ flex: 1 }}
              loading={adding}
              disabled={adding}
              onPress={addToBasket}
              haptic="medium"
              icon={<Icon name="cart" size={16} color="#fff" filled />}
            >
              {adding ? 'Adding…' : `Add · ${formatNaira(price * qty)}`}
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}
