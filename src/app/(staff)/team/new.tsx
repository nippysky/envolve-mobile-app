/**
 * Add a team member.
 *
 * One form, two shapes. Picking DRIVER swaps the employment fields for vehicle
 * fields, because a driver record needs a plate to be assignable and a job
 * title on a driver is noise.
 *
 * The API creates the user and emails a verification link; they set their own
 * password from it. As with customers, there's no password field here on
 * purpose — a colleague typing a credential on someone else's behalf puts it
 * somewhere it shouldn't be.
 *
 * Note the role enum: the API accepts only STAFF or DRIVER. Admins are
 * promoted from an existing staff record rather than created, so ADMIN isn't
 * offered.
 */

import React, { useCallback, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { createStaff } from '@/lib/services/admin.service';
import { ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

const ROLES = [
  {
    value: 'STAFF' as const,
    label: 'Sales & admin',
    hint: 'Handles orders, customers and deliveries',
    icon: 'team' as const,
  },
  {
    value: 'DRIVER' as const,
    label: 'Driver',
    hint: 'Collects and delivers orders',
    icon: 'truck' as const,
  },
];

export default function AddTeamMemberScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';

  const [role,    setRole]    = useState<'STAFF' | 'DRIVER'>('STAFF');
  const [first,   setFirst]   = useState('');
  const [middle,  setMiddle]  = useState('');
  const [last,    setLast]    = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');

  const [department, setDepartment] = useState('');
  const [jobTitle,   setJobTitle]   = useState('');

  const [plate,   setPlate]   = useState('');
  const [vehicle, setVehicle] = useState('');
  const [region,  setRegion]  = useState('');

  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const clear = (k: string) => setErrs(p => ({ ...p, [k]: '' }));

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!first.trim())        e.first = 'First name is required.';
    if (!last.trim())         e.last  = 'Last name is required.';
    if (!email.includes('@')) e.email = 'Enter a valid work email address.';

    // A driver without a plate can still be created, but can't be identified
    // at the gate — worth flagging rather than silently allowing.
    if (role === 'DRIVER' && !plate.trim()) {
      e.plate = 'Add the vehicle plate so dispatch can identify them.';
    }

    setErrs(e);
    return Object.keys(e).length === 0;
  }, [first, last, email, role, plate]);

  const submit = useCallback(async () => {
    if (busy || !validate()) return;

    setBusy(true);
    try {
      await createStaff({
        first_name:  first.trim(),
        middle_name: middle.trim() || undefined,
        last_name:   last.trim(),
        email:       email.trim().toLowerCase(),
        phone:       phone.trim() || undefined,
        role,
        // Only send the fields that belong to the chosen shape.
        department:    role === 'STAFF' ? (department.trim() || undefined) : undefined,
        job_title:     role === 'STAFF' ? (jobTitle.trim()   || undefined) : undefined,
        vehicle_plate: role === 'DRIVER' ? (plate.trim()   || undefined) : undefined,
        vehicle_type:  role === 'DRIVER' ? (vehicle.trim() || undefined) : undefined,
        region:        role === 'DRIVER' ? (region.trim()  || undefined) : undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success(`A verification email has been sent to ${email.trim()}.`, 'Member added');
      router.back();
    } catch (err) {
      const e = err as ApiError;
      if (e.errors) {
        setErrs({
          first: e.errors.first_name?.[0] ?? '',
          last:  e.errors.last_name?.[0] ?? '',
          email: e.errors.email?.[0] ?? '',
          phone: e.errors.phone?.[0] ?? '',
          plate: e.errors.vehicle_plate?.[0] ?? '',
        });
        toast.error('Check the highlighted fields.', 'Couldn’t add member');
      } else {
        toast.error(e.message, 'Couldn’t add member');
      }
      setBusy(false);
    }
  }, [busy, validate, first, middle, last, email, phone, role,
      department, jobTitle, plate, vehicle, region, queryClient, router]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Add member" />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter, gap: space.md }}>
            <Icon name="lock" size={30} color={color.textDisabled} />
            <Text variant="title3" align="center">Admins only</Text>
            <Text variant="callout" tone="tertiary" align="center">
              Team members are added by administrators.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Add member"
          subtitle="They’ll be emailed a verification link"
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
            {/* ── Role ── */}
            <Animated.View entering={FadeInDown.duration(320)} style={{ gap: space.md }}>
              <Text variant="overline" tone="tertiary">Role</Text>
              <View style={{ gap: space.sm }}>
                {ROLES.map(r => {
                  const active = role === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      onPress={() => setRole(r.value)}
                      disabled={busy}
                      haptic="light"
                      pressScale={0.98}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: space.md,
                        padding: space.base,
                        borderRadius: radius.lg,
                        backgroundColor: active ? color.brandSoft : color.surface,
                        borderWidth: active ? 1.5 : layout.hairlineWidth,
                        borderColor: active ? color.brand : color.border,
                      }}
                    >
                      <View style={{
                        width: 36, height: 36, borderRadius: radius.full,
                        backgroundColor: active ? color.brand : color.surfaceMuted,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name={r.icon} size={16} color={active ? '#fff' : color.textTertiary} filled={active} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium">{r.label}</Text>
                        <Text variant="caption" tone="tertiary">{r.hint}</Text>
                      </View>
                      <View style={{
                        width: 20, height: 20, borderRadius: radius.full,
                        borderWidth: active ? 0 : 1.5,
                        borderColor: color.borderStrong,
                        backgroundColor: active ? color.brand : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {active ? <Icon name="check" size={11} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Surface tone="subtle" level="none" padded="md" rounded="md">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="info" size={14} color={color.textTertiary} />
                  <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                    Admin access is granted by promoting an existing member, not at
                    creation.
                  </Text>
                </View>
              </Surface>
            </Animated.View>

            {/* ── Person ── */}
            <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ gap: space.md }}>
              <Text variant="overline" tone="tertiary">Details</Text>

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
                onChangeText={setMiddle}
                autoCapitalize="words"
                editable={!busy}
              />

              <Input
                label="Work email"
                placeholder="them@envolvepharm.com.ng"
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
                placeholder="Optional"
                value={phone}
                onChangeText={v => { setPhone(v); clear('phone'); }}
                error={errs.phone}
                keyboardType="phone-pad"
                editable={!busy}
                leading={<Icon name="phone" size={17} color={color.textTertiary} />}
              />
            </Animated.View>

            {/* ── Role-specific ── */}
            {role === 'STAFF' ? (
              <Animated.View entering={FadeIn.duration(240)} style={{ gap: space.md }}>
                <Text variant="overline" tone="tertiary">Employment</Text>
                <Input
                  label="Department"
                  placeholder="e.g. Sales"
                  value={department}
                  onChangeText={setDepartment}
                  autoCapitalize="words"
                  editable={!busy}
                />
                <Input
                  label="Job title"
                  placeholder="e.g. Account Manager"
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  autoCapitalize="words"
                  editable={!busy}
                />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(240)} style={{ gap: space.md }}>
                <Text variant="overline" tone="tertiary">Vehicle</Text>
                <Input
                  label="Plate number"
                  placeholder="LAG-123-XY"
                  value={plate}
                  onChangeText={v => { setPlate(v); clear('plate'); }}
                  error={errs.plate}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!busy}
                  required
                  leading={<Icon name="truck" size={17} color={color.textTertiary} />}
                />
                <Input
                  label="Vehicle type"
                  placeholder="e.g. Motorcycle, Van"
                  value={vehicle}
                  onChangeText={setVehicle}
                  autoCapitalize="words"
                  editable={!busy}
                />
                <Input
                  label="Region"
                  placeholder="e.g. Lagos Mainland"
                  value={region}
                  onChangeText={setRegion}
                  autoCapitalize="words"
                  editable={!busy}
                  leading={<Icon name="location" size={17} color={color.textTertiary} />}
                />
              </Animated.View>
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
            disabled={busy}
            onPress={submit}
            haptic="medium"
          >
            {busy ? 'Adding…' : `Add ${role === 'DRIVER' ? 'driver' : 'member'} & send invite`}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}
