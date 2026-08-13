/**
 * Edit profile.
 *
 * Only the four fields the API will accept are shown: first name, last name,
 * phone, gender. Email is the login identifier and changing it needs a
 * verification round-trip that doesn't exist yet; business name, address and
 * PCN details are what staff approved the account against, so they move
 * through the review flow instead.
 *
 * Rendering those as disabled inputs would imply they're one permission away
 * from being editable. They're listed as read-only facts with a line saying
 * who to contact — which is the actual answer.
 *
 * Save is disabled until something changes. A save button that's always live
 * on a form you've only looked at invites pointless writes.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Text, Button, Input, Pressable, Icon, Surface, Skeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import {
  getMyAccount, updateMyProfile, type ProfileUpdate,
} from '@/lib/services/account.service';
import { toast } from '@/lib/toast';

const GENDERS: { value: NonNullable<ProfileUpdate['gender']>; label: string }[] = [
  { value: 'MALE',   label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER',  label: 'Prefer not to say' },
];

export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['account', 'me'],
    queryFn:  getMyAccount,
    staleTime: 60_000,
  });

  const profile = data?.profile;

  const [first,  setFirst]  = useState('');
  const [last,   setLast]   = useState('');
  const [phone,  setPhone]  = useState('');
  const [gender, setGender] = useState<ProfileUpdate['gender'] | undefined>(undefined);

  const [saving, setSaving] = useState(false);
  const [errs,   setErrs]   = useState<Record<string, string>>({});

  // Seed once the profile arrives. Keyed on user_id so a refetch that returns
  // the same person doesn't stomp on edits in progress.
  useEffect(() => {
    if (!profile) return;
    setFirst(profile.first_name);
    setLast(profile.last_name);
    setPhone(profile.phone ?? '');
    setGender(
      profile.gender === 'MALE' || profile.gender === 'FEMALE' || profile.gender === 'OTHER'
        ? profile.gender
        : undefined,
    );
  }, [profile?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only changed fields are sent — PATCH accepts a partial and audits the diff.
  const patch = useMemo<ProfileUpdate>(() => {
    if (!profile) return {};
    const p: ProfileUpdate = {};
    if (first.trim() !== profile.first_name)      p.first_name = first.trim();
    if (last.trim()  !== profile.last_name)       p.last_name  = last.trim();
    if (phone.trim() !== (profile.phone ?? ''))   p.phone      = phone.trim();
    if (gender && gender !== profile.gender)      p.gender     = gender;
    return p;
  }, [profile, first, last, phone, gender]);

  const dirty = Object.keys(patch).length > 0;

  const save = useCallback(async () => {
    if (saving || !dirty) return;

    // Mirrors the API's zod schema so failures surface inline.
    const e: Record<string, string> = {};
    if (first.trim().length < 2) e.first = 'First name must be at least 2 characters.';
    if (last.trim().length  < 2) e.last  = 'Last name must be at least 2 characters.';
    if (phone.trim() && phone.trim().length < 8) e.phone = 'Enter a valid phone number.';
    setErrs(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      await updateMyProfile(patch);
      await queryClient.invalidateQueries({ queryKey: ['account', 'me'] });
      toast.success('Your details have been saved.', 'Profile updated');
      router.back();
    } catch (err) {
      toast.error((err as Error).message, 'Could not save');
      setSaving(false);
    }
  }, [saving, dirty, first, last, phone, patch, queryClient, router]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader variant="compact" back title="Edit profile" />

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
            {isLoading ? (
              <View style={{ gap: space.base }}>
                <Skeleton width="100%" height={64} radius="md" />
                <Skeleton width="100%" height={64} radius="md" />
                <Skeleton width="100%" height={64} radius="md" />
              </View>
            ) : (
              <>
                {/* ── Editable ── */}
                <View style={{ gap: space.md }}>
                  <Text variant="overline" tone="tertiary">Your details</Text>

                  <View style={{ flexDirection: 'row', gap: space.md }}>
                    <Input
                      label="First name"
                      value={first}
                      onChangeText={t => { setFirst(t); setErrs(p => ({ ...p, first: '' })); }}
                      error={errs.first}
                      autoCapitalize="words"
                      textContentType="givenName"
                      editable={!saving}
                      required
                      containerStyle={{ flex: 1 }}
                    />
                    <Input
                      label="Last name"
                      value={last}
                      onChangeText={t => { setLast(t); setErrs(p => ({ ...p, last: '' })); }}
                      error={errs.last}
                      autoCapitalize="words"
                      textContentType="familyName"
                      editable={!saving}
                      required
                      containerStyle={{ flex: 1 }}
                    />
                  </View>

                  <Input
                    label="Phone"
                    placeholder="0805 513 6726"
                    value={phone}
                    onChangeText={t => { setPhone(t); setErrs(p => ({ ...p, phone: '' })); }}
                    error={errs.phone}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    editable={!saving}
                    leading={<Icon name="phone" size={17} color={color.textTertiary} />}
                  />

                  <View style={{ gap: space.sm }}>
                    <Text variant="label" tone="secondary">Gender</Text>
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      {GENDERS.map(g => {
                        const active = gender === g.value;
                        return (
                          <Pressable
                            key={g.value}
                            onPress={() => setGender(g.value)}
                            disabled={saving}
                            haptic="light"
                            pressScale={0.96}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            style={{
                              flex: 1,
                              paddingVertical: space.md,
                              alignItems: 'center',
                              borderRadius: radius.md,
                              backgroundColor: active ? color.brandSoft : color.surface,
                              borderWidth: active ? 1.5 : layout.hairlineWidth,
                              borderColor: active ? color.brand : color.border,
                            }}
                          >
                            <Text
                              variant="caption"
                              align="center"
                              style={{
                                color: active ? color.brand : color.textSecondary,
                                fontWeight: active ? '700' : '500',
                              }}
                            >
                              {g.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* ── Read-only ── */}
                <View style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Verified details</Text>

                  <Surface level="sm" padded="base" rounded="lg">
                    <View style={{ gap: space.md }}>
                      <ReadOnly label="Email" value={profile?.email ?? '—'} />
                      <ReadOnly label="Business name" value={profile?.company_name ?? 'Not provided'} />
                      <ReadOnly
                        label="Address"
                        value={[profile?.address, profile?.city, profile?.state]
                          .filter(Boolean).join(', ') || 'Not provided'}
                      />
                      <ReadOnly
                        label="PCN certificate"
                        value={profile?.pcn_verified ? 'Verified' : 'Under review'}
                      />
                    </View>
                  </Surface>

                  <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs }}>
                    <Icon name="lock" size={13} color={color.textDisabled} />
                    <Text variant="caption" tone="disabled" style={{ flex: 1 }}>
                      These were verified when your account was approved. Contact
                      support to have them changed.
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Action bar ── */}
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
            loading={saving}
            disabled={saving || !dirty || isLoading}
            onPress={save}
            haptic="medium"
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'No changes to save'}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.base }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant="callout" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
