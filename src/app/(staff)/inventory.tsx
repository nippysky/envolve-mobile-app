/**
 * Inventory — console.
 *
 * A batch list, not a product list. The same SKU appears once per batch,
 * because expiry and cost are batch properties and merging them would hide
 * exactly what this screen exists to surface: which specific batch is about to
 * expire, and which is running out.
 *
 * The two filters are the two reasons anyone opens this: something's low, or
 * something's expiring. Both are server-side flags the API already computes
 * (`is_low_stock`, `is_near_expiry`), so the client never re-derives a
 * threshold and drifts from the warehouse's definition.
 *
 * Read-only by design. Receiving, adjusting and batch edits are admin actions —
 * the API returns 403 for anyone else — and no admin signs in to this app, so
 * every write affordance here would fail for every user who could see it. A rep
 * needs this screen to answer "have we got it, and does it expire soon?" while a
 * pharmacist is on the phone; that is all it does.
 */

import React, { useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Surface, Badge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatTile } from '@/components/admin/StatTile';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listInventory, getInventoryStats, type InventoryBatch,
} from '@/lib/services/admin.service';

type Filter = 'all' | 'low' | 'expiring';

export default function InventoryScreen() {
  const [rawSearch, setRawSearch] = useState('');
  const [filter,    setFilter]    = useState<Filter>('all');


  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const statsQ = useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn:  getInventoryStats,
    staleTime: 60_000,
  });

  const inventoryQ = useInfiniteQuery({
    queryKey: ['inventory', 'list', search, filter],
    queryFn:  ({ pageParam = 1 }) => listInventory({
      page: pageParam as number, limit: 20, search,
      low_stock:   filter === 'low',
      near_expiry: filter === 'expiring',
    }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const batches = useMemo(
    () => inventoryQ.data?.pages.flatMap(p => p.records) ?? [],
    [inventoryQ.data],
  );

  const stats = statsQ.data;


  const { refreshing, onRefresh } = useRefresh(inventoryQ.refetch, statsQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Inventory"
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <StatTile
              index={0}
              icon="products"
              label="SKUs"
              value={String(stats?.total_skus ?? 0)}
              hint="In the catalogue"
              loading={statsQ.isLoading}
            />
            <StatTile
              index={1}
              icon="inventory"
              label="Packs in stock"
              value={(stats?.total_stock ?? 0).toLocaleString()}
              hint="Across all batches"
              loading={statsQ.isLoading}
            />
          </View>

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

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <FilterChip
              label="All batches"
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <FilterChip
              label="Low stock"
              count={stats?.low_stock_count}
              tone="warning"
              active={filter === 'low'}
              onPress={() => setFilter('low')}
            />
            <FilterChip
              label="Expiring"
              count={stats?.expiring_count}
              tone="danger"
              active={filter === 'expiring'}
              onPress={() => setFilter('expiring')}
            />
          </View>
        </View>

        <Animated.FlatList
          data={batches}
          keyExtractor={b => String(b.id)}
          // iOS insets the scroll view for the keyboard itself, which avoids the
          // KeyboardAvoidingView offset guesswork. Android is adjustResize (see
          // AndroidManifest), so the window already shrinks and this is a no-op.
          automaticallyAdjustKeyboardInsets
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
            gap: space.md,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (inventoryQ.hasNextPage && !inventoryQ.isFetchingNextPage) {
              void inventoryQ.fetchNextPage();
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
            <BatchCard batch={item} index={index} />
          )}
          ListEmptyComponent={
            inventoryQ.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : inventoryQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load inventory"
                actionLabel="Retry"
                onAction={() => void inventoryQ.refetch()}
              />
            ) : filter !== 'all' ? (
              <EmptyState
                iconName="check-circle"
                compact
                title={filter === 'low' ? 'Nothing running low' : 'Nothing expiring soon'}
                subtitle="That's the good outcome."
                actionLabel="Show all batches"
                onAction={() => setFilter('all')}
              />
            ) : (
              <EmptyState
                iconName="inventory"
                title="No stock recorded"
                subtitle={search ? `Nothing matches “${search}”.` : 'Batches appear here once stock is received.'}
              />
            )
          }
          ListFooterComponent={inventoryQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>


    </View>
  );
}


/* ── Bits ───────────────────────────────────────────────────────────────── */

function FilterChip({ label, count, tone, active, onPress }: {
  label: string; count?: number; tone?: 'warning' | 'danger';
  active: boolean; onPress: () => void;
}) {
  const activeBg = tone === 'danger' ? color.danger
    : tone === 'warning' ? color.warning
    : color.text;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingHorizontal: space.sm, height: 34,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        borderRadius: radius.full,
        backgroundColor: active ? activeBg : color.surface,
        borderWidth: layout.hairlineWidth,
        borderColor: active ? activeBg : color.border,
      }}
    >
      <Text
        variant="caption"
        numberOfLines={1}
        style={{
          color: active ? '#fff' : color.textSecondary,
          fontWeight: active ? '700' : '500',
        }}
      >
        {label}
      </Text>
      {count ? (
        <Text variant="caption" style={{
          color: active ? 'rgba(255,255,255,0.75)' : color.textTertiary,
          fontWeight: '700', fontSize: 10,
        }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function BatchCard({ batch, index }: {
  batch: InventoryBatch;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}>
      <Surface level="sm" padded="base" rounded="lg">
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{
              width: 46, height: 46, borderRadius: radius.md,
              backgroundColor: color.surfaceSubtle,
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {batch.product.primary_image ? (
                <Image
                  source={{ uri: batch.product.primary_image }}
                  style={{ width: '76%', height: '76%' }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Icon name="product" size={18} color={color.textDisabled} />
              )}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" numberOfLines={1}>{batch.product.brand_name}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {batch.product.sku} · batch {batch.batch_number}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: 2 }}>
                {batch.is_low_stock ? <Badge tone="warning" size="sm">Low stock</Badge> : null}
                {batch.is_near_expiry ? <Badge tone="danger" size="sm">Expiring soon</Badge> : null}
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="title3">{batch.quantity}</Text>
              <Text variant="caption" tone="disabled">packs</Text>
            </View>
          </View>

          <View style={{
            flexDirection: 'row', gap: space.base, flexWrap: 'wrap',
            paddingTop: space.sm,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.borderSubtle,
          }}>
            {/* No cost price here. Only STAFF and DRIVER reach this app, and
                showing a rep what we paid gives them the margin on every batch.
                Admins see it in the web console. */}
            <Meta
              label="Expires"
              value={batch.expiry_date ? formatDate(batch.expiry_date) : 'No date'}
              tone={batch.is_near_expiry ? 'danger' : undefined}
            />
            <Meta label="Min level" value={String(batch.product.minimum_stock_level)} />
          </View>

        </View>
      </Surface>
    </Animated.View>
  );
}

function Meta({ label, value, tone }: {
  label: string; value: string; tone?: 'danger';
}) {
  return (
    <View style={{ minWidth: 84 }}>
      <Text variant="caption" tone="disabled">{label}</Text>
      <Text variant="caption" tone={tone ?? 'secondary'} numberOfLines={1}>{value}</Text>
    </View>
  );
}
