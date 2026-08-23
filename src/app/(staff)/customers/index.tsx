/**
 * Customers — console.
 *
 * The list defaults to showing everyone but leads with the pending queue,
 * because reviewing a new pharmacy is the one genuinely time-sensitive task
 * here — an unapproved account can browse but can't order, so every hour in
 * the queue is an hour of lost trade.
 *
 * A rep sees only their own book — the API scopes the list for them — so there
 * is no "filter by rep" rail to offer.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Input, Pressable, Icon, Surface, Badge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listCustomers,
  type AdminCustomer, type CustomerStatus,
} from '@/lib/services/admin.service';

/**
 * Ordered by where an account sits in onboarding, not alphabetically — the list
 * doubles as a funnel. `PENDING_REVIEW` leads because it's the only one that
 * needs a human.
 */
const STATUSES: { value: CustomerStatus | null; label: string }[] = [
  { value: null,                label: 'All' },
  { value: 'PENDING_REVIEW',    label: 'Awaiting review' },
  { value: 'APPROVED',          label: 'Approved' },
  { value: 'PCN_CERT_UPLOADED', label: 'Cert uploaded' },
  { value: 'OTP_CONFIRMED',     label: 'Email confirmed' },
  { value: 'REGISTERED',        label: 'Registered' },
  { value: 'REJECTED',          label: 'Rejected' },
];

const STATUS_TONE: Record<CustomerStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED:          'success',
  PENDING_REVIEW:    'warning',
  PCN_CERT_UPLOADED: 'neutral',
  OTP_CONFIRMED:     'neutral',
  REGISTERED:        'neutral',
  REJECTED:          'danger',
};

/** Long enum values need shortening to fit a badge. */
const STATUS_LABEL: Record<CustomerStatus, string> = {
  APPROVED:          'approved',
  PENDING_REVIEW:    'awaiting review',
  PCN_CERT_UPLOADED: 'cert uploaded',
  OTP_CONFIRMED:     'email confirmed',
  REGISTERED:        'registered',
  REJECTED:          'rejected',
};

export default function ConsoleCustomersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();

  // Deep-linked from the overview's "awaiting review" action.
  const initialStatus = STATUSES.some(s => s.value === params.status)
    ? (params.status as CustomerStatus)
    : null;

  const [rawSearch, setRawSearch] = useState('');
  const [status,    setStatus]    = useState<CustomerStatus | null>(initialStatus);

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  // The "filter by rep" rail was admin-only — a staff member only ever sees
  // their own book, which the API already scopes for them.
  const customersQ = useInfiniteQuery({
    queryKey: ['customers', 'console', search, status],
    queryFn:  ({ pageParam = 1 }) => listCustomers({
      page: pageParam as number, limit: 20,
      search, status,
    }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 20_000,
  });

  const customers = useMemo(
    () => customersQ.data?.pages.flatMap(p => p.records) ?? [],
    [customersQ.data],
  );

  const total    = customersQ.data?.pages[0]?.pagination.total ?? 0;
  const filtered = !!search || !!status;

  const open = useCallback((id: number) => {
    router.push(`/(staff)/customers/${id}` as never);
  }, [router]);


  const { refreshing, onRefresh } = useRefresh(customersQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          title="Customers"
          subtitle={total > 0 ? `${total.toLocaleString()} matching` : undefined}
          scrollY={scrollY}
          right={
            <Pressable
              onPress={() => router.push('/(staff)/customers/new' as never)}
              haptic="medium"
              pressScale={0.92}
              accessibilityRole="button"
              accessibilityLabel="Add a customer"
              style={{
                width: 40, height: 40, borderRadius: radius.full,
                backgroundColor: color.text,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="user-plus" size={17} color="#fff" />
            </Pressable>
          }
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <Input
            placeholder="Pharmacy, contact name or email"
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
            {STATUSES.map(s => (
              <Pressable
                key={s.label}
                onPress={() => setStatus(s.value)}
                haptic="light"
                pressScale={0.95}
                accessibilityRole="button"
                accessibilityState={{ selected: status === s.value }}
                style={{
                  paddingHorizontal: space.md, height: 32,
                  justifyContent: 'center', borderRadius: radius.full,
                  backgroundColor: status === s.value ? color.text : color.surface,
                  borderWidth: layout.hairlineWidth,
                  borderColor: status === s.value ? color.text : color.border,
                }}
              >
                <Text variant="caption" style={{
                  color: status === s.value ? '#fff' : color.textSecondary,
                  fontWeight: status === s.value ? '700' : '500',
                }}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </Animated.ScrollView>

        </View>

        <Animated.FlatList
          data={customers}
          keyExtractor={c => String(c.id)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: layout.tabBarHeight + space.xl,
            gap: space.md,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (customersQ.hasNextPage && !customersQ.isFetchingNextPage) {
              void customersQ.fetchNextPage();
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
            <CustomerRow customer={item} index={index} onPress={() => open(item.id)} />
          )}
          ListEmptyComponent={
            customersQ.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : customersQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load customers"
                actionLabel="Retry"
                onAction={() => void customersQ.refetch()}
              />
            ) : filtered ? (
              <EmptyState
                iconName="filter"
                compact
                title="No customers match"
                actionLabel="Clear filters"
                onAction={() => { setRawSearch(''); setStatus(null); }}
              />
            ) : (
              <EmptyState
                iconName="customers"
                tone="brand"
                title="No customers yet"
                subtitle="Pharmacies that register — or that your team adds — appear here."
                actionLabel="Add a customer"
                onAction={() => router.push('/(staff)/customers/new' as never)}
              />
            )
          }
          ListFooterComponent={customersQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function CustomerRow({ customer, index, onPress }: {
  customer: AdminCustomer; index: number; onPress: () => void;
}) {
  const name = customer.company_name
    ?? `${customer.user.first_name} ${customer.user.last_name}`.trim();

  const initials = name.split(' ').filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase()).join('') || '—';

  const location = [customer.city, customer.state].filter(Boolean).join(', ');

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}>
      <Pressable onPress={onPress} haptic="light" pressScale={0.985}>
        <Surface level="sm" padded="base" rounded="lg">
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{
              width: 42, height: 42, borderRadius: radius.full,
              backgroundColor: color.surfaceMuted,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text variant="label" tone="secondary">{initials}</Text>
            </View>

            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {location || customer.user.email}
              </Text>

              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: 2 }}>
                <Badge tone={STATUS_TONE[customer.status]} size="sm" dot>
                  {STATUS_LABEL[customer.status] ?? customer.status.toLowerCase()}
                </Badge>
                {customer.pcn_verified ? (
                  <Badge tone="brand" size="sm">PCN verified</Badge>
                ) : null}
                {customer.assigned_staff ? (
                  <Badge tone="neutral" size="sm">
                    {customer.assigned_staff.first_name} {customer.assigned_staff.last_name[0]}.
                  </Badge>
                ) : (
                  <Badge tone="warning" size="sm">Unassigned</Badge>
                )}
              </View>
            </View>

            <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Icon name="chevron-right" size={16} color={color.textDisabled} />
              <Text variant="caption" tone="disabled">
                {formatDate(customer.created_at)}
              </Text>
            </View>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
}
