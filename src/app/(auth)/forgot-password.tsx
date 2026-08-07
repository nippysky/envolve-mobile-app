/**
 * Forgot Password Screen
 *
 * Accepts ?role=customer|staff (passed from the login screen via router.push).
 * Falls back to letting the user choose if no role param is present.
 * Hits the correct endpoint per role.
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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api-client';

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const { role: paramRole } = useLocalSearchParams<{ role?: string }>();

  // Determine endpoint: if the caller passed ?role=staff use staff, otherwise customer
  const isStaff   = paramRole === 'staff';
  const endpoint  = isStaff
    ? '/api/auth/staff/forgot-password'
    : '/api/auth/customer/forgot-password';

  const [email,   setEmail]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]  = useState('');
  const [sent,    setSent]   = useState(false);

  async function handleSubmit() {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post(endpoint, { email: email.trim().toLowerCase() });
      setSent(true);
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

        {/* Logo */}
        <Image
          source={require('../../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {sent ? (
          /* ── Success state ── */
          <View style={styles.successBox}>
            <View style={styles.successIcon}>
              <Text style={{ fontSize: 40 }}>📬</Text>
            </View>
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successBody}>
              We've sent a reset link to{' '}
              <Text style={{ fontWeight: '700', color: Colors.ink }}>{email}</Text>.
              {'\n\n'}
              If you don't see it, check your spam folder.
            </Text>
            <Button
              variant="outline"
              size="md"
              onPress={() => router.replace('/(auth)/sign-in')}
              style={styles.backToSignIn}
            >
              Back to Sign In
            </Button>
          </View>
        ) : (
          /* ── Form state ── */
          <>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              Enter your{' '}
              {isStaff ? 'work email' : 'email address'} and we'll send you a secure reset link.
            </Text>

            <View style={styles.card}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Input
                label={isStaff ? 'Work email' : 'Email address'}
                placeholder={isStaff ? 'staff@envolvepharma.com' : 'you@example.com'}
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
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  backBtn:  { marginBottom: 24 },
  backText: { fontSize: 16, color: Colors.brand, fontWeight: '600' },

  logo: { width: 160, height: 58, marginBottom: 32 },

  title:    { fontSize: 26, fontWeight: '800', color: Colors.ink, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: Colors.ink3, marginBottom: 28, lineHeight: 21 },

  card: {
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         24,
    shadowColor:     '#000',
    shadowOpacity:   0.06,
    shadowRadius:    14,
    shadowOffset:    { width: 0, height: 3 },
    elevation:       3,
    borderWidth:     1,
    borderColor:     Colors.line,
    gap:             16,
  },

  errorBox: {
    backgroundColor: Colors.danger + '12',
    borderRadius:    10,
    padding:         12,
    borderLeftWidth:  3,
    borderLeftColor: Colors.danger,
  },
  errorText: { fontSize: 13, color: Colors.danger, lineHeight: 19 },

  successBox: {
    alignItems:     'center',
    justifyContent: 'center',
    flex:           1,
    gap:             16,
    paddingTop:     32,
  },
  successIcon: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: Colors.brandLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  successTitle: {
    fontSize:   24,
    fontWeight: '800',
    color:      Colors.ink,
  },
  successBody: {
    fontSize:   15,
    color:      Colors.ink3,
    textAlign:  'center',
    lineHeight: 23,
  },
  backToSignIn: { marginTop: 8 },
});
