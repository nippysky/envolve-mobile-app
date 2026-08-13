/**
 * Console navigation — admin and staff.
 *
 * Four tabs, same for both roles. The difference between an admin and a staff
 * member isn't *where* they go, it's what they can do once there, and the API
 * enforces that with 403s. Giving staff a visibly shorter tab bar would tell
 * them what they're missing without telling them why; instead each screen
 * shows or hides its own write actions based on role.
 *
 * "More" is a real destination, not an overflow menu. Inventory, deliveries,
 * team, reports, settings and audit are all occasional — they belong on a hub
 * screen where they can carry context (low-stock count, pending reviews)
 * rather than crammed into a rail.
 */

import React from 'react';
import { Tabs } from 'expo-router';

import { TabBar, type TabConfig } from '@/components/navigation/TabBar';

const TABS: TabConfig[] = [
  { name: 'overview',        label: 'Overview',  icon: 'overview' },
  { name: 'orders/index',    label: 'Orders',    icon: 'orders' },
  { name: 'customers/index', label: 'Customers', icon: 'customers' },
  { name: 'more',            label: 'More',      icon: 'more' },
];

export default function StaffLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={props => (
        <TabBar state={props.state} navigation={props.navigation} tabs={TABS} />
      )}
    >
      <Tabs.Screen name="overview"        options={{ title: 'Overview' }} />
      <Tabs.Screen name="orders/index"    options={{ title: 'Orders' }} />
      <Tabs.Screen name="customers/index" options={{ title: 'Customers' }} />
      <Tabs.Screen name="more"            options={{ title: 'More' }} />

      {/* Pushed routes — part of the stack, never shown as tabs. */}
      <Tabs.Screen name="orders/[id]"     options={{ href: null }} />
      <Tabs.Screen name="orders/new"      options={{ href: null }} />
      <Tabs.Screen name="customers/[id]"  options={{ href: null }} />
      <Tabs.Screen name="customers/new"   options={{ href: null }} />
      <Tabs.Screen name="products/index"  options={{ href: null }} />
      <Tabs.Screen name="products/[sku]"  options={{ href: null }} />
      <Tabs.Screen name="products/new"    options={{ href: null }} />
      <Tabs.Screen name="inventory"       options={{ href: null }} />
      <Tabs.Screen name="deliveries"      options={{ href: null }} />
      <Tabs.Screen name="team/index"      options={{ href: null }} />
      <Tabs.Screen name="team/new"        options={{ href: null }} />
      <Tabs.Screen name="reports"         options={{ href: null }} />
      <Tabs.Screen name="settings"        options={{ href: null }} />
      <Tabs.Screen name="audit"           options={{ href: null }} />
      <Tabs.Screen name="notifications"   options={{ href: null }} />
      <Tabs.Screen name="profile"         options={{ href: null }} />
    </Tabs>
  );
}
