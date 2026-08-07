import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '@/constants/colors';

export default function StaffLayout() {
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
        name="overview"
        options={{ title: 'Overview', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.5 }}>📊</Text> }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{ title: 'Orders', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.5 }}>📋</Text> }}
      />
      <Tabs.Screen
        name="customers/index"
        options={{ title: 'Customers', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.5 }}>👥</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.5 }}>👤</Text> }}
      />
      {/* Hidden — no tab bar entry */}
      <Tabs.Screen name="orders/[id]"    options={{ href: null }} />
      <Tabs.Screen name="products/new"   options={{ href: null }} />
      <Tabs.Screen name="customers/[id]" options={{ href: null }} />
    </Tabs>
  );
}
