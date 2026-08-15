/**
 * Notifications — console.
 *
 * Same list component as the customer app; only the link translation differs.
 * A console user tapping an order notification should land on the console's
 * order screen, not the customer's.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Pressable, Icon } from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { NotificationsList, useMarkAllRead } from '@/components/shared/NotificationsList';
import { color } from '@/constants/theme';
import { useUnreadCount } from '@/hooks/use-unread-count';

/** Web paths → console routes. Unrecognised links simply don't navigate. */
function resolveRoute(link: string | null): string | null {
  if (!link) return null;

  const order = link.match(/\/(?:portal|admin)\/orders\/(\d+)/);
  if (order) return `/(staff)/orders/${order[1]}`;

  const customer = link.match(/\/admin\/customers\/(\d+)/);
  if (customer) return `/(staff)/customers/${customer[1]}`;

  const product = link.match(/\/admin\/products\/([^/?#]+)/);
  if (product) return `/(staff)/products/${product[1]}`;

  if (link.includes('/deliveries')) return '/(staff)/deliveries';
  if (link.includes('/inventory'))  return '/(staff)/inventory';
  if (link.includes('/customers'))  return '/(staff)/customers';
  if (link.includes('/orders'))     return '/(staff)/orders';
  return null;
}

export default function ConsoleNotificationsScreen() {
  const router = useRouter();
  const markAll = useMarkAllRead();

  const { unread } = useUnreadCount();

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
        />
      </SafeAreaView>
    </View>
  );
}
