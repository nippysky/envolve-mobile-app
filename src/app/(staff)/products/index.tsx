/**
 * Products — console.
 *
 * Read-only. Catalogue authoring belongs to the web console, but a rep needs
 * this screen constantly — checking a price or stock level while a customer is
 * on the phone — so it stays, without the write affordances.
 *
 * Draft products with no price are called out explicitly. Quick-import lands
 * products as DRAFT with `selling_price: 0`, and a zero-priced product can't be
 * activated or ordered. Without a visible flag those rows sit in the catalogue
 * looking finished and quietly sell nothing.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Surface, Badge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listAdminProducts, type AdminProduct, type ProductStatus,
} from '@/lib/services/admin.service';

const STATUSES: { value: ProductStatus | null; label: string }[] = [
  { value: null,           label: 'All' },
  { value: 'ACTIVE',       label: 'Active' },
  { value: 'DRAFT',        label: 'Draft' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

const STATUS_TONE: Record<ProductStatus, 'success' | 'warning' | 'neutral'> = {
  ACTIVE:       'success',
  DRAFT:        'warning',
  DISCONTINUED: 'neutral',
};

export default function ConsoleProductsScreen() {
  const router = useRouter();

  const [rawSearch, setRawSearch] = useState('');
  const [status,    setStatus]    = useState<ProductStatus | null>(null);

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const productsQ = useInfiniteQuery({
    queryKey: ['products', 'console', search, status],
    queryFn:  ({ pageParam = 1 }) =>
      listAdminProducts({ page: pageParam as number, limit: 20, search, status }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const products = useMemo(
    () => productsQ.data?.pages.flatMap(p => p.records) ?? [],
    [productsQ.data],
  );

  const total = productsQ.data?.pages[0]?.pagination.total ?? 0;

  // Unpriced drafts are the actionable subset — surfaced as a one-tap filter
  // rather than something you have to notice scrolling.
  const unpricedOnPage = useMemo(
    () => products.filter(p => p.selling_price <= 0).length,
    [products],
  );

  const open = useCallback((sku: string) => {
    router.push(`/(staff)/products/${encodeURIComponent(sku)}` as never);
  }, [router]);


  const { refreshing, onRefresh } = useRefresh(productsQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Products"
          subtitle={total > 0 ? `${total.toLocaleString()} matching` : undefined}
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <Input
            placeholder="Search brand, generic or SKU"
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

          {unpricedOnPage > 0 && status !== 'DRAFT' ? (
            <Pressable onPress={() => setStatus('DRAFT')} haptic="light" pressScale={0.99}>
              <Surface tone="warning" level="none" padded="md" rounded="md">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Icon name="alert" size={15} color={color.warning} filled />
                  <Text variant="caption" style={{ flex: 1, color: '#92400e' }}>
                    {unpricedOnPage} product{unpricedOnPage === 1 ? '' : 's'} here have no price
                    set and can’t be sold.
                  </Text>
                  <Icon name="chevron-right" size={14} color="#a16207" />
                </View>
              </Surface>
            </Pressable>
          ) : null}
        </View>

        <Animated.FlatList
          data={products}
          keyExtractor={p => p.sku}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
            gap: space.sm,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (productsQ.hasNextPage && !productsQ.isFetchingNextPage) {
              void productsQ.fetchNextPage();
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
            <ProductRow product={item} index={index} onPress={() => open(item.sku)} />
          )}
          ListEmptyComponent={
            productsQ.isLoading ? (
              <View style={{ gap: space.sm }}>
                {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : productsQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load products"
                actionLabel="Retry"
                onAction={() => void productsQ.refetch()}
              />
            ) : (
              <EmptyState
                iconName="products"
                title="No products found"
                subtitle={search || status ? 'Try a different search or filter.' : 'The catalogue is empty.'}
                actionLabel={search || status ? 'Clear filters' : undefined}
                onAction={search || status ? () => { setRawSearch(''); setStatus(null); } : undefined}
              />
            )
          }
          ListFooterComponent={productsQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>
    </View>
  );
}

function ProductRow({ product, index, onPress }: {
  product: AdminProduct; index: number; onPress: () => void;
}) {
  const price    = product.final_price ?? product.selling_price;
  const unpriced = price <= 0;
  const outOfStock = product.total_stock <= 0;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
      <Pressable onPress={onPress} haptic="light" pressScale={0.985}>
        <Surface level="sm" padded="md" rounded="lg">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{
              width: 46, height: 46, borderRadius: radius.md,
              backgroundColor: color.surfaceSubtle,
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {product.primary_image ? (
                <Image
                  source={{ uri: product.primary_image }}
                  style={{ width: '76%', height: '76%' }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Icon name="product" size={18} color={color.textDisabled} />
              )}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" numberOfLines={1}>{product.brand_name}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {[product.generic_name, product.product_strength, product.pack_size]
                  .filter(Boolean).join(' · ') || product.sku}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: 2 }}>
                <Badge tone={STATUS_TONE[product.status]} size="sm" dot>
                  {product.status.toLowerCase()}
                </Badge>
                {unpriced ? <Badge tone="danger" size="sm">No price</Badge> : null}
                {outOfStock ? <Badge tone="neutral" size="sm">Out of stock</Badge> : null}
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="bodyMedium" tone={unpriced ? 'disabled' : 'default'}>
                {unpriced ? '—' : formatNaira(price)}
              </Text>
              <Text variant="caption" tone="disabled">{product.total_stock} in stock</Text>
            </View>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}
