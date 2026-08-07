/**
 * Customer Login Screen
 *
 * Signs in a customer using /api/auth/customer/login.
 * On success, AuthContext.login() navigates to /(customer)/catalog.
 */

import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api-client';
import type { AppUser } from '@/contexts/AuthContext';

interface LoginData {
  user:   AppUser;
  tokens: {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };
}

export default function CustomerLogin() {
  const insets    = useSafeAreaInsets();
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post<LoginData>('/api/auth/customer/login', {
        email:    email.trim().toLowerCase(),
        password,
      });
      await login(res.user, res.tokens.access_token, res.tokens.refresh_token);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={[styles.roleBadge, { backgroundColor: Colors.brandLight }]}>
            <Text style={[styles.roleBadgeText, { color: Colors.brand }]}>Customer</Text>
          </View>
        </View>

        <Text style={styles.title}>Sign in to your account</Text>
        <Text style={styles.subtitle}>
          Access your orders, prescriptions, and health records
        </Text>

        {/* Form card */}
        <View style={[styles.card, { borderTopColor: Colors.brand, borderTopWidth: 3 }]}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            rightIcon={<Text style={styles.eyeIcon}>{showPwd ? '🙈' : '👁️'}</Text>}
            onRightPress={() => setShowPwd(v => !v)}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password?role=customer')}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleLogin}
          >
            Sign In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  backBtn:  { marginBottom: 24 },
  backText: { fontSize: 16, color: Colors.brand, fontWeight: '600' },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            16,
    marginBottom:   28,
  },
  logo: {
    width:  140,
    height: 51,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical:    5,
    borderRadius:       20,
  },
  roleBadgeText: { fontSize: 13, fontWeight: '700' },

  title:    { fontSize: 26, fontWeight: '800', color: Colors.ink, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: Colors.ink3, marginBottom: 28, lineHeight: 21 },

  card: {
    backgroundColor: Colors.white,
    borderRadius:    20,
    padding:         24,
    shadowColor:     '#000',
    shadowOpacity:   0.06,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 3 },
    elevation:       3,
    borderWidth:     1,
    borderColor:     Colors.line,
  },

  errorBox: {
    backgroundColor: Colors.danger + '12',
    borderRadius:    10,
    padding:         12,
    marginBottom:    16,
    borderLeftWidth:  3,
    borderLeftColor: Colors.danger,
  },
  errorText: { fontSize: 13, color: Colors.danger, lineHeight: 19 },

  forgotBtn:  { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: Colors.brand, fontWeight: '600' },
  eyeIcon:    { fontSize: 17 },
});
