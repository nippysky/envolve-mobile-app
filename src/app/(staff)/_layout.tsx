/**
 * Console navigation — staff.
 *
 * Admins don't sign in here; administration (settings, the team roster, the
 * audit trail, catalogue authoring) lives in the web console. That makes this
 * a single-role stack, so nothing on these screens branches on role any more.
 *
 * "More" is a real destination, not an overflow menu. Inventory, deliveries
 * and reports are all occasional — they belong on a hub screen where they can
 * carry context (low-stock count, pending reviews) rather than crammed into a
 * rail.
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
      <Tabs.Screen name="inventory"       options={{ href: null }} />
      <Tabs.Screen name="deliveries"      options={{ href: null }} />
      <Tabs.Screen name="reports"         options={{ href: null }} />
      <Tabs.Screen name="search"          options={{ href: null }} />
      <Tabs.Screen name="notifications"   options={{ href: null }} />
      <Tabs.Screen name="profile"         options={{ href: null }} />
    </Tabs>
  );
}
