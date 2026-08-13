/**
 * Settings — admin only.
 *
 * `app_settings` stores everything as strings, so this screen parses at the
 * edge and never trusts truthiness: the string `'false'` is truthy in JS, and
 * treating it as a boolean would silently invert every toggle on the screen.
 *
 * The API keeps an allow-list and drops unknown keys **silently**, returning
 * only `{ updated: [...] }`. So a save that looks successful can still have
 * ignored a field. This screen compares what it sent against what came back and
 * says so — a settings page that lies about having saved is worse than one that
 * errors.
 *
 * Referral values are labelled with their real units, matching the caveat
 * documented on `/api/customers/me`: the threshold and reward are naira, but
 * the signup award is dimensionless points.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, updateSettings, type AppSettings } from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';

/** `app_settings` values are strings. Only the literal 'true' is true. */
const isOn = (v: string | undefined) => v === 'true';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';

  const [form, setForm] = useState<AppSettings>({});
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['settings'],
    queryFn:  getSettings,
    enabled:  isAdmin,
    staleTime: 60_000,
  });

  // Seed once. Keyed on a stable marker so a background refetch can't stomp on
  // edits in progress.
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = useCallback(<K extends keyof AppSettings>(key: K, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const toggle = useCallback((key: keyof AppSettings) => {
    setForm(f => ({ ...f, [key]: isOn(f[key]) ? 'false' : 'true' }));
  }, []);

  // Only changed keys are sent — the API audits a before→after diff, and
  // resending unchanged values would fill the trail with noise.
  const patch = useMemo(() => {
    if (!data) return {};
    const out: AppSettings = {};
    for (const k of Object.keys(form) as (keyof AppSettings)[]) {
      if (form[k] !== data[k]) out[k] = form[k];
    }
    return out;
  }, [form, data]);

  const dirty = Object.keys(patch).length > 0;

  const save = useCallback(async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const sent = Object.keys(patch);
      const res  = await updateSettings(patch);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });

      // The allow-list drops unknown keys without erroring. Surface that.
      const ignored = sent.filter(k => !res.updated.includes(k));
      if (ignored.length) {
        toast.error(
          `The server ignored: ${ignored.join(', ')}. Everything else saved.`,
          'Partly saved',
        );
      } else {
        toast.success('Settings saved.');
      }
    } catch (err) {
      toast.error((err as Error).message, 'Could not save settings');
    } finally {
      setBusy(false);
    }
  }, [busy, dirty, patch, queryClient]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Settings" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              iconName="lock"
              title="Admins only"
              subtitle="Platform settings are managed by administrators."
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader variant="compact" back title="Settings" />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 56}
        >
          <ScrollView
            contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.brand} />
            }
          >
            {isLoading ? (
              <View style={{ gap: space.base }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} width="100%" height={64} radius="md" />
                ))}
              </View>
            ) : isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load settings"
                actionLabel="Retry"
                onAction={() => void refetch()}
              />
            ) : (
              <>
                {/* ── Company ── */}
                <Group index={0} title="Company" hint="Shown on invoices, receipts and emails.">
                  <Input
                    label="Company name"
                    value={form.company_name ?? ''}
                    onChangeText={v => set('company_name', v)}
                    editable={!busy}
                    leading={<Icon name="building" size={17} color={color.textTertiary} />}
                  />
                  <Input
                    label="Contact email"
                    value={form.company_email ?? ''}
                    onChangeText={v => set('company_email', v)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!busy}
                    leading={<Icon name="email" size={17} color={color.textTertiary} />}
                  />
                  <Input
                    label="Contact phone"
                    value={form.company_phone ?? ''}
                    onChangeText={v => set('company_phone', v)}
                    keyboardType="phone-pad"
                    editable={!busy}
                    leading={<Icon name="phone" size={17} color={color.textTertiary} />}
                  />
                  <Input
                    label="Head office address"
                    value={form.hq_address ?? ''}
                    onChangeText={v => set('hq_address', v)}
                    editable={!busy}
                    multiline
                    leading={<Icon name="location" size={17} color={color.textTertiary} />}
                  />
                </Group>

                {/* ── VAT ── */}
                <Group
                  index={1}
                  title="VAT"
                  hint="Most pharmaceutical lines are VAT-exempt in Nigeria, so this is off by default."
                >
                  <Toggle
                    label="Charge VAT on orders"
                    hint="Applies to every new order once enabled"
                    value={isOn(form.vat_enabled)}
                    onToggle={() => toggle('vat_enabled')}
                    disabled={busy}
                  />
                  {isOn(form.vat_enabled) ? (
                    <Input
                      label="VAT rate"
                      hint="Percentage, e.g. 7.5"
                      value={form.vat_rate ?? ''}
                      onChangeText={v => set('vat_rate', v)}
                      keyboardType="decimal-pad"
                      editable={!busy}
                      trailing={<Text variant="callout" tone="tertiary">%</Text>}
                    />
                  ) : null}
                </Group>

                {/* ── Referrals ── */}
                <Group
                  index={2}
                  title="Referrals"
                  hint="These values are read live by the web portal and the mobile app."
                >
                  <Input
                    label="Qualifying spend"
                    hint="Naira a referred pharmacy must spend before the reward is awarded"
                    value={form.referral_threshold ?? ''}
                    onChangeText={v => set('referral_threshold', v)}
                    keyboardType="number-pad"
                    editable={!busy}
                    leading={<Text variant="callout" tone="tertiary">₦</Text>}
                  />
                  <Input
                    label="Reward"
                    hint="Naira credited to the referrer once that spend is reached"
                    value={form.referral_reward ?? ''}
                    onChangeText={v => set('referral_reward', v)}
                    keyboardType="number-pad"
                    editable={!busy}
                    leading={<Text variant="callout" tone="tertiary">₦</Text>}
                  />

                  <Surface tone="subtle" level="none" padded="md" rounded="md">
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Icon name="info" size={14} color={color.textTertiary} />
                      <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                        A separate, fixed signup award is also credited in points when
                        someone registers with a code. Points and naira share one
                        balance column, so the total is shown as “reward points”
                        rather than a naira figure.
                      </Text>
                    </View>
                  </Surface>
                </Group>

                {/* ── Operations ── */}
                <Group index={3} title="Operations">
                  <Toggle
                    label="Restrict staff to their own accounts"
                    hint="When on, reps can only order for customers assigned to them"
                    value={form.staff_order_scope === 'ASSIGNED'}
                    onToggle={() => set(
                      'staff_order_scope',
                      form.staff_order_scope === 'ASSIGNED' ? 'ALL' : 'ASSIGNED',
                    )}
                    disabled={busy}
                  />
                  <Toggle
                    label="Email me an audit summary"
                    hint="Periodic digest of console activity"
                    value={isOn(form.email_audit_summary)}
                    onToggle={() => toggle('email_audit_summary')}
                    disabled={busy}
                  />
                  <Toggle
                    label="Automatic sign-out"
                    hint="Ends idle console sessions"
                    value={isOn(form.auto_logout)}
                    onToggle={() => toggle('auto_logout')}
                    disabled={busy}
                  />
                </Group>

                {/* ── Locale ── */}
                <Group index={4} title="Locale">
                  <Input
                    label="Currency"
                    value={form.currency ?? ''}
                    onChangeText={v => set('currency', v)}
                    autoCapitalize="characters"
                    editable={!busy}
                  />
                  <Input
                    label="Timezone"
                    value={form.timezone ?? ''}
                    onChangeText={v => set('timezone', v)}
                    autoCapitalize="none"
                    editable={!busy}
                  />
                </Group>
              </>
            )}
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
            disabled={busy || !dirty || isLoading}
            onPress={save}
            haptic="medium"
          >
            {busy ? 'Saving…'
              : dirty ? `Save ${Object.keys(patch).length} change${Object.keys(patch).length === 1 ? '' : 's'}`
              : 'No changes to save'}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function Group({ index, title, hint, children }: {
  index: number; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)} style={{ gap: space.md }}>
      <View style={{ gap: 2 }}>
        <Text variant="overline" tone="tertiary">{title}</Text>
        {hint ? <Text variant="caption" tone="disabled">{hint}</Text> : null}
      </View>
      <View style={{ gap: space.md }}>{children}</View>
    </Animated.View>
  );
}

function Toggle({ label, hint, value, onToggle, disabled }: {
  label: string; hint: string; value: boolean;
  onToggle: () => void; disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      haptic="light"
      pressScale={0.99}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        padding: space.base,
        borderRadius: radius.lg,
        backgroundColor: color.surface,
        borderWidth: layout.hairlineWidth,
        borderColor: color.border,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone="tertiary">{hint}</Text>
      </View>

      {/* Hand-rolled rather than RN Switch so it matches the design system's
          radii and brand colour on both platforms. */}
      <View style={{
        width: 46, height: 28, borderRadius: radius.full,
        backgroundColor: value ? color.brand : color.surfaceMuted,
        borderWidth: layout.hairlineWidth,
        borderColor: value ? color.brand : color.border,
        justifyContent: 'center',
        paddingHorizontal: 3,
      }}>
        <View style={{
          width: 22, height: 22, borderRadius: radius.full,
          backgroundColor: '#fff',
          alignSelf: value ? 'flex-end' : 'flex-start',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.16,
          shadowRadius: 2,
          elevation: 2,
        }} />
      </View>
    </Pressable>
  );
}
