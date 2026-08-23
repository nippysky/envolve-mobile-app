/**
 * Search — console.
 *
 * One field across products, customers and orders. A rep on the phone doesn't
 * know whether the thing they've been given is a SKU, a pharmacy name or an
 * order number — they just have a string. Making them pick the right tab first
 * is asking them to answer a question they opened the app to ask.
 *
 * Three constraints come straight from `/api/search`:
 *
 *   1. Queries under two characters are rejected with a 400, so the query is
 *      gated on length rather than firing on the first keystroke — otherwise
 *      typing "a" produces an error before you've finished the word.
 *   2. Each group is capped at five server-side. That's a deliberate "did I
 *      find it?" answer, not a browse surface, so a group at its cap offers a
 *      link into the full list screen rather than pagination.
 *   3. Results are cached for 30s server-side, so re-running a query a rep just
 *      ran costs nothing.
 *
 * Every row navigates to the real detail screen. Nothing here is a dead end.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Surface, Badge, StatusBadge,
  EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useDebounced } from '@/hooks/use-debounced';
import { globalSearch, type SearchResults } from '@/lib/services/admin.service';

/** The API's own floor. Below this it returns 400, so don't ask. */
const MIN_QUERY = 2;
/** `MAX_PER` on the server — a group this size is probably truncated. */
const GROUP_CAP = 5;

export default function ConsoleSearchScreen() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const query = useDebounced(raw.trim(), 350);

  const enabled = query.length >= MIN_QUERY;

  const searchQ = useQuery({
    queryKey: ['search', query],
    queryFn:  () => globalSearch(query),
    enabled,
    // Matches the server's own 30s cache — re-running a recent query is free.
    staleTime: 30_000,
  });

  const results = searchQ.data;

  const total = useMemo(() => {
    if (!results) return 0;
    return results.products.length + results.customers.length + results.orders.length;
  }, [results]);

  const go = useCallback((route: string) => {
    Keyboard.dismiss();
    router.push(route as never);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Search"
          subtitle={enabled && results ? `${total} ${total === 1 ? 'match' : 'matches'}` : undefined}
        />

        <View style={{ paddingHorizontal: gutter, paddingBottom: space.md }}>
          <Input
            placeholder="Product, pharmacy or order number"
            value={raw}
            onChangeText={setRaw}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            leading={<Icon name="search" size={17} color={color.textTertiary} />}
            trailing={raw ? <Icon name="close" size={16} color={color.textTertiary} /> : undefined}
            onTrailingPress={raw ? () => setRaw('') : undefined}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: layout.tabBarHeight + space['2xl'],
            gap: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {!enabled ? (
            <EmptyState
              iconName="search"
              title="What are you looking for?"
              subtitle={
                raw.length > 0
                  ? `Keep typing — search needs at least ${MIN_QUERY} characters.`
                  : 'Search across products, pharmacies and orders at once.'
              }
            />
          ) : searchQ.isLoading ? (
            <View style={{ gap: space.md, paddingTop: space.sm }}>
              {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
            </View>
          ) : searchQ.isError ? (
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Couldn’t run that search"
              subtitle={(searchQ.error as Error)?.message}
              actionLabel="Try again"
              onAction={() => void searchQ.refetch()}
            />
          ) : total === 0 ? (
            <EmptyState
              iconName="search"
              title="Nothing found"
              subtitle={`No product, pharmacy or order matches “${query}”.`}
            />
          ) : (
            <>
              <Group
                title="Products"
                count={results!.products.length}
                onSeeAll={results!.products.length >= GROUP_CAP
                  ? () => go('/(staff)/products')
                  : undefined}
              >
                {results!.products.map((p, i) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    index={i}
                    last={i === results!.products.length - 1}
                    onPress={() => go(`/(staff)/products/${encodeURIComponent(p.sku)}`)}
                  />
                ))}
              </Group>

              <Group
                title="Pharmacies"
                count={results!.customers.length}
                onSeeAll={results!.customers.length >= GROUP_CAP
                  ? () => go('/(staff)/customers')
                  : undefined}
              >
                {results!.customers.map((c, i) => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    index={i}
                    last={i === results!.customers.length - 1}
                    onPress={() => go(`/(staff)/customers/${c.id}`)}
                  />
                ))}
              </Group>

              <Group
                title="Orders"
                count={results!.orders.length}
                onSeeAll={results!.orders.length >= GROUP_CAP
                  ? () => go('/(staff)/orders')
                  : undefined}
              >
                {results!.orders.map((o, i) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    index={i}
                    last={i === results!.orders.length - 1}
                    onPress={() => go(`/(staff)/orders/${o.id}`)}
                  />
                ))}
              </Group>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

/** Renders nothing when the group is empty — an empty section is just noise. */
function Group({ title, count, onSeeAll, children }: {
  title: string;
  count: number;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text variant="overline" tone="tertiary" style={{ flex: 1 }}>{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} haptic="light" pressOpacity={0.6} hitSlop={8}>
            <Text variant="label" tone="brand">See all</Text>
          </Pressable>
        ) : (
          <Badge tone="neutral" size="sm">{count}</Badge>
        )}
      </View>

      <Surface level="sm" padded="none" rounded="lg">{children}</Surface>
    </View>
  );
}

function Row({ index, last, onPress, children }: {
  index: number; last: boolean; onPress: () => void; children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 30).duration(260)}>
      <Pressable
        onPress={onPress}
        haptic="light"
        pressOpacity={0.6}
        pressScale={1}
        accessibilityRole="button"
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space.md,
          paddingHorizontal: space.base, paddingVertical: space.md,
          minHeight: layout.tapTarget,
          borderBottomWidth: last ? 0 : layout.hairlineWidth,
          borderBottomColor: color.borderSubtle,
        }}
      >
        {children}
        <Icon name="chevron-right" size={15} color={color.textDisabled} />
      </Pressable>
    </Animated.View>
  );
}

function ProductRow({ product, index, last, onPress }: {
  product: SearchResults['products'][number];
  index: number; last: boolean; onPress: () => void;
}) {
  return (
    <Row index={index} last={last} onPress={onPress}>
      <View style={{
        width: 38, height: 38, borderRadius: radius.md,
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
          <Icon name="product" size={16} color={color.textDisabled} />
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{product.brand_name}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {product.generic_name || product.sku}
        </Text>
      </View>

      {product.status !== 'ACTIVE' ? (
        <Badge tone={product.status === 'DRAFT' ? 'warning' : 'neutral'} size="sm">
          {product.status.toLowerCase()}
        </Badge>
      ) : null}
    </Row>
  );
}

function CustomerRow({ customer, index, last, onPress }: {
  customer: SearchResults['customers'][number];
  index: number; last: boolean; onPress: () => void;
}) {
  const title = customer.company_name ?? customer.name;

  return (
    <Row index={index} last={last} onPress={onPress}>
      <View style={{
        width: 38, height: 38, borderRadius: radius.full,
        backgroundColor: color.brandSoft,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="building" size={16} color={color.brand} filled />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{title}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>{customer.email}</Text>
      </View>

      {customer.status !== 'APPROVED' ? (
        <Badge tone={customer.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
          {customer.status === 'PENDING_REVIEW' ? 'review' : customer.status.toLowerCase()}
        </Badge>
      ) : null}
    </Row>
  );
}

function OrderRow({ order, index, last, onPress }: {
  order: SearchResults['orders'][number];
  index: number; last: boolean; onPress: () => void;
}) {
  return (
    <Row index={index} last={last} onPress={onPress}>
      <View style={{
        width: 38, height: 38, borderRadius: radius.md,
        backgroundColor: color.surfaceMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="orders" size={16} color={color.textSecondary} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{order.order_number}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {order.customer_name} · {formatNaira(order.total)}
        </Text>
      </View>

      <StatusBadge status={order.status} kind="order" size="sm" />
    </Row>
  );
}
