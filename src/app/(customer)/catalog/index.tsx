/**
 * Shop — the signed-in customer's catalogue.
 *
 * Shares the public catalogue's data layer but not its shape. The public
 * screen sells the idea of the catalogue to a visitor; this one is a working
 * tool for someone restocking a pharmacy, so it leads with the things they came
 * back for: what's in the basket, what they last ordered, and search.
 *
 * The greeting row carries the notification bell and basket value rather than
 * a second nav bar. Anything already reachable from the tab rail doesn't get
 * repeated in the header.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Animated, {
  useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  interpolate, Extrapolation, FadeIn,
} from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Button, Surface, ProductCardSkeleton, EmptyState,
} from '@/components/ui';
import { ProductCard } from '@/components/catalog/ProductCard';
import { color, space, radius, gutter, layout, elevation } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useAuth } from '@/contexts/AuthContext';
import { useBasket } from '@/hooks/use-basket';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listProducts, listCategories,
  type CatalogSort, type CatalogProduct,
} from '@/lib/services/catalog.service';
import { getUnreadCount } from '@/lib/services/account.service';

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'newest',     label: 'Newest' },
  { value: 'name_asc',   label: 'A–Z' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
];

const GREETING_HEIGHT = 74;

export default function CustomerCatalogScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const basketCount    = useBasket(s => s.count);
  const basketSubtotal = useBasket(s => s.subtotal);

  const [rawSearch, setRawSearch] = useState('');
  const [category,  setCategory]  = useState<number | null>(null);
  const [sort,      setSort]      = useState<CatalogSort>('newest');

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn:  getUnreadCount,
    staleTime: 30_000,
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
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 60_000,
  });

  const products: CatalogProduct[] = useMemo(
    () => productsQ.data?.pages.flatMap(p => p.records) ?? [],
    [productsQ.data],
  );

  const total  = productsQ.data?.pages[0]?.pagination.total ?? 0;
  const unread = unreadQ.data?.unread_count ?? 0;

  // Collapses the greeting into the search row, keeping search pinned.
  const greetingStyle = useAnimatedStyle(() => ({
    height:  interpolate(scrollY.value, [0, GREETING_HEIGHT], [GREETING_HEIGHT, 0], Extrapolation.CLAMP),
    opacity: interpolate(scrollY.value, [0, GREETING_HEIGHT * 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const openProduct = useCallback((sku: string) => {
    router.push(`/(customer)/catalog/${encodeURIComponent(sku)}` as never);
  }, [router]);

  const cardWidth = (width - gutter * 2 - space.md) / 2;
  const firstName = user?.first_name ?? 'there';


  const { refreshing, onRefresh } = useRefresh(productsQ.refetch, unreadQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: gutter }}>
          <Animated.View style={[{ justifyContent: 'center' }, greetingStyle]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="tertiary">Welcome back</Text>
                <Text variant="title2" numberOfLines={1}>{firstName}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <HeaderButton
                  icon="track"
                  label="Track an order"
                  onPress={() => router.push('/(customer)/track' as never)}
                />
                <HeaderButton
                  icon="notifications"
                  label="Notifications"
                  badge={unread}
                  onPress={() => router.push('/(customer)/notifications' as never)}
                />
              </View>
            </View>
          </Animated.View>

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
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}
          >
            {[{ id: 0, name: 'All', product_count: total }, ...(categoriesQ.data?.categories ?? [])].map(item => {
              const active = (item.id === 0 && category === null) || category === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id === 0 ? null : item.id)}
                  haptic="light"
                  pressScale={0.95}
                  style={{
                    paddingHorizontal: space.base,
                    height: 36,
                    borderRadius: radius.full,
                    justifyContent: 'center',
                    backgroundColor: active ? color.text : color.surface,
                    borderWidth: layout.hairlineWidth,
                    borderColor: active ? color.text : color.border,
                  }}
                >
                  <Text variant="label" style={{ color: active ? '#fff' : color.textSecondary }}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        </View>

        {/* ── Grid ── */}
        <Animated.FlatList
          data={products}
          keyExtractor={p => p.sku}
          numColumns={2}
          onScroll={onScroll}
          scrollEventThrottle={16}
          columnWrapperStyle={{ gap: space.md, paddingHorizontal: gutter }}
          contentContainerStyle={{
            gap: space.md,
            // Clears the tab bar plus the floating basket bar when present.
            paddingBottom: layout.tabBarHeight + (basketCount > 0 ? 84 : space.xl),
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (productsQ.hasNextPage && !productsQ.isFetchingNextPage) {
              void productsQ.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
            ) : productsQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load the catalogue"
                subtitle="Check your connection and try again."
                actionLabel="Retry"
                onAction={() => void productsQ.refetch()}
              />
            ) : (
              <EmptyState
                iconName="search"
                title="No products found"
                subtitle={
                  search
                    ? `Nothing matches “${search}”. Try a different term.`
                    : 'This category is empty right now.'
                }
                actionLabel={search || category ? 'Clear filters' : undefined}
                onAction={search || category
                  ? () => { setRawSearch(''); setCategory(null); }
                  : undefined}
              />
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

        {/* ── Floating basket bar ── */}
        {basketCount > 0 ? (
          <Animated.View
            entering={FadeIn.duration(240)}
            style={{
              position: 'absolute',
              left: gutter, right: gutter,
              bottom: layout.tabBarHeight - space.xs,
            }}
          >
            <Pressable
              onPress={() => router.push('/(customer)/cart' as never)}
              haptic="medium"
              pressScale={0.98}
              accessibilityRole="button"
              accessibilityLabel={`View basket, ${basketCount} items, ${formatNaira(basketSubtotal)}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.md,
                paddingHorizontal: space.base, paddingVertical: space.md,
                borderRadius: radius.xl,
                backgroundColor: color.text,
                shadowColor: color.text,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.26,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <View style={{
                minWidth: 30, height: 30, paddingHorizontal: space.sm,
                borderRadius: radius.full,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text variant="label" style={{ color: '#fff' }}>{basketCount}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ color: '#fff' }}>View basket</Text>
                <Text variant="caption" style={{ color: 'rgba(255,255,255,0.62)' }}>
                  {formatNaira(basketSubtotal)} subtotal
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

/* ── Header icon button ─────────────────────────────────────────────────── */

function HeaderButton({
  icon, label, onPress, badge = 0,
}: {
  icon: 'track' | 'notifications';
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
      style={{
        width: 40, height: 40, borderRadius: radius.full,
        backgroundColor: color.surface,
        borderWidth: layout.hairlineWidth,
        borderColor: color.border,
        alignItems: 'center', justifyContent: 'center',
        ...elevation.sm,
      }}
    >
      <Icon name={icon} size={18} color={color.text} />

      {badge > 0 ? (
        <View style={{
          position: 'absolute', top: -2, right: -2,
          minWidth: 18, height: 18, paddingHorizontal: 4,
          borderRadius: radius.full,
          backgroundColor: color.danger,
          borderWidth: 2, borderColor: color.bg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text variant="caption" style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
