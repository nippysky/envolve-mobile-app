/**
 * Customer sign-in.
 *
 * Consumes POST /api/auth/customer/login, which returns the user and a token
 * pair in its JSON body specifically so native clients can use it.
 *
 * The submit button locks on press and stays locked through navigation — the
 * same double-submit guard the web needed after customers double-tapped and
 * triggered duplicate requests.
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthScreen } from '@/components/shared/AuthScreen';
import { Text, Button, Input, Pressable, Icon, Surface } from '@/components/ui';
import { color, space } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { loginCustomer } from '@/lib/services/auth.service';

export default function CustomerLoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const passwordRef = useRef<TextInput>(null);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [reveal,   setReveal]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback(async () => {
    // Guard against a second invocation landing before the disabled state
    // renders — the bug that produced duplicate submissions on web.
    if (busy) return;

    const errs: Record<string, string> = {};
    if (!email.trim())        errs.email    = 'Enter your email address';
    else if (!email.includes('@')) errs.email = 'That email doesn’t look right';
    if (!password)            errs.password = 'Enter your password';
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError('');

    try {
      const res = await loginCustomer(email, password);
      await signIn(res.user, res.tokens);
      // Deliberately not clearing `busy` — the button stays locked until this
      // screen unmounts on navigation.
      router.replace('/(customer)/catalog');
    } catch (err) {
      const e = err as Error & { status?: number; errors?: Record<string, string[]> };

      if (e.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.errors)) if (v?.[0]) mapped[k] = v[0];
        setFieldErrors(mapped);
      }

      setError(
        e.status === 401 ? 'Email or password is incorrect.'
        : e.status === 403 ? e.message
        : e.message || 'Could not sign you in. Please try again.',
      );
      setBusy(false);
    }
  }, [busy, email, password, signIn, router]);

  return (
    <AuthScreen
      // Matches the "Customer login" door on the chooser, in its colour, so
      // the two screens read as one movement.
      eyebrow="Customer"
      accent={color.brand}
      title="Sign in"
      subtitle="Use the email your pharmacy account was approved with."
      footer={
        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          haptic="light"
          pressOpacity={0.6}
          style={{ alignItems: 'center', paddingVertical: space.md }}
        >
          <Text variant="callout" tone="tertiary">
            No account yet?{' '}
            <Text variant="callout" tone="brand" weight="600">Register your pharmacy</Text>
          </Text>
        </Pressable>
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

        <Input
          label="Email address"
          placeholder="you@pharmacy.com"
          value={email}
          onChangeText={t => { setEmail(t); setFieldErrors(p => ({ ...p, email: '' })); }}
          error={fieldErrors.email}
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
          onChangeText={t => { setPassword(t); setFieldErrors(p => ({ ...p, password: '' })); }}
          error={fieldErrors.password}
          secureTextEntry={!reveal}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          leading={<Icon name="lock" size={17} color={color.textTertiary} />}
          trailing={
            <Icon
              name={reveal ? 'eye-off' : 'eye'}
              size={18}
              color={color.textTertiary}
            />
          }
          onTrailingPress={() => setReveal(r => !r)}
          editable={!busy}
        />

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password?audience=customer')}
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
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </View>
    </AuthScreen>
  );
}
