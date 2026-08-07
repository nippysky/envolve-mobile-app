import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/colors';

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.55 }}>
      {emoji}
    </Text>
  );
}

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarActiveTintColor:   Colors.brand,
        tabBarInactiveTintColor: Colors.ink4,
        tabBarStyle: {
          borderTopColor:  Colors.line,
          backgroundColor: Colors.white,
          paddingBottom:   4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="catalog/index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) => <TabIcon emoji="🛍️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => <TabIcon emoji="🛒" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <TabIcon emoji="📦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
        }}
      />
      {/* Hidden sub-screens */}
      <Tabs.Screen name="catalog/[sku]"  options={{ href: null }} />
      <Tabs.Screen name="orders/[id]"    options={{ href: null }} />
      <Tabs.Screen name="checkout"       options={{ href: null }} />
    </Tabs>
  );
}
