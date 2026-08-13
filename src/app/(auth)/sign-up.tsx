/**
 * Pharmacy registration — four steps.
 *
 *   1. Details      → collected locally
 *   2. Certificate  → PCN document picked from library or camera
 *   3. Verify       → POST register (sends OTP), then POST verify-otp
 *   4. Password     → POST create-password, account lands in PENDING_REVIEW
 *
 * The account is only created at step 3, not step 1 — registration and the OTP
 * email fire together, so a customer who abandons at step 2 leaves nothing
 * behind.
 *
 * The final submit locks and stays locked through navigation. On web, releasing
 * it after success let customers double-tap and receive two "under review"
 * emails; the same guard applies here.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ScrollView, type TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  FadeInRight, FadeOutLeft, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { AuthScreen } from '@/components/shared/AuthScreen';
import { Text, Button, Input, Pressable, Icon, Surface } from '@/components/ui';
import { color, space, radius, motion } from '@/constants/theme';
import { NIGERIAN_STATES } from '@/constants/states';
import {
  registerCustomer, verifyOtp, resendOtp, createPassword,
} from '@/lib/services/auth.service';
import { toast } from '@/lib/toast';

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Details', 'Certificate', 'Verify', 'Password'] as const;

interface Details {
  first_name: string; last_name: string; company_name: string;
  email: string; phone: string; address: string; city: string;
  state: string; referral_code: string;
}

const EMPTY: Details = {
  first_name: '', last_name: '', company_name: '', email: '', phone: '',
  address: '', city: '', state: '', referral_code: '',
};

/* ── Progress rail ───────────────────────────────────────────────────────── */

function StepRail({ step }: { step: Step }) {
  const progress = useSharedValue((step - 1) / (STEP_LABELS.length - 1));
  progress.value = withTiming((step - 1) / (STEP_LABELS.length - 1), {
    duration: motion.duration.base,
  });

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={{ gap: space.sm, marginBottom: space.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {STEP_LABELS.map((label, i) => {
          const done   = i + 1 < step;
          const active = i + 1 === step;
          return (
            <Text
              key={label}
              variant="caption"
              style={{
                color: done || active ? color.brand : color.textDisabled,
                fontWeight: active ? '700' : '500',
              }}
            >
              {label}
            </Text>
          );
        })}
      </View>

      <View style={{ height: 3, borderRadius: radius.full, backgroundColor: color.surfaceMuted, overflow: 'hidden' }}>
        <Animated.View
          style={[{ height: 3, borderRadius: radius.full, backgroundColor: color.brand }, fillStyle]}
        />
      </View>
    </View>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────────── */

export default function SignUpScreen() {
  const router = useRouter();

  const [step,    setStep]    = useState<Step>(1);
  const [details, setDetails] = useState<Details>(EMPTY);
  const [cert,    setCert]    = useState<{ uri: string; name: string; type: string } | null>(null);
  const [code,    setCode]    = useState('');
  const [token,   setToken]   = useState('');
  const [password,setPassword]= useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal,  setReveal]  = useState(false);

  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState('');
  const [errs,   setErrs]   = useState<Record<string, string>>({});
  const [resendIn, setResendIn] = useState(0);

  const set = useCallback((k: keyof Details) => (v: string) => {
    setDetails(d => ({ ...d, [k]: v }));
    setErrs(e => ({ ...e, [k]: '' }));
  }, []);

  /* ── Step 1 ─────────────────────────────────────────────────────────── */

  const validateDetails = useCallback(() => {
    const e: Record<string, string> = {};
    if (!details.first_name.trim())   e.first_name   = 'Required';
    if (!details.last_name.trim())    e.last_name    = 'Required';
    if (!details.company_name.trim()) e.company_name = 'Pharmacy name is required';
    if (!details.email.includes('@')) e.email        = 'Enter a valid email';
    if (details.phone.trim().length < 10) e.phone    = 'Enter a valid phone number';
    if (details.address.trim().length < 5) e.address = 'Enter your full address';
    if (!details.city.trim())         e.city         = 'Required';
    if (!details.state.trim())        e.state        = 'Select a state';
    setErrs(e);
    return Object.keys(e).length === 0;
  }, [details]);

  /* ── Step 2 ─────────────────────────────────────────────────────────── */

  const pickCertificate = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library access is needed to attach your certificate.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const a = res.assets[0];
    setCert({
      uri:  a.uri,
      name: a.fileName ?? `pcn-certificate.${(a.uri.split('.').pop() ?? 'jpg')}`,
      type: a.mimeType ?? 'image/jpeg',
    });
    setError('');
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera access is needed to photograph your certificate.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;

    const a = res.assets[0];
    setCert({ uri: a.uri, name: a.fileName ?? 'pcn-certificate.jpg', type: a.mimeType ?? 'image/jpeg' });
    setError('');
  }, []);

  /* ── Step 3 — register then verify ──────────────────────────────────── */

  const startCountdown = useCallback(() => {
    setResendIn(45);
    const id = setInterval(() => {
      setResendIn(s => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  const submitRegistration = useCallback(async () => {
    if (busy || !cert) return;
    setBusy(true); setError('');
    try {
      await registerCustomer({ ...details, certificate: cert });
      startCountdown();
      setStep(3);
      toast.info(`We emailed a 6-digit code to ${details.email}.`, 'Code sent');
    } catch (err) {
      const e = err as Error & { errors?: Record<string, string[]> };
      if (e.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.errors)) if (v?.[0]) mapped[k] = v[0];
        setErrs(mapped);
        // Field errors belong to step 1 — send them back to fix it.
        if (Object.keys(mapped).some(k => k !== 'file' && k !== 'pcn_certificate')) setStep(1);
      }
      setError(e.message || 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }, [busy, cert, details, startCountdown]);

  const submitOtp = useCallback(async () => {
    if (busy || code.length !== 6) return;
    setBusy(true); setError('');
    try {
      const res = await verifyOtp(details.email, code);
      setToken(res.token);
      setStep(4);
    } catch (err) {
      setError((err as Error).message || 'That code was not accepted.');
    } finally {
      setBusy(false);
    }
  }, [busy, code, details.email]);

  const handleResend = useCallback(async () => {
    if (resendIn > 0) return;
    try {
      await resendOtp(details.email);
      startCountdown();
      toast.info(`Sent again to ${details.email}.`, 'Code resent');
    } catch {
      setError('Could not resend the code. Try again shortly.');
    }
  }, [resendIn, details.email, startCountdown]);

  /* ── Step 4 ─────────────────────────────────────────────────────────── */

  const passwordValid = useMemo(() => ({
    length: password.length >= 8,
    upper:  /[A-Z]/.test(password),
    lower:  /[a-z]/.test(password),
    digit:  /[0-9]/.test(password),
    match:  password.length > 0 && password === confirm,
  }), [password, confirm]);

  const allValid = Object.values(passwordValid).every(Boolean);

  const finish = useCallback(async () => {
    if (busy || !allValid) return;
    setBusy(true); setError('');
    try {
      await createPassword(password, token);
      // Not clearing `busy` — the button stays locked until this screen
      // unmounts, so a double-tap can't fire a second request.
      router.replace('/(auth)/pending-review');
    } catch (err) {
      setError((err as Error).message || 'Could not set your password.');
      setBusy(false);
    }
  }, [busy, allValid, password, token, router]);

  /* ── Render ─────────────────────────────────────────────────────────── */

  const titles: Record<Step, { title: string; subtitle: string }> = {
    1: { title: 'Your pharmacy',   subtitle: 'Tell us who you are and where you operate.' },
    2: { title: 'PCN certificate', subtitle: 'Regulations require us to verify every pharmacy we supply.' },
    3: { title: 'Verify email',    subtitle: `Enter the 6-digit code we sent to ${details.email}.` },
    4: { title: 'Secure account',  subtitle: 'Choose a password to finish.' },
  };

  return (
    <AuthScreen
      eyebrow={`Step ${step} of 4`}
      title={titles[step].title}
      subtitle={titles[step].subtitle}
      footer={
        <View style={{ paddingBottom: space.sm }}>
          {step === 1 && (
            <Button size="lg" fullWidth onPress={() => { if (validateDetails()) setStep(2); }}>
              Continue
            </Button>
          )}
          {step === 2 && (
            <View style={{ gap: space.sm }}>
              <Button
                size="lg" fullWidth
                loading={busy} disabled={!cert || busy}
                onPress={submitRegistration}
              >
                {busy ? 'Creating account…' : 'Create account'}
              </Button>
              <Button variant="ghost" fullWidth onPress={() => setStep(1)} disabled={busy}>
                Back
              </Button>
            </View>
          )}
          {step === 3 && (
            <Button
              size="lg" fullWidth
              loading={busy} disabled={code.length !== 6 || busy}
              onPress={submitOtp}
            >
              {busy ? 'Verifying…' : 'Verify email'}
            </Button>
          )}
          {step === 4 && (
            <Button
              size="lg" fullWidth
              loading={busy} disabled={!allValid || busy}
              onPress={finish}
            >
              {busy ? 'Creating your account…' : 'Complete registration'}
            </Button>
          )}
        </View>
      }
    >
      <StepRail step={step} />

      {error ? (
        <Surface tone="danger" level="none" padded="md" rounded="md" style={{ marginBottom: space.base }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Icon name="alert" size={16} color={color.danger} filled />
            <Text variant="callout" style={{ flex: 1, color: '#991b1b' }}>{error}</Text>
          </View>
        </Surface>
      ) : null}

      {/* ── Step 1 ── */}
      {step === 1 && (
        <Animated.View entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(180)} style={{ gap: space.base }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Input containerStyle={{ flex: 1 }} label="First name" required
              value={details.first_name} onChangeText={set('first_name')} error={errs.first_name} />
            <Input containerStyle={{ flex: 1 }} label="Last name" required
              value={details.last_name} onChangeText={set('last_name')} error={errs.last_name} />
          </View>

          <Input label="Pharmacy name" required placeholder="e.g. Grace Pharmacy Ltd"
            value={details.company_name} onChangeText={set('company_name')} error={errs.company_name}
            leading={<Icon name="building" size={17} color={color.textTertiary} />} />

          <Input label="Email address" required placeholder="you@pharmacy.com"
            value={details.email} onChangeText={set('email')} error={errs.email}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            leading={<Icon name="email" size={17} color={color.textTertiary} />} />

          <Input label="Phone number" required placeholder="08012345678"
            value={details.phone} onChangeText={set('phone')} error={errs.phone}
            keyboardType="phone-pad"
            leading={<Icon name="phone" size={17} color={color.textTertiary} />} />

          <Input label="Street address" required multiline numberOfLines={2}
            value={details.address} onChangeText={set('address')} error={errs.address}
            leading={<Icon name="location" size={17} color={color.textTertiary} />} />

          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Input containerStyle={{ flex: 1 }} label="City" required
              value={details.city} onChangeText={set('city')} error={errs.city} />
            <View style={{ flex: 1 }}>
              <Text variant="label" tone="secondary" style={{ marginBottom: space.xs }}>State *</Text>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.xs }}
                style={{ maxHeight: 48 }}
              >
                {NIGERIAN_STATES.map(s => (
                  <Pressable
                    key={s}
                    onPress={() => set('state')(s)}
                    haptic="light"
                    style={{
                      paddingHorizontal: space.md, height: 44, justifyContent: 'center',
                      borderRadius: radius.md, borderWidth: 1,
                      borderColor: details.state === s ? color.brand : color.border,
                      backgroundColor: details.state === s ? color.brandSoft : color.surface,
                    }}
                  >
                    <Text variant="caption" style={{ color: details.state === s ? color.brand : color.textSecondary }}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {errs.state ? <Text variant="caption" tone="danger" style={{ marginTop: space.xs }}>{errs.state}</Text> : null}
            </View>
          </View>

          <Input label="Referral code" hint="Optional — if a colleague referred you"
            value={details.referral_code} onChangeText={set('referral_code')}
            autoCapitalize="characters" />
        </Animated.View>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <Animated.View entering={FadeInRight.duration(260)} style={{ gap: space.base }}>
          <Surface tone="info" level="none" padded="base" rounded="lg">
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Icon name="shield" size={18} color={color.info} filled />
              <Text variant="callout" style={{ flex: 1, color: '#155e75' }}>
                Your PCN certificate is reviewed by our compliance team. Accounts stay
                pending until it&rsquo;s verified.
              </Text>
            </View>
          </Surface>

          {cert ? (
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{
                  width: 44, height: 44, borderRadius: radius.md,
                  backgroundColor: color.successSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="check-circle" size={20} color={color.success} filled />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>{cert.name}</Text>
                  <Text variant="caption" tone="tertiary">Ready to upload</Text>
                </View>
                <Pressable onPress={() => setCert(null)} haptic="light" hitSlop={10}>
                  <Icon name="close" size={17} color={color.textTertiary} />
                </Pressable>
              </View>
            </Surface>
          ) : (
            <View style={{ gap: space.sm }}>
              <Pressable
                onPress={pickCertificate}
                haptic="medium"
                style={{
                  paddingVertical: space['2xl'],
                  alignItems: 'center', gap: space.sm,
                  borderRadius: radius.lg,
                  borderWidth: 2, borderStyle: 'dashed',
                  borderColor: color.border,
                  backgroundColor: color.surface,
                }}
              >
                <Icon name="upload" size={26} color={color.textTertiary} />
                <Text variant="bodyMedium">Choose from library</Text>
                <Text variant="caption" tone="tertiary">JPG or PNG</Text>
              </Pressable>

              <Button variant="outline" fullWidth onPress={takePhoto} icon={<Icon name="image" size={16} color={color.text} />}>
                Take a photo
              </Button>
            </View>
          )}
        </Animated.View>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <Animated.View entering={FadeInRight.duration(260)} style={{ gap: space.lg }}>
          <Input
            label="Verification code"
            placeholder="000000"
            value={code}
            onChangeText={t => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            inputStyle={{ letterSpacing: 8, fontSize: 22, fontWeight: '700', textAlign: 'center' }}
          />

          <Pressable
            onPress={handleResend}
            disabled={resendIn > 0}
            haptic="light"
            pressOpacity={0.6}
            style={{ alignItems: 'center', paddingVertical: space.sm }}
          >
            <Text variant="callout" tone={resendIn > 0 ? 'disabled' : 'brand'}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Step 4 ── */}
      {step === 4 && (
        <Animated.View entering={FadeInRight.duration(260)} style={{ gap: space.base }}>
          <Input
            label="Password" required
            value={password} onChangeText={setPassword}
            secureTextEntry={!reveal} autoCapitalize="none" textContentType="newPassword"
            leading={<Icon name="lock" size={17} color={color.textTertiary} />}
            trailing={<Icon name={reveal ? 'eye-off' : 'eye'} size={18} color={color.textTertiary} />}
            onTrailingPress={() => setReveal(r => !r)}
          />

          <Input
            label="Confirm password" required
            value={confirm} onChangeText={setConfirm}
            secureTextEntry={!reveal} autoCapitalize="none"
            leading={<Icon name="lock" size={17} color={color.textTertiary} />}
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
                const ok = passwordValid[key];
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
        </Animated.View>
      )}
    </AuthScreen>
  );
}
