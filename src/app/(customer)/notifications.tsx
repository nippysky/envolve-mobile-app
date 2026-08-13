/**
 * Notifications — customer.
 *
 * Uses the shared list; only the link translation is audience-specific. The
 * API's `link` is a web path like `/portal/orders/12`, translated here to the
 * native customer route so a notification about an order lands on the order
 * screen rather than opening a browser.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Pressable, Icon } from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { NotificationsList, useMarkAllRead } from '@/components/shared/NotificationsList';
import { color, layout } from '@/constants/theme';
import { getUnreadCount } from '@/lib/services/account.service';

/** Web paths → customer routes. Unrecognised links simply don't navigate. */
function resolveRoute(link: string | null): string | null {
  if (!link) return null;

  const order = link.match(/\/(?:portal|admin)\/orders\/(\d+)/);
  if (order) return `/(customer)/orders/${order[1]}`;

  if (link.includes('/referral')) return '/(customer)/referrals';
  if (link.includes('/orders'))   return '/(customer)/orders';
  if (link.includes('/catalog'))  return '/(customer)/catalog';
  return null;
}

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const markAll = useMarkAllRead();

  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn:  getUnreadCount,
    staleTime: 30_000,
  });

  const unread = unreadQ.data?.unread_count ?? 0;

  const navigate = useCallback((route: string) => {
    router.push(route as never);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Notifications"
          subtitle={unread > 0 ? `${unread} unread` : undefined}
          right={
            unread > 0 ? (
              <Pressable
                onPress={() => markAll.mutate()}
                haptic="light"
                pressOpacity={0.6}
                hitSlop={8}
                disabled={markAll.isPending}
                accessibilityRole="button"
                accessibilityLabel="Mark all as read"
              >
                <Icon name="check" size={18} color={color.brand} />
              </Pressable>
            ) : undefined
          }
        />

        <NotificationsList
          resolveRoute={resolveRoute}
          onNavigate={navigate}
          bottomInset={layout.tabBarHeight}
        />
      </SafeAreaView>
    </View>
  );
}
