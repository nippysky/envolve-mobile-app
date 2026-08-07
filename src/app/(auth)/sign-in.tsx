import React, { useState } from 'react';
import {
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

/**
 * API unwraps the outer { status, message, data } envelope automatically.
 * So the returned value is already the inner { user, tokens } object.
 */
interface LoginData {
  user:   AppUser;
  tokens: {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };
}

type RoleTab = 'customer' | 'staff';

export default function SignIn() {
  const insets    = useSafeAreaInsets();
  const { login } = useAuth();

  const [tab,      setTab]      = useState<RoleTab>('customer');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const endpoint = tab === 'customer'
    ? '/api/auth/customer/login'
    : '/api/auth/staff/login';

  function switchTab(t: RoleTab) {
    setTab(t);
    setError('');
    setEmail('');
    setPassword('');
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post<LoginData>(endpoint, {
        email:    email.trim().toLowerCase(),
        password,
      });
      // api-client unwraps .data, so res = { user, tokens }
      await login(res.user, res.tokens.access_token, res.tokens.refresh_token);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>💊</Text>
          </View>
          <Text style={styles.appName}>EnvolveCare Plus</Text>
          <Text style={styles.tagline}>Your pharmacy, delivered</Text>
        </View>

        {/* Role tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tabBtn, tab === 'customer' && styles.tabBtnActive]}
            onPress={() => switchTab('customer')}
          >
            <Text style={[styles.tabText, tab === 'customer' && styles.tabTextActive]}>
              Customer
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'staff' && styles.tabBtnActive]}
            onPress={() => switchTab('staff')}
          >
            <Text style={[styles.tabText, tab === 'staff' && styles.tabTextActive]}>
              Staff / Driver
            </Text>
          </Pressable>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>
            {tab === 'customer'
              ? 'Sign in to shop and track your orders'
              : 'Sign in to your staff or driver account'}
          </Text>

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
            rightIcon={
              <Text style={styles.eyeIcon}>{showPwd ? '🙈' : '👁️'}</Text>
            }
            onRightPress={() => setShowPwd(v => !v)}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
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

        {/* Legal links */}
        <View style={styles.legal}>
          <Text style={styles.legalText}>
            By signing in you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/terms')}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/privacy')}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  brand: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: Colors.brand + '15',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    12,
  },
  logoEmoji: { fontSize: 38 },
  appName:   { fontSize: 22, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  tagline:   { fontSize: 13, color: Colors.ink3, marginTop: 4 },

  tabs: {
    flexDirection:   'row',
    backgroundColor: Colors.bgMuted,
    borderRadius:    14,
    padding:         4,
    marginBottom:    20,
  },
  tabBtn: {
    flex:           1,
    paddingVertical: 10,
    borderRadius:   10,
    alignItems:     'center',
  },
  tabBtnActive: { backgroundColor: Colors.white },
  tabText:      { fontSize: 13, fontWeight: '600', color: Colors.ink3 },
  tabTextActive:{ color: Colors.brand },

  card: {
    backgroundColor: Colors.white,
    borderRadius:    20,
    padding:         24,
    shadowColor:     '#000',
    shadowOpacity:   0.07,
    shadowRadius:    20,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       4,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.ink, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: Colors.ink3, marginBottom: 24 },

  errorBox: {
    backgroundColor: Colors.danger + '12',
    borderRadius:    10,
    padding:         12,
    marginBottom:    16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  errorText: { fontSize: 13, color: Colors.danger, lineHeight: 19 },

  forgotBtn:  { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: Colors.brand, fontWeight: '600' },
  eyeIcon:    { fontSize: 17 },

  legal: { marginTop: 28, alignItems: 'center' },
  legalText: { fontSize: 12, color: Colors.ink4, textAlign: 'center', lineHeight: 18 },
  legalLink: { color: Colors.brand, fontWeight: '600' },
});
