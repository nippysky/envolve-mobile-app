/**
 * Today — the driver's active runs.
 *
 * Shows only what's still live. A driver doesn't need a list of everything
 * they've ever delivered while they're on the road; that's what History is
 * for. Settled runs drop off this screen the moment they settle, which also
 * makes "am I done?" answerable at a glance — an empty list means yes.
 *
 * Ordering follows the API (newest first) rather than being re-sorted by
 * status. A driver works the list they were given; reordering it under them
 * between refreshes would lose their place.
 *
 * Every card is one tap from the two things that matter on a doorstep: calling
 * the pharmacy, and opening directions.
 */

import React, { useCallback, useMemo } from 'react';
import { View, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Pressable, Icon, Surface, Badge, StatusBadge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { openDirections } from '@/lib/directions';
import { useAuth } from '@/contexts/AuthContext';
import {
  listMyDeliveries, SETTLED, type DriverDelivery,
} from '@/lib/services/driver.service';

export default function DriverTodayScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const deliveriesQ = useInfiniteQuery({
    queryKey: ['deliveries', 'mine', 'active'],
    queryFn:  ({ pageParam = 1 }) => listMyDeliveries({ page: pageParam as number, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 15_000,
  });

  // Active only. The API has no "not settled" filter, so this is a client-side
  // partition over pages already fetched — cheap, because a driver's list is
  // short by nature.
  const active = useMemo(
    () => (deliveriesQ.data?.pages.flatMap(p => p.records) ?? [])
      .filter(d => !SETTLED.includes(d.status)),
    [deliveriesQ.data],
  );

  const toCollect = useMemo(
    () => active.filter(d => d.order?.payment_status !== 'PAID').length,
    [active],
  );

  const open = useCallback((id: number) => {
    router.push(`/(driver)/deliveries/${id}` as never);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          eyebrow="On the road"
          title={`Hello, ${user?.first_name ?? 'driver'}`}
          subtitle={
            active.length === 0
              ? 'Nothing assigned to you right now.'
              : `${active.length} ${active.length === 1 ? 'delivery' : 'deliveries'} to make`
              + (toCollect > 0 ? ` · ${toCollect} needs payment collected` : '')
          }
          scrollY={scrollY}
        />

        <Animated.FlatList
          data={active}
          keyExtractor={d => String(d.id)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: space.sm,
            paddingBottom: layout.tabBarHeight + space.xl,
            gap: space.md,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (deliveriesQ.hasNextPage && !deliveriesQ.isFetchingNextPage) {
              void deliveriesQ.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={deliveriesQ.isRefetching && !deliveriesQ.isFetchingNextPage}
              onRefresh={() => void deliveriesQ.refetch()}
              tintColor={color.brand}
            />
          }
          renderItem={({ item, index }) => (
            <RunCard delivery={item} index={index} onPress={() => open(item.id)} />
          )}
          ListEmptyComponent={
            deliveriesQ.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : deliveriesQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load your deliveries"
                subtitle="Check your connection and pull to refresh."
                actionLabel="Retry"
                onAction={() => void deliveriesQ.refetch()}
              />
            ) : (
              <EmptyState
                iconName="check-circle"
                tone="brand"
                title="All clear"
                subtitle="Nothing assigned to you at the moment. New runs appear here as dispatch assigns them."
                secondaryLabel="See past deliveries"
                onSecondary={() => router.push('/(driver)/history' as never)}
              />
            )
          }
          ListFooterComponent={deliveriesQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>
    </View>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────── */

function RunCard({ delivery, index, onPress }: {
  delivery: DriverDelivery; index: number; onPress: () => void;
}) {
  const order    = delivery.order;
  const customer = order?.customer;

  const name = customer
    ? (customer.company_name ?? `${customer.first_name} ${customer.last_name}`.trim())
    : 'Unknown pharmacy';

  const address = [order?.delivery_address, order?.delivery_city, order?.delivery_state]
    .filter(Boolean).join(', ');

  const collectCash = order?.payment_status !== 'PAID';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(340)}>
      <Surface level="sm" padded="base" rounded="lg">
        <View style={{ gap: space.md }}>
          <Pressable onPress={onPress} haptic="light" pressOpacity={0.75}>
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyMedium" numberOfLines={2}>{name}</Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {order?.order_number ?? '—'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={color.textDisabled} />
              </View>

              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <StatusBadge status={delivery.status} kind="delivery" size="sm" />
                {collectCash ? (
                  <Badge tone="warning" size="sm" dot>
                    Collect {formatNaira(order?.total ?? 0)}
                  </Badge>
                ) : (
                  <Badge tone="success" size="sm">Already paid</Badge>
                )}
              </View>

              {address ? (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="location" size={14} color={color.textTertiary} />
                  <Text variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={2}>
                    {address}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          {/* The two doorstep actions, on the card so they never need a tap
              through a detail screen first. */}
          <View style={{
            flexDirection: 'row', gap: space.sm,
            paddingTop: space.sm,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.borderSubtle,
          }}>
            {customer?.phone ? (
              <Action
                icon="phone"
                label="Call"
                onPress={() => void Linking.openURL(`tel:${customer.phone!.replace(/\s/g, '')}`)}
              />
            ) : null}
            {address ? (
              <Action icon="location" label="Directions" onPress={() => openDirections(address)} />
            ) : null}
            <Action icon="truck" label="Open run" onPress={onPress} primary />
          </View>
        </View>
      </Surface>
    </Animated.View>
  );
}

function Action({ icon, label, onPress, primary = false }: {
  icon: 'phone' | 'location' | 'truck';
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        height: layout.tapTarget,
        borderRadius: radius.md,
        backgroundColor: primary ? color.text : color.surfaceMuted,
      }}
    >
      <Icon name={icon} size={15} color={primary ? '#fff' : color.textSecondary} />
      <Text variant="caption" style={{
        color: primary ? '#fff' : color.textSecondary,
        fontWeight: '600',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
