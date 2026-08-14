/**
 * Team — staff and drivers.
 *
 * One endpoint serves both roles, so this screen splits them by tab rather than
 * mixing them: a sales rep and a driver share almost no relevant attributes.
 * Reps carry an account load; drivers carry a vehicle.
 *
 * The "unverified" flag matters more than it looks. A staff member who never
 * completed their email verification can't sign in, and from the admin's side
 * they look identical to an active member until you check. Resending the
 * invite is therefore the primary action on those rows.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber } from '@/lib/contact';
import { formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listStaff, resendStaffInvite, type StaffMember, type StaffRole,
} from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';

const TABS: { value: StaffRole; label: string }[] = [
  { value: 'STAFF',  label: 'Sales & admin' },
  { value: 'DRIVER', label: 'Drivers' },
];

export default function TeamScreen() {
  const router = useRouter();

  const [role,      setRole]      = useState<StaffRole>('STAFF');
  const [rawSearch, setRawSearch] = useState('');
  const [busyId,    setBusyId]    = useState<number | null>(null);

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  /**
   * Admins are STAFF-role users too, so the "Sales & admin" tab queries without
   * a role filter and partitions client-side. Filtering server-side by
   * `role: 'STAFF'` would hide every admin from the team list, including the
   * person looking at it.
   */
  const teamQ = useQuery({
    queryKey: ['staff', 'team', search],
    queryFn:  () => listStaff({ search, limit: 100 }),
    staleTime: 60_000,
  });

  const members = useMemo(() => {
    const all = teamQ.data?.records ?? [];
    return role === 'DRIVER'
      ? all.filter(m => m.role === 'DRIVER')
      : all.filter(m => m.role !== 'DRIVER');
  }, [teamQ.data, role]);

  const resend = useCallback(async (member: StaffMember) => {
    setBusyId(member.id);
    try {
      await resendStaffInvite(member.id);
      toast.success(`Invite resent to ${member.email}.`);
    } catch (err) {
      toast.error((err as Error).message, 'Could not resend');
    } finally {
      setBusyId(null);
    }
  }, []);


  const { refreshing, onRefresh } = useRefresh(teamQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Team"
          right={
            <Pressable
              onPress={() => router.push('/(staff)/team/new' as never)}
              haptic="medium"
              pressScale={0.92}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add a team member"
            >
              <Icon name="user-plus" size={19} color={color.text} />
            </Pressable>
          }
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <View style={{
            flexDirection: 'row',
            backgroundColor: color.surfaceMuted,
            borderRadius: radius.full,
            padding: 3,
          }}>
            {TABS.map(t => {
              const active = role === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setRole(t.value)}
                  haptic="light"
                  pressScale={0.98}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1, height: 34,
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: radius.full,
                    backgroundColor: active ? color.surface : 'transparent',
                  }}
                >
                  <Text variant="caption" style={{
                    color: active ? color.text : color.textTertiary,
                    fontWeight: active ? '700' : '500',
                  }}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            placeholder="Search name or email"
            value={rawSearch}
            onChangeText={setRawSearch}
            autoCapitalize="none"
            autoCorrect={false}
            leading={<Icon name="search" size={17} color={color.textTertiary} />}
            trailing={rawSearch ? <Icon name="close" size={16} color={color.textTertiary} /> : undefined}
            onTrailingPress={rawSearch ? () => setRawSearch('') : undefined}
          />
        </View>

        <Animated.FlatList
          data={members}
          keyExtractor={m => String(m.id)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
            gap: space.sm,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand}
            />
          }
          renderItem={({ item, index }) => (
            <MemberRow
              member={item}
              index={index}
              busy={busyId === item.id}
              onResend={() => void resend(item)}
            />
          )}
          ListEmptyComponent={
            teamQ.isLoading ? (
              <View style={{ gap: space.sm }}>
                {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : teamQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load the team"
                actionLabel="Retry"
                onAction={() => void teamQ.refetch()}
              />
            ) : (
              <EmptyState
                iconName={role === 'DRIVER' ? 'truck' : 'team'}
                tone="brand"
                title={role === 'DRIVER' ? 'No drivers yet' : 'No staff yet'}
                subtitle={
                  role === 'DRIVER'
                    ? 'Add a driver to start assigning deliveries.'
                    : 'Add a colleague and they’ll be emailed an invitation.'
                }
                actionLabel="Add someone"
                onAction={() => router.push('/(staff)/team/new' as never)}
              />
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

function MemberRow({ member, index, busy, onResend }: {
  member: StaffMember; index: number; busy: boolean; onResend: () => void;
}) {
  const name = `${member.first_name} ${member.last_name}`.trim();
  const initials = name.split(' ').filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase()).join('') || '—';

  const isDriver = member.role === 'DRIVER';
  const unverified = member.verification_status
    && member.verification_status.toUpperCase() !== 'VERIFIED';

  // A driver with no driver record can't be assigned deliveries — worth
  // surfacing, because the row otherwise looks complete.
  const brokenDriver = isDriver && member.driver_record_id === null;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
      <Surface level="sm" padded="md" rounded="lg">
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{
              width: 40, height: 40, borderRadius: radius.full,
              backgroundColor: color.surfaceMuted,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text variant="label" tone="secondary">{initials}</Text>
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>{member.email}</Text>
            </View>

            {member.phone ? (
              <Pressable
                onPress={() => void callNumber(member.phone)}
                haptic="light"
                pressScale={0.92}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Call ${name}`}
                style={{
                  width: 32, height: 32, borderRadius: radius.full,
                  backgroundColor: color.brandSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="phone" size={14} color={color.brand} />
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Badge tone={member.role === 'ADMIN' ? 'brand' : 'neutral'} size="sm">
              {member.role.toLowerCase()}
            </Badge>

            {isDriver ? (
              <>
                <Badge tone="neutral" size="sm">
                  {member.vehicle_plate ?? 'No vehicle'}
                </Badge>
                {member.driver_status ? (
                  <Badge tone="neutral" size="sm">{member.driver_status.toLowerCase()}</Badge>
                ) : null}
              </>
            ) : (
              <Badge tone="neutral" size="sm">
                {member.assigned_customers} {member.assigned_customers === 1 ? 'account' : 'accounts'}
              </Badge>
            )}

            {member.job_title ? <Badge tone="neutral" size="sm">{member.job_title}</Badge> : null}
            {unverified ? <Badge tone="warning" size="sm" dot>Unverified</Badge> : null}
            {brokenDriver ? <Badge tone="danger" size="sm">Not assignable</Badge> : null}
          </View>

          {brokenDriver ? (
            <Text variant="caption" tone="danger">
              No driver record — deliveries can’t be assigned to them.
            </Text>
          ) : null}

          {unverified ? (
            <Button
              size="sm"
              variant="tinted"
              fullWidth
              loading={busy}
              disabled={busy}
              onPress={onResend}
              icon={<Icon name="email" size={14} color={color.brand} />}
            >
              Resend invitation
            </Button>
          ) : (
            <Text variant="caption" tone="disabled">
              Joined {formatDate(member.created_at)}
            </Text>
          )}
        </View>
      </Surface>
    </Animated.View>
  );
}
