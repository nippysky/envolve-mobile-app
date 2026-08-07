import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '@/constants/colors';

export default function DriverLayout() {
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
        name="deliveries/index"
        options={{ title: 'Deliveries', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.5 }}>🚴</Text> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.5 }}>📅</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, opacity: color === Colors.brand ? 1 : 0.5 }}>👤</Text> }}
      />
      {/* Hidden */}
      <Tabs.Screen name="deliveries/[id]" options={{ href: null }} />
    </Tabs>
  );
}
