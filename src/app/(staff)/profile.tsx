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
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { capitalise } from '@/lib/format';

export default function StaffProfile() {
  const insets           = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const initials = user ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : '?';

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: Colors.teal }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.rolePill, { backgroundColor: Colors.teal + '20' }]}>
          <Text style={[styles.roleText, { color: Colors.teal }]}>{capitalise(user?.role ?? '')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin</Text>
        <MenuRow icon="📊" label="Dashboard"  onPress={() => router.push('/(staff)/overview')} />
        <MenuRow icon="📋" label="Orders"     onPress={() => router.push('/(staff)/orders')} />
        <MenuRow icon="👥" label="Customers"  onPress={() => router.push('/(staff)/customers')} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <MenuRow icon="📄" label="Terms & Conditions" onPress={() => router.push('/terms')} />
        <MenuRow icon="🔒" label="Privacy Policy"     onPress={() => router.push('/privacy')} />
      </View>

      <View style={styles.signOutSection}>
        <Button variant="danger" size="lg" fullWidth onPress={confirmLogout}>Sign Out</Button>
        <Text style={styles.version}>EnvolveCare Plus v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function MenuRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [row.wrap, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Text style={row.icon}>{icon}</Text>
      <Text style={row.label}>{label}</Text>
      <Text style={row.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  content:    { gap: 12 },
  avatarSection: { alignItems: 'center', paddingVertical: 32, backgroundColor: Colors.white, gap: 8 },
  avatar:     { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 28, fontWeight: '800', color: Colors.white },
  name:       { fontSize: 20, fontWeight: '700', color: Colors.ink },
  email:      { fontSize: 14, color: Colors.ink3 },
  rolePill:   { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  roleText:   { fontSize: 12, fontWeight: '700' },
  section:    { backgroundColor: Colors.white, borderRadius: 16, marginHorizontal: 16, overflow: 'hidden' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.ink4, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  signOutSection: { paddingHorizontal: 16, paddingTop: 8, gap: 16, alignItems: 'center' },
  version:    { fontSize: 12, color: Colors.ink4 },
});

const row = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderTopWidth: 1, borderTopColor: Colors.line },
  icon:    { fontSize: 18 },
  label:   { flex: 1, fontSize: 15, color: Colors.ink, fontWeight: '500' },
  chevron: { fontSize: 20, color: Colors.ink4, lineHeight: 22 },
});
