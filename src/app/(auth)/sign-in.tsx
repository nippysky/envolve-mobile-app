/**
 * Role Selection Screen — auth entry point.
 * Two cards: Customer and Staff/Admin/Driver.
 * Guests can also browse the public catalogue without logging in.
 */

import React from 'react';
import {
  Image,
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

interface RoleCard {
  iconName: IconName;
  title:    string;
  desc:     string;
  accent:   string;
  tint:     string;
  route:    string;
}

const ROLES: RoleCard[] = [
  {
    iconName: 'shop',
    title:    'Customer',
    desc:     'Shop, order medicines & track your deliveries',
    accent:   Colors.brand,
    tint:     Colors.brandLight,
    route:    '/(auth)/customer-login',
  },
  {
    iconName: 'team',
    title:    'Staff / Admin / Driver',
    desc:     'Pharmacists, admins, managers & delivery drivers',
    accent:   Colors.teal,
    tint:     Colors.tealLight,
    route:    '/(auth)/staff-login',
  },
];

export default function RoleSelect() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      {/* Brand */}
      <View style={styles.header}>
        <Image
          source={require('../../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Your pharmacy, delivered</Text>
      </View>

      {/* Headline */}
      <Text style={styles.heroTitle}>Welcome back</Text>
      <Text style={styles.heroSub}>Select your role to continue</Text>

      {/* Role cards */}
      <View style={styles.cards}>
        {ROLES.map((role) => (
          <RoleCardBtn key={role.title} role={role} />
        ))}
      </View>

      {/* Browse catalogue without login */}
      <Pressable
        style={styles.guestBtn}
        onPress={() => router.push('/(public)/catalogue')}
      >
        <Icon name="product" size={16} color={Colors.ink3} />
        <Text style={styles.guestBtnText}>Browse catalogue without signing in</Text>
        <Icon name="chevron-right" size={16} color={Colors.ink4} />
      </Pressable>

      {/* Legal */}
      <Text style={styles.legalText}>
        By signing in you agree to our{' '}
        <Text style={styles.legalLink} onPress={() => router.push('/terms')}>Terms</Text>
        {' '}and{' '}
        <Text style={styles.legalLink} onPress={() => router.push('/privacy')}>Privacy Policy</Text>
      </Text>
    </ScrollView>
  );
}

function RoleCardBtn({ role }: { role: RoleCard }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: role.accent, borderLeftWidth: 4 },
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(role.route as any)}
    >
      <View style={[styles.iconWrap, { backgroundColor: role.tint }]}>
        <Icon name={role.iconName} size={24} color={role.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: role.accent }]}>{role.title}</Text>
        <Text style={styles.cardDesc}>{role.desc}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={role.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 24 },

  header: { alignItems: 'center', marginBottom: 36 },
  logo:   { width: 200, height: 73, marginBottom: 10 },
  tagline:{ ...type.caption, color: Colors.ink3, letterSpacing: 0.3 },

  heroTitle: { ...type.title, color: Colors.ink, marginBottom: 4 },
  heroSub:   { ...type.body, color: Colors.ink3, marginBottom: 28 },

  cards: { gap: 14 },

  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         18,
    gap:             14,
    shadowColor:     '#000',
    shadowOpacity:   0.06,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
    borderWidth:     1,
    borderColor:     Colors.line,
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },

  iconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:  { flex: 1 },
  cardTitle: { ...type.h3, marginBottom: 2 },
  cardDesc:  { ...type.caption, color: Colors.ink3, lineHeight: 18 },

  guestBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 16,
    marginTop:       24,
    justifyContent:  'center',
  },
  guestBtnText: { ...type.bodyMed, color: Colors.ink3 },

  legalText: {
    ...type.caption,
    color:     Colors.ink4,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
  },
  legalLink: { color: Colors.brand, fontWeight: '600' },
});
