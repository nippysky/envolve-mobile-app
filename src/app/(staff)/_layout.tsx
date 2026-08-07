import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { Icon } from '@/components/ui/Icon';

export default function StaffLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarActiveTintColor:   Colors.brand,
        tabBarInactiveTintColor: Colors.ink4,
        tabBarStyle: {
          borderTopWidth:  0.5,
          borderTopColor:  Colors.line,
          backgroundColor: Colors.white,
          paddingTop:      6,
          paddingBottom:   Platform.OS === 'ios' ? 20 : 8,
          height:          Platform.OS === 'ios' ? 82 : 64,
          elevation:       8,
          shadowColor:     '#000',
          shadowOpacity:   0.06,
          shadowRadius:    12,
          shadowOffset:    { width: 0, height: -2 },
        },
        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    '600',
          letterSpacing: 0.2,
          marginTop:     2,
        },
      }}
    >
      <Tabs.Screen
        name="overview"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color, size }) => (
            <Icon name="overview" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Icon name="orders" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers/index"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, size }) => (
            <Icon name="customers" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="profile" size={size ?? 22} color={color} />
          ),
        }}
      />
      {/* Hidden screens — no tab bar entry */}
      <Tabs.Screen name="orders/[id]"        options={{ href: null }} />
      <Tabs.Screen name="products/new"       options={{ href: null }} />
      <Tabs.Screen name="customers/[id]"     options={{ href: null }} />
      <Tabs.Screen name="customers/new"      options={{ href: null }} />
      <Tabs.Screen name="team/index"         options={{ href: null }} />
      <Tabs.Screen name="team/new"           options={{ href: null }} />
    </Tabs>
  );
}
