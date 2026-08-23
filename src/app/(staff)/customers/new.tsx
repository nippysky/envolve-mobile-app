/**
 * Add a customer.
 *
 * For accounts the team onboards directly — a pharmacy that phoned in rather
 * than signing up. The API creates the user and emails them an invitation with
 * an OTP; they set their own password and upload their PCN certificate.
 *
 * So this form deliberately has no password field and no certificate upload.
 * Staff creating a password for someone else would put a credential in a
 * channel it shouldn't be in, and the certificate has to come from the
 * pharmacy anyway.
 *
 * Validation mirrors `customerOnboardSchema` on the server, including the
 * letters-only name rule, so failures surface inline rather than as a 422 with
 * a field map the user has to decode.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, gutter, layout } from '@/constants/theme';
import { apiFetch, ApiError } from '@/lib/api-client';
import { NIGERIAN_STATES } from '@/constants/states';
import { toast } from '@/lib/toast';

/** Mirrors the server's `nameField` rule — letters, spaces, apostrophes, hyphens. */
const NAME_RE = /^[a-zA-ZÀ-ÿ\s'-]+$/;

export default function AddCustomerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [first,   setFirst]   = useState('');
  const [middle,  setMiddle]  = useState('');
  const [last,    setLast]    = useState('');
  const [company, setCompany] = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [address, setAddress] = useState('');
  const [city,    setCity]    = useState('');
  const [state,   setState]   = useState('');

  const [statePicker, setStatePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const clear = (k: string) => setErrs(p => ({ ...p, [k]: '' }));

  const validate = useCallback(() => {
    const e: Record<string, string> = {};

    if (first.trim().length < 2)          e.first = 'First name is required.';
    else if (!NAME_RE.test(first.trim())) e.first = 'Letters only — no numbers or symbols.';

    if (last.trim().length < 2)           e.last = 'Last name is required.';
    else if (!NAME_RE.test(last.trim()))  e.last = 'Letters only — no numbers or symbols.';

    if (middle.trim() && !NAME_RE.test(middle.trim())) {
      e.middle = 'Letters only — no numbers or symbols.';
    }

    if (company.trim().length < 2)  e.company = 'Pharmacy or company name is required.';
    if (!email.includes('@'))       e.email   = 'Enter a valid email address.';
    if (phone.trim().length < 8)    e.phone   = 'Enter a valid phone number.';
    if (address.trim().length < 5)  e.address = 'Enter the full street address.';
    if (city.trim().length < 2)     e.city    = 'City is required.';
    if (state.trim().length < 2)    e.state   = 'Select a state.';

    setErrs(e);
    return Object.keys(e).length === 0;
  }, [first, middle, last, company, email, phone, address, city, state]);

  const submit = useCallback(async () => {
    if (busy || !validate()) return;

    setBusy(true);
    try {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          first_name:   first.trim(),
          middle_name:  middle.trim() || undefined,
          last_name:    last.trim(),
          company_name: company.trim(),
          email:        email.trim().toLowerCase(),
          phone:        phone.trim(),
          address:      address.trim(),
          city:         city.trim(),
          state:        state.trim(),
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`An invitation has been emailed to ${email.trim()}.`, 'Customer added');
      router.back();
    } catch (err) {
      const e = err as ApiError;
      // The API returns a field map on 422 — surface it inline rather than as
      // one toast the user then has to map back onto the form themselves.
      if (e.errors) {
        setErrs({
          first:   e.errors.first_name?.[0] ?? '',
          middle:  e.errors.middle_name?.[0] ?? '',
          last:    e.errors.last_name?.[0] ?? '',
          company: e.errors.company_name?.[0] ?? '',
          email:   e.errors.email?.[0] ?? '',
          phone:   e.errors.phone?.[0] ?? '',
          address: e.errors.address?.[0] ?? '',
          city:    e.errors.city?.[0] ?? '',
          state:   e.errors.state?.[0] ?? '',
        });
        toast.error('Check the highlighted fields.', 'Couldn’t add customer');
      } else {
        toast.error(e.message, 'Couldn’t add customer');
      }
      setBusy(false);
    }
  }, [busy, validate, first, middle, last, company, email, phone, address, city, state,
      queryClient, router]);

  const filteredStates = useMemo(
    () => NIGERIAN_STATES.filter(s => s.toLowerCase().includes(state.toLowerCase())),
    [state],
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Add customer"
          subtitle="They’ll be emailed an invitation"
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 56}
        >
          <ScrollView
            contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(320)}>
              <Surface tone="subtle" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="info" size={16} color={color.accent} filled />
                  <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                    They set their own password and upload their PCN certificate from
                    the invitation email. The account stays unapproved until someone
                    verifies that certificate.
                  </Text>
                </View>
              </Surface>
            </Animated.View>

            {/* ── Contact ── */}
            <Group index={0} title="Main contact">
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Input
                  label="First name"
                  value={first}
                  onChangeText={v => { setFirst(v); clear('first'); }}
                  error={errs.first}
                  autoCapitalize="words"
                  editable={!busy}
                  required
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Last name"
                  value={last}
                  onChangeText={v => { setLast(v); clear('last'); }}
                  error={errs.last}
                  autoCapitalize="words"
                  editable={!busy}
                  required
                  containerStyle={{ flex: 1 }}
                />
              </View>

              <Input
                label="Middle name"
                placeholder="Optional"
                value={middle}
                onChangeText={v => { setMiddle(v); clear('middle'); }}
                error={errs.middle}
                autoCapitalize="words"
                editable={!busy}
              />

              <Input
                label="Email"
                placeholder="buyer@pharmacy.com"
                value={email}
                onChangeText={v => { setEmail(v); clear('email'); }}
                error={errs.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                required
                leading={<Icon name="email" size={17} color={color.textTertiary} />}
              />

              <Input
                label="Phone"
                placeholder="0805 513 6726"
                value={phone}
                onChangeText={v => { setPhone(v); clear('phone'); }}
                error={errs.phone}
                keyboardType="phone-pad"
                editable={!busy}
                required
                leading={<Icon name="phone" size={17} color={color.textTertiary} />}
              />
            </Group>

            {/* ── Business ── */}
            <Group index={1} title="Pharmacy">
              <Input
                label="Pharmacy / company name"
                value={company}
                onChangeText={v => { setCompany(v); clear('company'); }}
                error={errs.company}
                autoCapitalize="words"
                editable={!busy}
                required
                leading={<Icon name="building" size={17} color={color.textTertiary} />}
              />

              <Input
                label="Street address"
                value={address}
                onChangeText={v => { setAddress(v); clear('address'); }}
                error={errs.address}
                editable={!busy}
                multiline
                required
                leading={<Icon name="location" size={17} color={color.textTertiary} />}
              />

              <Input
                label="City"
                value={city}
                onChangeText={v => { setCity(v); clear('city'); }}
                error={errs.city}
                editable={!busy}
                required
              />

              <View style={{ gap: space.sm }}>
                <Input
                  label="State"
                  placeholder="Start typing, then pick from the list"
                  value={state}
                  onChangeText={v => { setState(v); clear('state'); setStatePicker(true); }}
                  onFocus={() => setStatePicker(true)}
                  error={errs.state}
                  editable={!busy}
                  required
                  autoCapitalize="words"
                  trailing={<Icon name={statePicker ? 'chevron-up' : 'chevron-down'} size={16} color={color.textTertiary} />}
                  onTrailingPress={() => setStatePicker(p => !p)}
                />

                {statePicker && filteredStates.length > 0 ? (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <Surface level="sm" padded="none" rounded="lg">
                      <ScrollView
                        style={{ maxHeight: 200 }}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                      >
                        {filteredStates.map((s, i, arr) => (
                          <Pressable
                            key={s}
                            onPress={() => { setState(s); setStatePicker(false); clear('state'); }}
                            haptic="light"
                            pressOpacity={0.6}
                            style={{
                              paddingHorizontal: space.base,
                              paddingVertical: space.md,
                              minHeight: layout.tapTarget,
                              justifyContent: 'center',
                              borderBottomWidth: i === arr.length - 1 ? 0 : layout.hairlineWidth,
                              borderBottomColor: color.borderSubtle,
                            }}
                          >
                            <Text variant="body">{s}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </Surface>
                  </Animated.View>
                ) : null}
              </View>
            </Group>
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingHorizontal: gutter,
            paddingTop: space.base,
            paddingBottom: Math.max(insets.bottom, space.base),
            backgroundColor: color.surface,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.border,
          }}
        >
          <Button
            size="lg"
            fullWidth
            loading={busy}
            disabled={busy}
            onPress={submit}
            haptic="medium"
          >
            {busy ? 'Adding…' : 'Add customer & send invite'}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Group({ index, title, children }: {
  index: number; title: string; children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 60).duration(320)} style={{ gap: space.md }}>
      <Text variant="overline" tone="tertiary">{title}</Text>
      <View style={{ gap: space.md }}>{children}</View>
    </Animated.View>
  );
}
