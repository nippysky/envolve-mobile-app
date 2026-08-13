/**
 * Password reset — two steps in one screen.
 *
 *   1. Request → POST /api/auth/{audience}/forgot-password  (emails a 6-digit OTP)
 *   2. Reset   → POST /api/auth/{audience}/reset-password   { email, otp_code, new_password }
 *
 * `audience` comes in as a route param so the same screen serves customers and
 * staff, hitting the correct endpoint pair for each.
 *
 * The request step always reports success regardless of whether the account
 * exists — the API is deliberately built that way to avoid confirming which
 * email addresses are registered, and the UI must not undermine it by saying
 * "no account found".
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { AuthScreen } from '@/components/shared/AuthScreen';
import { Text, Button, Input, Pressable, Icon, Surface } from '@/components/ui';
import { color, space } from '@/constants/theme';
import { forgotPassword, resetPassword, type Audience } from '@/lib/services/auth.service';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ audience?: string }>();

  const audience: Audience = params.audience === 'staff' ? 'staff' : 'customer';

  const [stage,    setStage]    = useState<'request' | 'reset' | 'done'>('request');
  const [email,    setEmail]    = useState('');
  const [code,     setCode]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [reveal,   setReveal]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  const rules = useMemo(() => ({
    length: password.length >= 8,
    upper:  /[A-Z]/.test(password),
    lower:  /[a-z]/.test(password),
    digit:  /[0-9]/.test(password),
    match:  password.length > 0 && password === confirm,
  }), [password, confirm]);

  const allValid = Object.values(rules).every(Boolean);

  const request = useCallback(async () => {
    if (busy) return;
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }

    setBusy(true); setError('');
    try {
      await forgotPassword(audience, email);
      setStage('reset');
    } catch (err) {
      setError((err as Error).message || 'Could not send the reset code.');
    } finally {
      setBusy(false);
    }
  }, [busy, email, audience]);

  const reset = useCallback(async () => {
    if (busy || !allValid || code.length !== 6) return;

    setBusy(true); setError('');
    try {
      await resetPassword(audience, email, code, password);
      setStage('done');
    } catch (err) {
      setError((err as Error).message || 'Could not reset your password.');
      setBusy(false);
    }
  }, [busy, allValid, code, audience, email, password]);

  const signInPath = audience === 'staff'
    ? '/(auth)/staff-login'
    : '/(auth)/customer-login';

  /* ── Done ───────────────────────────────────────────────────────────── */

  if (stage === 'done') {
    return (
      <AuthScreen
        showBack={false}
        title="Password updated"
        subtitle="You can now sign in with your new password."
        footer={
          <Button size="lg" fullWidth onPress={() => router.replace(signInPath as never)}>
            Back to sign in
          </Button>
        }
      >
        <Surface tone="success" level="none" padded="base" rounded="lg">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Icon name="check-circle" size={18} color={color.success} filled />
            <Text variant="callout" style={{ flex: 1, color: '#14532d' }}>
              Your password has been changed. Any other devices signed in with the
              old password will need to sign in again.
            </Text>
          </View>
        </Surface>
      </AuthScreen>
    );
  }

  /* ── Request / Reset ────────────────────────────────────────────────── */

  return (
    <AuthScreen
      eyebrow={audience === 'staff' ? 'Operations' : 'Pharmacy account'}
      title={stage === 'request' ? 'Reset password' : 'Choose a new password'}
      subtitle={
        stage === 'request'
          ? 'We’ll email you a 6-digit code to confirm it’s you.'
          : `Enter the code sent to ${email} and pick a new password.`
      }
      footer={
        stage === 'request' ? (
          <Button size="lg" fullWidth loading={busy} disabled={busy} onPress={request}>
            {busy ? 'Sending…' : 'Send reset code'}
          </Button>
        ) : (
          <Button
            size="lg" fullWidth
            loading={busy}
            disabled={busy || !allValid || code.length !== 6}
            onPress={reset}
          >
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        )
      }
    >
      <View style={{ gap: space.base }}>
        {error ? (
          <Surface tone="danger" level="none" padded="md" rounded="md">
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <Icon name="alert" size={16} color={color.danger} filled />
              <Text variant="callout" style={{ flex: 1, color: '#991b1b' }}>{error}</Text>
            </View>
          </Surface>
        ) : null}

        {stage === 'request' ? (
          <Animated.View entering={FadeInRight.duration(240)}>
            <Input
              label="Email address"
              placeholder={audience === 'staff' ? 'you@envolvepharm.com.ng' : 'you@pharmacy.com'}
              value={email}
              onChangeText={t => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={() => void request()}
              leading={<Icon name="email" size={17} color={color.textTertiary} />}
              editable={!busy}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInRight.duration(240)} style={{ gap: space.base }}>
            <Input
              label="Reset code"
              placeholder="000000"
              value={code}
              onChangeText={t => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              inputStyle={{ letterSpacing: 8, fontSize: 22, fontWeight: '700', textAlign: 'center' }}
              editable={!busy}
            />

            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              textContentType="newPassword"
              leading={<Icon name="lock" size={17} color={color.textTertiary} />}
              trailing={<Icon name={reveal ? 'eye-off' : 'eye'} size={18} color={color.textTertiary} />}
              onTrailingPress={() => setReveal(r => !r)}
              editable={!busy}
            />

            <Input
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              leading={<Icon name="lock" size={17} color={color.textTertiary} />}
              editable={!busy}
            />

            <Surface level="none" tone="subtle" padded="base" rounded="md">
              <View style={{ gap: space.xs }}>
                {([
                  ['length', 'At least 8 characters'],
                  ['upper',  'One uppercase letter'],
                  ['lower',  'One lowercase letter'],
                  ['digit',  'One number'],
                  ['match',  'Passwords match'],
                ] as const).map(([key, label]) => {
                  const ok = rules[key];
                  return (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Icon
                        name={ok ? 'check-circle' : 'close'}
                        size={13}
                        color={ok ? color.success : color.textDisabled}
                        filled={ok}
                      />
                      <Text variant="caption" tone={ok ? 'success' : 'tertiary'}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </Surface>

            <Pressable
              onPress={() => { setStage('request'); setCode(''); setError(''); }}
              haptic="light"
              pressOpacity={0.6}
              style={{ alignItems: 'center', paddingVertical: space.sm }}
            >
              <Text variant="callout" tone="tertiary">
                Didn&rsquo;t get a code? <Text variant="callout" tone="brand" weight="600">Try again</Text>
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </AuthScreen>
  );
}
