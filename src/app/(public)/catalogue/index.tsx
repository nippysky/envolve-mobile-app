/**
 * Public catalogue.
 *
 * Anyone can browse — the catalog endpoints require no session. Actions are
 * gated: tapping a product opens the detail, but adding to a basket prompts
 * sign-in. Showing the goods before asking for credentials is the whole point.
 *
 * Interaction detail worth noting: the header collapses as you scroll. The
 * large title shrinks into the search bar's row rather than disappearing, so
 * the screen never loses its identity while the grid takes over.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Animated, {
  useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  interpolate, Extrapolation, FadeIn,
} from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Button, ProductCardSkeleton,
} from '@/components/ui';
import { ProductCard } from '@/components/catalog/ProductCard';
import { Logo } from '@/components/shared/Logo';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  listProducts, listCategories,
  type CatalogSort, type CatalogProduct,
} from '@/lib/services/catalog.service';
import { useDebounced } from '@/hooks/use-debounced';

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'newest',     label: 'Newest' },
  { value: 'name_asc',   label: 'A–Z' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
];

const HEADER_MAX = 96;

export default function PublicCatalogueScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [rawSearch, setRawSearch] = useState('');
  const [category,  setCategory]  = useState<number | null>(null);
  const [sort,      setSort]      = useState<CatalogSort>('newest');

  // Debounced so typing doesn't fire a request per keystroke.
  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const categoriesQ = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn:  listCategories,
    staleTime: 5 * 60_000,
  });

  const productsQ = useInfiniteQuery({
    queryKey: ['catalog', 'products', search, category, sort],
    queryFn:  ({ pageParam = 1 }) =>
      listProducts({ search, category, sort, page: pageParam as number, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 60_000,
  });

  const products: CatalogProduct[] = useMemo(
    () => productsQ.data?.pages.flatMap(p => p.records) ?? [],
    [productsQ.data],
  );

  const total = productsQ.data?.pages[0]?.pagination.total ?? 0;

  /* Collapsing header — the title shrinks rather than vanishing. */
  const titleStyle = useAnimatedStyle(() => ({
    height:    interpolate(scrollY.value, [0, HEADER_MAX], [HEADER_MAX, 0], Extrapolation.CLAMP),
    opacity:   interpolate(scrollY.value, [0, HEADER_MAX * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, HEADER_MAX], [0, -20], Extrapolation.CLAMP) }],
  }));

  const openProduct = useCallback((sku: string) => {
    router.push(`/(public)/catalogue/${encodeURIComponent(sku)}` as never);
  }, [router]);

  const cardWidth = (width - gutter * 2 - space.md) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: gutter, backgroundColor: color.bg }}>
          <Animated.View style={[{ justifyContent: 'flex-end', paddingBottom: space.md }, titleStyle]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text variant="title1">Catalogue</Text>
                <Text variant="callout" tone="tertiary">
                  {total > 0 ? `${total.toLocaleString()} products available` : 'Browse our range'}
                </Text>
              </View>
              <Logo size={30} />
            </View>
          </Animated.View>

          {/* Search */}
          <Input
            placeholder="Search by brand, generic or SKU"
            value={rawSearch}
            onChangeText={setRawSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            leading={<Icon name="search" size={17} color={color.textTertiary} />}
            trailing={rawSearch ? <Icon name="close" size={16} color={color.textTertiary} /> : undefined}
            onTrailingPress={rawSearch ? () => setRawSearch('') : undefined}
            containerStyle={{ marginBottom: space.md }}
          />

          {/* Category rail */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: 0, name: 'All', product_count: total }, ...(categoriesQ.data?.categories ?? [])]}
            keyExtractor={c => String(c.id)}
            contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}
            renderItem={({ item }) => {
              const active = (item.id === 0 && category === null) || category === item.id;
              return (
                <Pressable
                  onPress={() => setCategory(item.id === 0 ? null : item.id)}
                  haptic="light"
                  pressScale={0.95}
                  style={{
                    paddingHorizontal: space.base,
                    height: 36,
                    borderRadius: radius.full,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.xs,
                    backgroundColor: active ? color.text : color.surface,
                    borderWidth: 1,
                    borderColor: active ? color.text : color.border,
                  }}
                >
                  <Text
                    variant="label"
                    style={{ color: active ? '#fff' : color.textSecondary }}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* ── Grid ── */}
        <Animated.FlatList
          data={products}
          keyExtractor={p => p.sku}
          numColumns={2}
          onScroll={onScroll}
          scrollEventThrottle={16}
          columnWrapperStyle={{ gap: space.md, paddingHorizontal: gutter }}
          contentContainerStyle={{ gap: space.md, paddingBottom: space['4xl'] }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (productsQ.hasNextPage && !productsQ.isFetchingNextPage) {
              void productsQ.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={productsQ.isRefetching && !productsQ.isFetchingNextPage}
              onRefresh={() => void productsQ.refetch()}
              tintColor={color.brand}
            />
          }
          renderItem={({ item, index }) => (
            <ProductCard
              product={item}
              index={index}
              onPress={() => openProduct(item.sku)}
              style={{ maxWidth: cardWidth }}
            />
          )}
          ListHeaderComponent={
            products.length > 0 ? (
              <View style={{
                flexDirection: 'row', gap: space.sm,
                paddingHorizontal: gutter, paddingBottom: space.xs,
              }}>
                {SORTS.map(s => (
                  <Pressable
                    key={s.value}
                    onPress={() => setSort(s.value)}
                    haptic="light"
                    pressScale={0.95}
                    style={{
                      paddingHorizontal: space.md, height: 30,
                      justifyContent: 'center', borderRadius: radius.sm,
                      backgroundColor: sort === s.value ? color.brandSoft : 'transparent',
                    }}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: sort === s.value ? color.brand : color.textTertiary,
                        fontWeight: sort === s.value ? '700' : '500',
                      }}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            productsQ.isLoading ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: gutter }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={{ width: cardWidth }}>
                    <ProductCardSkeleton />
                  </View>
                ))}
              </View>
            ) : (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={{ alignItems: 'center', paddingTop: space['4xl'], paddingHorizontal: gutter, gap: space.md }}
              >
                <Icon name="search" size={34} color={color.textDisabled} />
                <Text variant="title3" align="center">No products found</Text>
                <Text variant="callout" tone="tertiary" align="center">
                  {search
                    ? `Nothing matches “${search}”. Try a different term.`
                    : 'This category is empty right now.'}
                </Text>
                {(search || category) ? (
                  <Button
                    variant="tinted"
                    onPress={() => { setRawSearch(''); setCategory(null); }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </Animated.View>
            )
          }
          ListFooterComponent={
            productsQ.isFetchingNextPage ? (
              <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: gutter, paddingTop: space.md }}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <View key={i} style={{ width: cardWidth }}>
                    <ProductCardSkeleton />
                  </View>
                ))}
              </View>
            ) : null
          }
        />

        {/* ── Sign-in prompt — only for visitors ── */}
        {!user ? (
          <Animated.View
            entering={FadeIn.delay(600).duration(400)}
            style={{
              position: 'absolute', left: gutter, right: gutter, bottom: space.lg,
            }}
          >
            <Pressable
              onPress={() => router.push('/(auth)/sign-in')}
              haptic="medium"
              pressScale={0.98}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.md,
                paddingHorizontal: space.base, paddingVertical: space.md,
                borderRadius: radius.xl,
                backgroundColor: color.text,
                shadowColor: color.text,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.24,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <View style={{
                width: 34, height: 34, borderRadius: radius.full,
                backgroundColor: 'rgba(255,255,255,0.14)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="lock" size={15} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ color: '#fff' }}>Sign in to order</Text>
                <Text variant="caption" style={{ color: 'rgba(255,255,255,0.62)' }}>
                  Pricing and ordering for verified pharmacies
                </Text>
              </View>
              <Icon name="chevron-right" size={17} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
