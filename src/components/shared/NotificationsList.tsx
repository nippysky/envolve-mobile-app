/**
 * Notifications list — shared by the customer app and the console.
 *
 * `/api/notifications` is role-agnostic: it returns whatever was addressed to
 * the signed-in user. The only thing that differs between audiences is where a
 * notification's `link` should land, so that's the one prop this takes.
 *
 * Marking read happens on tap or via the header action, never on scroll —
 * auto-marking as someone scrolls past destroys the signal they were using to
 * find their place.
 */

import React, { useCallback, useMemo } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { Pressable } from '@/components/ui/Pressable';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import {
  listNotifications, markNotificationsRead, type AppNotification,
} from '@/lib/services/account.service';
import { toast } from '@/lib/toast';

/** Maps the API's notification `type` to a glyph and accent. */
function present(type: string): { icon: IconName; tint: string } {
  const t = type.toUpperCase();
  if (t.includes('PAYMENT'))  return { icon: 'money',      tint: color.success };
  if (t.includes('DELIVERY')) return { icon: 'truck',      tint: color.accent };
  if (t.includes('ORDER'))    return { icon: 'orders',     tint: color.brand };
  if (t.includes('REFERRAL')) return { icon: 'referrals',  tint: '#a855f7' };
  if (t.includes('STOCK') || t.includes('INVENTORY')) {
    return { icon: 'inventory', tint: color.warning };
  }
  if (t.includes('CUSTOMER')) return { icon: 'customers',  tint: color.brand };
  if (t.includes('REJECT') || t.includes('FAIL')) return { icon: 'alert', tint: color.danger };
  if (t.includes('APPROV'))   return { icon: 'check-circle', tint: color.success };
  return { icon: 'notifications', tint: color.textTertiary };
}

export interface NotificationsListProps {
  /**
   * Translates a web `link` (e.g. `/portal/orders/12`) into a native route.
   * Return null to make the row non-navigating — better than pushing a route
   * that doesn't exist for this audience.
   */
  resolveRoute: (link: string | null) => string | null;
  onNavigate:   (route: string) => void;
  /** Extra bottom padding, e.g. to clear a tab bar. */
  bottomInset?: number;
}

export function NotificationsList({
  resolveRoute, onNavigate, bottomInset = 0,
}: NotificationsListProps) {
  const queryClient = useQueryClient();

  const notificationsQ = useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn:  ({ pageParam = 1 }) => listNotifications({ page: pageParam as number, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 20_000,
  });

  const items = useMemo(
    () => notificationsQ.data?.pages.flatMap(p => p.records) ?? [],
    [notificationsQ.data],
  );

  const markRead = useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: err => toast.error((err as Error).message, 'Could not update'),
  });

  const open = useCallback((n: AppNotification) => {
    if (!n.is_read) markRead.mutate([n.id]);
    const route = resolveRoute(n.link);
    if (route) onNavigate(route);
  }, [markRead, resolveRoute, onNavigate]);

  return (
    <FlatList
      data={items}
      keyExtractor={n => String(n.id)}
      contentContainerStyle={{
        paddingHorizontal: gutter,
        paddingTop: space.md,
        paddingBottom: bottomInset + space.xl,
        gap: space.sm,
      }}
      showsVerticalScrollIndicator={false}
      onEndReached={() => {
        if (notificationsQ.hasNextPage && !notificationsQ.isFetchingNextPage) {
          void notificationsQ.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={notificationsQ.isRefetching && !notificationsQ.isFetchingNextPage}
          onRefresh={() => void notificationsQ.refetch()}
          tintColor={color.brand}
        />
      }
      renderItem={({ item, index }) => (
        <NotificationRow notification={item} index={index} onPress={() => open(item)} />
      )}
      ListEmptyComponent={
        notificationsQ.isLoading ? (
          <View style={{ gap: space.md }}>
            {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
          </View>
        ) : notificationsQ.isError ? (
          <EmptyState
            iconName="alert"
            tone="danger"
            title="Couldn’t load notifications"
            actionLabel="Retry"
            onAction={() => void notificationsQ.refetch()}
          />
        ) : (
          <EmptyState
            iconName="notifications"
            title="You’re all caught up"
            subtitle="Updates appear here as things happen."
          />
        )
      }
      ListFooterComponent={notificationsQ.isFetchingNextPage ? <RowSkeleton /> : null}
    />
  );
}

/** Header action — exported so screens can put it in their own ScreenHeader. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: err => toast.error((err as Error).message, 'Could not update'),
  });
}

function NotificationRow({ notification, index, onPress }: {
  notification: AppNotification; index: number; onPress: () => void;
}) {
  const { icon, tint } = present(notification.type);
  const unread = !notification.is_read;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
      <Pressable
        onPress={onPress}
        haptic="light"
        pressScale={0.985}
        accessibilityRole="button"
        accessibilityLabel={`${notification.title}. ${notification.body}${unread ? '. Unread' : ''}`}
        style={{
          flexDirection: 'row',
          gap: space.md,
          padding: space.base,
          borderRadius: radius.lg,
          backgroundColor: unread ? color.surface : 'transparent',
          borderWidth: layout.hairlineWidth,
          borderColor: unread ? color.border : 'transparent',
          // Left rail is the unread signal — visible without reading the text.
          borderLeftWidth: unread ? 3 : layout.hairlineWidth,
          borderLeftColor: unread ? tint : 'transparent',
        }}
      >
        <View style={{
          width: 34, height: 34, borderRadius: radius.full,
          backgroundColor: unread ? `${tint}1f` : color.surfaceMuted,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon
            name={icon}
            size={16}
            color={unread ? tint : color.textDisabled}
            filled={unread}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant={unread ? 'bodyMedium' : 'body'}
            tone={unread ? 'default' : 'secondary'}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={3}>
            {notification.body}
          </Text>
          <Text variant="caption" tone="disabled" style={{ marginTop: 2 }}>
            {timeAgo(notification.created_at)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
