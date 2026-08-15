/**
 * Driver navigation.
 *
 * Three tabs, because a driver on a motorcycle in Lagos traffic has one hand
 * and about two seconds. Everything that isn't "what am I delivering right
 * now" is one tap away, not zero.
 *
 * `/api/deliveries` scopes itself to the signed-in driver, so none of these
 * screens filter by driver id — the server already did.
 */

import React from 'react';
import { Tabs } from 'expo-router';

import { TabBar, type TabConfig } from '@/components/navigation/TabBar';

const TABS: TabConfig[] = [
  { name: 'deliveries/index', label: 'Today',   icon: 'truck' },
  { name: 'history',          label: 'History', icon: 'clipboard' },
  { name: 'profile',          label: 'Account', icon: 'profile' },
];

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={props => (
        <TabBar state={props.state} navigation={props.navigation} tabs={TABS} />
      )}
    >
      <Tabs.Screen name="deliveries/index" options={{ title: 'Today' }} />
      <Tabs.Screen name="history"          options={{ title: 'History' }} />
      <Tabs.Screen name="profile"          options={{ title: 'Account' }} />

      {/* Pushed routes — part of the stack, never tabs. */}
      <Tabs.Screen name="deliveries/[id]"  options={{ href: null }} />
      <Tabs.Screen name="notifications"    options={{ href: null }} />
    </Tabs>
  );
}
