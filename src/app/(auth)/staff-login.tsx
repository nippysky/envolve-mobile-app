/**
 * Staff and driver sign-in.
 *
 * One endpoint for all three internal roles — POST /api/auth/staff/login. The
 * role comes back on the user object and AuthContext routes accordingly, so
 * this screen doesn't need to know where anyone lands.
 *
 * Visually distinguished from the customer door by the accent colour: staff
 * are entering an operations console, not a shop.
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthScreen } from '@/components/shared/AuthScreen';
import { Text, Button, Input, Pressable, Icon, Surface } from '@/components/ui';
import { color, space } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { loginStaff } from '@/lib/services/auth.service';

export default function StaffLoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const passwordRef = useRef<TextInput>(null);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [reveal,   setReveal]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [errs,     setErrs]     = useState<Record<string, string>>({});

  const submit = useCallback(async () => {
    if (busy) return;

    const e: Record<string, string> = {};
    if (!email.trim())             e.email    = 'Enter your work email';
    else if (!email.includes('@')) e.email    = 'That email doesn’t look right';
    if (!password)                 e.password = 'Enter your password';
    setErrs(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    setError('');

    try {
      const res = await loginStaff(email, password);

      // Belt-and-braces: the API already rejects non-ACTIVE accounts with 403,
      // but a disabled account slipping through would land in the console.
      if (res.user.status && res.user.status.toUpperCase() !== 'ACTIVE') {
        setError(`Your account is ${res.user.status.toLowerCase()}. Contact your administrator.`);
        setBusy(false);
        return;
      }

      // signIn routes by role — staff to the console, drivers to their
      // assignments. Admin roles are rejected there, not here.
      await signIn(res.user, res.tokens);
    } catch (err) {
      const e2 = err as Error & { status?: number };
      setError(
        e2.status === 401 ? 'Email or password is incorrect.'
        : e2.status === 403 ? e2.message
        : e2.message || 'Could not sign you in. Please try again.',
      );
      setBusy(false);
    }
  }, [busy, email, password, signIn]);

  return (
    <AuthScreen
      eyebrow="Operations"
      title="Staff sign in"
      subtitle="For sales staff and drivers. Administrators sign in on the web console."
      footer={
        <Pressable
          onPress={() => router.replace('/(auth)/customer-login')}
          haptic="light"
          pressOpacity={0.6}
          style={{ alignItems: 'center', paddingVertical: space.md }}
        >
          <Text variant="callout" tone="tertiary">
            Not staff?{' '}
            <Text variant="callout" tone="brand" weight="600">Pharmacy sign in</Text>
          </Text>
        </Pressable>
      }
    >
      <View style={{ gap: space.base }}>
        <Surface tone="subtle" level="none" padded="md" rounded="md">
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Icon name="shield" size={16} color={color.accent} filled />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              Every action in the console is recorded against your name.
            </Text>
          </View>
        </Surface>

        {error ? (
          <Surface tone="danger" level="none" padded="md" rounded="md">
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <Icon name="alert" size={16} color={color.danger} filled />
              <Text variant="callout" style={{ flex: 1, color: '#991b1b' }}>{error}</Text>
            </View>
          </Surface>
        ) : null}

        <Input
          label="Work email"
          placeholder="you@envolvepharm.com.ng"
          value={email}
          onChangeText={t => { setEmail(t); setErrs(p => ({ ...p, email: '' })); }}
          error={errs.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          leading={<Icon name="email" size={17} color={color.textTertiary} />}
          editable={!busy}
        />

        <Input
          ref={passwordRef}
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={t => { setPassword(t); setErrs(p => ({ ...p, password: '' })); }}
          error={errs.password}
          secureTextEntry={!reveal}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          leading={<Icon name="lock" size={17} color={color.textTertiary} />}
          trailing={<Icon name={reveal ? 'eye-off' : 'eye'} size={18} color={color.textTertiary} />}
          onTrailingPress={() => setReveal(r => !r)}
          editable={!busy}
        />

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password?audience=staff')}
          haptic="light"
          pressOpacity={0.6}
          style={{ alignSelf: 'flex-end', paddingVertical: space.xs }}
        >
          <Text variant="label" tone="brand">Forgot password?</Text>
        </Pressable>

        <Button
          size="lg"
          fullWidth
          loading={busy}
          disabled={busy}
          onPress={submit}
          haptic="medium"
        >
          {busy ? 'Signing in…' : 'Sign in to console'}
        </Button>
      </View>
    </AuthScreen>
  );
}
