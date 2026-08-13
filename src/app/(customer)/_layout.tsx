/**
 * Customer tab navigation.
 *
 * Uses the custom TabBar so icons swap outline → filled on selection. The
 * stock tab bar can't do that cleanly because it hands the icon a single
 * `color` and expects one glyph back.
 *
 * Four tabs is the ceiling here. Referrals, tracking and notifications are all
 * real destinations but they're occasional — they live off the Account tab and
 * the shop header rather than competing for the thumb rail.
 */

import React from 'react';
import { Tabs } from 'expo-router';

import { TabBar, type TabConfig } from '@/components/navigation/TabBar';
import { useBasket } from '@/hooks/use-basket';

const TABS: TabConfig[] = [
  { name: 'catalog/index', label: 'Shop',    icon: 'shop' },
  { name: 'orders/index',  label: 'Orders',  icon: 'orders' },
  { name: 'cart',          label: 'Basket',  icon: 'cart' },
  { name: 'profile',       label: 'Account', icon: 'profile' },
];

export default function CustomerLayout() {
  const itemCount = useBasket(s => s.count);

  // Badge is injected per-render so the basket count stays live.
  const tabs = TABS.map(t => (t.name === 'cart' ? { ...t, badge: itemCount } : t));

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={props => (
        <TabBar state={props.state} navigation={props.navigation} tabs={tabs} />
      )}
    >
      <Tabs.Screen name="catalog/index" options={{ title: 'Shop' }} />
      <Tabs.Screen name="orders/index"  options={{ title: 'Orders' }} />
      <Tabs.Screen name="cart"          options={{ title: 'Basket' }} />
      <Tabs.Screen name="profile"       options={{ title: 'Account' }} />

      {/* Pushed routes — part of the stack, never shown as tabs. */}
      <Tabs.Screen name="catalog/[sku]"  options={{ href: null }} />
      <Tabs.Screen name="orders/[id]"    options={{ href: null }} />
      <Tabs.Screen name="checkout"       options={{ href: null }} />
      <Tabs.Screen name="notifications"  options={{ href: null }} />
      <Tabs.Screen name="referrals"      options={{ href: null }} />
      <Tabs.Screen name="track"          options={{ href: null }} />
      <Tabs.Screen name="profile-edit"   options={{ href: null }} />
    </Tabs>
  );
}
