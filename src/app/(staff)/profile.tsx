import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { capitalise } from '@/lib/format';

export default function StaffProfile() {
  const insets           = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : '?';

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: Colors.teal }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{capitalise(user?.role ?? '')}</Text>
        </View>
      </View>

      {/* Navigation section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{capitalise(user?.role ?? 'Staff')}</Text>
        <MenuRow iconName="overview"   label="Dashboard"  onPress={() => router.push('/(staff)/overview')} />
        <MenuRow iconName="orders"     label="Orders"     onPress={() => router.push('/(staff)/orders')} />
        <MenuRow iconName="customers"  label="Customers"  onPress={() => router.push('/(staff)/customers')} />
        {isAdmin && (
          <MenuRow iconName="team" label="Team Management" onPress={() => router.push('/(staff)/team')} />
        )}
      </View>

      {/* Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <MenuRow iconName="clipboard" label="Terms & Conditions" onPress={() => router.push('/terms')} />
        <MenuRow iconName="lock"      label="Privacy Policy"     onPress={() => router.push('/privacy')} />
      </View>

      {/* Sign out */}
      <View style={styles.signOutSection}>
        <Button variant="danger" size="lg" fullWidth onPress={confirmLogout}>
          Sign Out
        </Button>
        <Text style={styles.version}>EnvolveCare Plus v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function MenuRow({
  iconName,
  label,
  onPress,
}: {
  iconName: IconName;
  label:    string;
  onPress:  () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [row.wrap, pressed && { backgroundColor: Colors.bgMuted }]}
      onPress={onPress}
    >
      <View style={row.iconWrap}>
        <Icon name={iconName} size={18} color={Colors.ink3} />
      </View>
      <Text style={row.label}>{label}</Text>
      <Icon name="chevron-right" size={16} color={Colors.ink4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { gap: 12 },

  avatarSection: {
    alignItems:      'center',
    paddingTop:      36,
    paddingBottom:   28,
    backgroundColor: Colors.white,
    gap:             6,
  },
  avatar: {
    width:          80,
    height:         80,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   6,
  },
  avatarText: { ...type.hero, fontSize: 28, color: Colors.white },
  name:       { ...type.h2, color: Colors.ink },
  email:      { ...type.bodySm, color: Colors.ink3 },
  rolePill: {
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   5,
    backgroundColor:   Colors.tealLight,
    marginTop:         4,
  },
  roleText: { ...type.label, color: Colors.teal },

  section: {
    backgroundColor: Colors.white,
    borderRadius:    16,
    marginHorizontal: 16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.03,
    shadowRadius:    6,
    elevation:       1,
  },
  sectionTitle: {
    ...type.overline,
    color:             Colors.ink4,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     6,
  },

  signOutSection: {
    paddingHorizontal: 16,
    paddingTop:        8,
    gap:               14,
    alignItems:        'center',
  },
  version: { ...type.caption, color: Colors.ink4 },
});

const row = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap:             14,
    borderTopWidth:  0.5,
    borderTopColor:  Colors.line,
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   10,
    backgroundColor: Colors.bgMuted,
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: { flex: 1, ...type.bodyMed, color: Colors.ink },
});
