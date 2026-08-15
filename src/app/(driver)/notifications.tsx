/**
 * Notifications — driver.
 *
 * The driver app had no notifications surface at all, which meant a delivery
 * reassigned or cancelled by dispatch reached the driver only if they happened
 * to pull-to-refresh the right screen.
 *
 * Link translation is narrower here than for the other audiences on purpose. A
 * driver has no order screen and no customer records, so an order link resolves
 * to their delivery list rather than pushing a route that would render an
 * empty or forbidden screen. Anything unrecognised simply doesn't navigate —
 * the notification still reads fine as text.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Pressable, Icon } from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { NotificationsList, useMarkAllRead } from '@/components/shared/NotificationsList';
import { color, layout } from '@/constants/theme';
import { useUnreadCount } from '@/hooks/use-unread-count';

function resolveRoute(link: string | null): string | null {
  if (!link) return null;

  const delivery = link.match(/\/deliveries\/(\d+)/);
  if (delivery) return `/(driver)/deliveries/${delivery[1]}`;

  if (link.includes('/deliveries')) return '/(driver)/deliveries';
  // Orders exist for a driver only as the delivery attached to them.
  if (link.includes('/orders'))     return '/(driver)/deliveries';
  return null;
}

export default function DriverNotificationsScreen() {
  const router  = useRouter();
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
          bottomInset={layout.tabBarHeight}
        />
      </SafeAreaView>
    </View>
  );
}
