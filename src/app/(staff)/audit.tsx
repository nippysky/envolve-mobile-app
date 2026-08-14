/**
 * Audit trail — admin only.
 *
 * Every write in the console lands here with who did it, when, and against
 * what. The value is in being able to answer "who marked this order paid?"
 * months later, so the design priority is scanability over density: one entry
 * per card, action first, actor second.
 *
 * Action names come back as SCREAMING_SNAKE constants. They're humanised for
 * display but the raw value stays searchable, because that's what someone
 * grepping logs will have.
 *
 * The filter is a free-text `action` match against the server, not a fixed
 * enum. New actions get added as features ship, and a hardcoded list here
 * would quietly stop showing them.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Surface, Badge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { timeAgo, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounced } from '@/hooks/use-debounced';
import { listAuditLogs, type AuditLogEntry } from '@/lib/services/admin.service';
import type { IconName } from '@/components/ui/Icon';

/** Common action families, as substrings the server matches with `contains`. */
const FILTERS: { value: string | null; label: string }[] = [
  { value: null,       label: 'Everything' },
  { value: 'ORDER',    label: 'Orders' },
  { value: 'PAYMENT',  label: 'Payments' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'PRODUCT',  label: 'Products' },
  { value: 'STOCK',    label: 'Stock' },
  { value: 'DELIVERY', label: 'Deliveries' },
  { value: 'STAFF',    label: 'Team' },
  { value: 'SETTING',  label: 'Settings' },
];

/** Maps an action name to a glyph and accent. Falls through to neutral. */
function present(action: string): { icon: IconName; tint: string } {
  const a = action.toUpperCase();
  if (a.includes('DELETE') || a.includes('CANCEL') || a.includes('REJECT')) {
    return { icon: 'trash', tint: color.danger };
  }
  if (a.includes('PAYMENT'))  return { icon: 'money',     tint: color.success };
  if (a.includes('DELIVERY')) return { icon: 'truck',     tint: color.accent };
  if (a.includes('ORDER'))    return { icon: 'orders',    tint: color.brand };
  if (a.includes('CUSTOMER')) return { icon: 'customers', tint: color.brand };
  if (a.includes('PRODUCT'))  return { icon: 'products',  tint: color.textSecondary };
  if (a.includes('STOCK') || a.includes('INVENTORY')) {
    return { icon: 'inventory', tint: color.warning };
  }
  if (a.includes('STAFF') || a.includes('USER')) return { icon: 'team', tint: color.textSecondary };
  if (a.includes('SETTING'))  return { icon: 'settings',  tint: color.textSecondary };
  if (a.includes('LOGIN'))    return { icon: 'lock',      tint: color.textTertiary };
  return { icon: 'shield', tint: color.textTertiary };
}

const humanise = (action: string) =>
  action.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

export default function AuditScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [rawSearch, setRawSearch] = useState('');
  const [action,    setAction]    = useState<string | null>(null);

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const logsQ = useInfiniteQuery({
    queryKey: ['audit', search, action],
    queryFn:  ({ pageParam = 1 }) =>
      listAuditLogs({ page: pageParam as number, limit: 25, search, action }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    enabled: isAdmin,
    staleTime: 20_000,
  });

  const entries = useMemo(
    () => logsQ.data?.pages.flatMap(p => p.records) ?? [],
    [logsQ.data],
  );

  const total    = logsQ.data?.pages[0]?.pagination.total ?? 0;
  const filtered = !!search || !!action;

  const { refreshing, onRefresh } = useRefresh(logsQ.refetch);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Audit trail" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              iconName="lock"
              title="Admins only"
              subtitle="The audit trail is restricted to administrators."
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }


  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Audit trail"
          subtitle={total > 0 ? `${total.toLocaleString()} entries` : undefined}
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <Input
            placeholder="Search by name or email"
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
            {FILTERS.map(f => {
              const active = action === f.value;
              return (
                <Pressable
                  key={f.label}
                  onPress={() => setAction(f.value)}
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
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        </View>

        <Animated.FlatList
          data={entries}
          keyExtractor={e => String(e.id)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
            gap: space.sm,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (logsQ.hasNextPage && !logsQ.isFetchingNextPage) {
              void logsQ.fetchNextPage();
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
          renderItem={({ item, index }) => <LogRow entry={item} index={index} />}
          ListEmptyComponent={
            logsQ.isLoading ? (
              <View style={{ gap: space.sm }}>
                {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : logsQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load the audit trail"
                actionLabel="Retry"
                onAction={() => void logsQ.refetch()}
              />
            ) : filtered ? (
              <EmptyState
                iconName="filter"
                compact
                title="Nothing matches"
                actionLabel="Clear filters"
                onAction={() => { setRawSearch(''); setAction(null); }}
              />
            ) : (
              <EmptyState
                iconName="shield"
                title="Nothing recorded yet"
                subtitle="Every write in the console is logged here as it happens."
              />
            )
          }
          ListFooterComponent={logsQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>
    </View>
  );
}

function LogRow({ entry, index }: { entry: AuditLogEntry; index: number }) {
  const { icon, tint } = present(entry.action);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30).duration(280)}>
      <Surface level="sm" padded="md" rounded="lg">
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{
            width: 32, height: 32, borderRadius: radius.full,
            backgroundColor: `${tint}1f`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={15} color={tint} filled />
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                {humanise(entry.action)}
              </Text>
              <Text variant="caption" tone="disabled">{timeAgo(entry.created_at)}</Text>
            </View>

            {entry.description ? (
              <Text variant="caption" tone="secondary" numberOfLines={3}>
                {entry.description}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: 2 }}>
              <Badge tone="neutral" size="sm">
                {entry.user_name ?? entry.email ?? 'System'}
              </Badge>
              {entry.user_type ? (
                <Badge tone="neutral" size="sm">{entry.user_type.toLowerCase()}</Badge>
              ) : null}
              {entry.entity_type ? (
                <Badge tone="neutral" size="sm">
                  {entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''}
                </Badge>
              ) : null}
            </View>

            <Text variant="caption" tone="disabled" style={{ marginTop: 2 }}>
              {formatDate(entry.created_at)}
              {entry.ip_address ? ` · ${entry.ip_address}` : ''}
            </Text>
          </View>
        </View>
      </Surface>
    </Animated.View>
  );
}
