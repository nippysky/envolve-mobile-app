/**
 * Product detail — console. Read-only.
 *
 * Catalogue authoring (pricing, stock levels, status) is an admin job and lives
 * in the web console. What a rep needs on a phone is the ability to answer
 * "what does this cost and have we got it?" while a pharmacist is on the line,
 * which is all this screen does.
 *
 * The unpriced warning stays, because a product with no selling price can't be
 * ordered — a rep needs to know that before they try to add it to a basket.
 */

import React from 'react';
import { View, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Icon, Surface, Badge, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import {
  getAdminProduct, type ProductStatus,
} from '@/lib/services/admin.service';

const STATUS_TONE: Record<ProductStatus, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success', DRAFT: 'warning', DISCONTINUED: 'neutral',
};

export default function ConsoleProductDetailScreen() {
  const { sku } = useLocalSearchParams<{ sku: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', 'detail', sku],
    queryFn:  () => getAdminProduct(String(sku)),
    enabled:  !!sku,
  });

  const product = data?.product;

  const { refreshing, onRefresh } = useRefresh(refetch);

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
        />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: space['3xl'],
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
                      order. Ask an admin to set one in the web console.
                    </Text>
                  </View>
                </View>
              </Surface>
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

          <Surface tone="subtle" level="none" padded="md" rounded="md">
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Icon name="lock" size={14} color={color.textTertiary} />
              <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                Products are managed in the web console. You have read access so
                you can quote prices and stock.
              </Text>
            </View>
          </Surface>
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
