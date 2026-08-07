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
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { api, ApiError } from '@/lib/api-client';

type RoleTab = 'customer' | 'staff';

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();

  const [tab,     setTab]    = useState<RoleTab>('customer');
  const [email,   setEmail]  = useState('');
  const [loading, setLoading]= useState(false);
  const [error,   setError]  = useState('');
  const [sent,    setSent]   = useState(false);

  const endpoint = tab === 'customer'
    ? '/api/auth/customer/forgot-password'
    : '/api/auth/staff/forgot-password';

  async function handleSubmit() {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post(endpoint, { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Reset Password" back onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successEmoji}>📬</Text>
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successBody}>
              We've sent a reset link to{' '}
              <Text style={{ fontWeight: '700' }}>{email}</Text>.{'\n\n'}
              If you don't see it, check your spam folder.
            </Text>
            <Button
              variant="outline"
              size="md"
              onPress={() => router.replace('/(auth)/sign-in')}
              style={styles.backBtn}
            >
              Back to Sign In
            </Button>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              Enter the email address for your account and we'll send you a reset link.
            </Text>

            {/* Role tabs */}
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tabBtn, tab === 'customer' && styles.tabBtnActive]}
                onPress={() => { setTab('customer'); setError(''); }}
              >
                <Text style={[styles.tabText, tab === 'customer' && styles.tabTextActive]}>Customer</Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, tab === 'staff' && styles.tabBtnActive]}
                onPress={() => { setTab('staff'); setError(''); }}
              >
                <Text style={[styles.tabText, tab === 'staff' && styles.tabTextActive]}>Staff / Driver</Text>
              </Pressable>
            </View>

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
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onPress={handleSubmit}
            >
              Send Reset Link
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flexGrow: 1, padding: 24 },
  intro:   { fontSize: 15, color: Colors.ink2, lineHeight: 23, marginBottom: 20 },

  tabs: {
    flexDirection:   'row',
    backgroundColor: Colors.bgMuted,
    borderRadius:    12,
    padding:         4,
    marginBottom:    20,
  },
  tabBtn:        { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabBtnActive:  { backgroundColor: Colors.white },
  tabText:       { fontSize: 13, fontWeight: '600', color: Colors.ink3 },
  tabTextActive: { color: Colors.brand },

  errorBox: {
    backgroundColor: Colors.danger + '12',
    borderRadius:    10,
    padding:         12,
    marginBottom:    16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  errorText: { fontSize: 13, color: Colors.danger },

  successBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successEmoji: { fontSize: 56 },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.ink },
  successBody:  { fontSize: 15, color: Colors.ink2, textAlign: 'center', lineHeight: 23 },
  backBtn:      { marginTop: 16 },
});
