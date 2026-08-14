/**
 * Customer detail — console.
 *
 * The review decision lives at the top when there is one to make, because
 * that's the only reason most people open this screen. Once approved, the
 * review block collapses into a line of provenance ("approved by X on Y") and
 * the rest of the record takes over.
 *
 * Rejection requires a note. The customer is told why, and "rejected" with no
 * reason produces a support call that costs more than typing the reason did.
 * Approval doesn't require one — there's nothing to explain.
 *
 * Assigning a sales rep is ADMIN-only, matching the API. Staff see who owns the
 * account but get no picker, rather than a picker that 403s.
 */

import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { CertificateViewer } from '@/components/admin/CertificateViewer';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber, emailAddress } from '@/lib/contact';
import { formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCustomer, reviewCustomer, assignStaff, getPcnUrl, listStaff,
  type CustomerStatus,
} from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';
import type { IconName } from '@/components/ui/Icon';

const STATUS_TONE: Record<CustomerStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED:          'success',
  PENDING_REVIEW:    'warning',
  PCN_CERT_UPLOADED: 'neutral',
  OTP_CONFIRMED:     'neutral',
  REGISTERED:        'neutral',
  REJECTED:          'danger',
};

const STATUS_LABEL: Record<CustomerStatus, string> = {
  APPROVED:          'approved',
  PENDING_REVIEW:    'awaiting review',
  PCN_CERT_UPLOADED: 'certificate uploaded',
  OTP_CONFIRMED:     'email confirmed',
  REGISTERED:        'registered',
  REJECTED:          'rejected',
};

/**
 * Anything before APPROVED/REJECTED is still in flight. A certificate that's
 * been uploaded but not yet moved to PENDING_REVIEW is still reviewable, so
 * both states offer the decision.
 */
const REVIEWABLE: CustomerStatus[] = [
  'REGISTERED', 'OTP_CONFIRMED', 'PCN_CERT_UPLOADED', 'PENDING_REVIEW',
];

export default function ConsoleCustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';

  const [busy,        setBusy]        = useState(false);
  const [rejecting,   setRejecting]   = useState(false);
  const [reason,      setReason]      = useState('');
  const [assignOpen,  setAssignOpen]  = useState(false);

  const customerId = Number(id);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['customers', 'detail', customerId],
    queryFn:  () => getCustomer(customerId),
    enabled:  Number.isFinite(customerId),
  });

  const repsQ = useQuery({
    queryKey: ['staff', 'reps'],
    queryFn:  () => listStaff({ role: 'STAFF', limit: 100 }),
    enabled:  isAdmin && assignOpen,
    staleTime: 5 * 60_000,
  });

  const customer = data;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
  }, [queryClient]);

  const decide = useCallback(async (status: 'APPROVED' | 'REJECTED') => {
    if (!customer || busy) return;
    if (status === 'REJECTED' && reason.trim().length < 4) {
      toast.error('Tell them why — it saves a support call later.', 'Reason required');
      return;
    }
    setBusy(true);
    try {
      await reviewCustomer(customer.id, {
        status,
        review_note: status === 'REJECTED' ? reason.trim() : undefined,
      });
      await invalidate();
      setRejecting(false);
      setReason('');
      toast.success(
        status === 'APPROVED'
          ? 'They can order now, and have been emailed.'
          : 'They’ve been told, with your reason.',
        status === 'APPROVED' ? 'Approved' : 'Rejected',
      );
    } catch (err) {
      toast.error((err as Error).message, 'Could not save the decision');
    } finally {
      setBusy(false);
    }
  }, [customer, busy, reason, invalidate]);

  const setRep = useCallback(async (staffUserId: number | null) => {
    if (!customer || busy) return;
    setBusy(true);
    try {
      await assignStaff(customer.id, staffUserId);
      await invalidate();
      setAssignOpen(false);
      toast.success(staffUserId ? 'Sales rep assigned.' : 'Sales rep removed.');
    } catch (err) {
      toast.error((err as Error).message, 'Could not assign');
    } finally {
      setBusy(false);
    }
  }, [customer, busy, invalidate]);

  /**
   * The certificate URL is fetched on demand rather than read from the customer
   * record, because hitting the endpoint is what writes the "who viewed this
   * licence" audit entry. `enabled` gates it on there being one to fetch.
   */
  const certQ = useQuery({
    queryKey: ['customers', 'pcn', customerId],
    queryFn:  () => getPcnUrl(customerId),
    enabled:  Number.isFinite(customerId) && !!customer?.pcn_certificate_url,
    staleTime: 5 * 60_000,
  });

  const { refreshing, onRefresh } = useRefresh(refetch, certQ.refetch);

  /* ── Loading / error ── */
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Customer" />
          <View style={{ padding: gutter, gap: space.base }}>
            <Skeleton width="100%" height={120} radius="lg" />
            <Skeleton width="100%" height={180} radius="lg" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isError || !customer) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Customer" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Couldn’t load this customer"
              actionLabel="Try again"
              onAction={() => void refetch()}
              secondaryLabel="Back to customers"
              onSecondary={() => router.replace('/(staff)/customers' as never)}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const name = customer.company_name
    ?? `${customer.user.first_name} ${customer.user.last_name}`.trim();
  const contact = `${customer.user.first_name} ${customer.user.last_name}`.trim();
  const initials = name.split(' ').filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase()).join('') || '—';

  const needsReview = REVIEWABLE.includes(customer.status);


  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader variant="compact" back title={name} />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: space['3xl'],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand}
            />
          }
        >
          {/* ── Identity ── */}
          <Animated.View entering={FadeInDown.duration(320)}>
            <Surface level="sm" padded="base" rounded="xl">
              <View style={{ gap: space.base }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: radius.full,
                    backgroundColor: color.surfaceDark,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text variant="headline" style={{ color: '#fff' }}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title3" numberOfLines={2}>{name}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>{contact}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <Badge tone={STATUS_TONE[customer.status]} size="sm" dot>
                    {STATUS_LABEL[customer.status] ?? customer.status.toLowerCase()}
                  </Badge>
                  {customer.pcn_verified
                    ? <Badge tone="brand" size="sm">PCN verified</Badge>
                    : <Badge tone="neutral" size="sm">PCN unverified</Badge>}
                  <Badge tone="neutral" size="sm">
                    Joined {formatDate(customer.created_at)}
                  </Badge>
                </View>

                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => void emailAddress(customer.user.email)}
                    icon={<Icon name="email" size={14} color={color.text} />}
                  >
                    Email
                  </Button>
                  {customer.user.phone ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => void callNumber(customer.user.phone)}
                      icon={<Icon name="phone" size={14} color={color.text} />}
                    >
                      Call
                    </Button>
                  ) : null}
                </View>
              </View>
            </Surface>
          </Animated.View>

          {/* ── Review ── */}
          {needsReview ? (
            <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Review</Text>
              <Surface tone="warning" level="none" padded="base" rounded="lg">
                <View style={{ gap: space.base }}>
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Icon name="clock" size={17} color={color.warning} filled />
                    <Text variant="callout" style={{ flex: 1, color: '#92400e' }}>
                      This pharmacy is waiting on you. Check their PCN certificate
                      against the business name before approving.
                    </Text>
                  </View>

                  {customer.pcn_certificate_url ? (
                    certQ.data ? (
                      <CertificateViewer
                        url={certQ.data.url}
                        previewUrl={certQ.data.preview_url}
                        isPdf={certQ.data.is_pdf}
                        label={name}
                      />
                    ) : certQ.isError ? (
                      <Surface level="none" tone="danger" padded="md" rounded="md">
                        <Text variant="caption" style={{ color: '#991b1b' }}>
                          Couldn’t load the certificate. Pull to refresh and try again.
                        </Text>
                      </Surface>
                    ) : (
                      <Skeleton width="100%" height={220} radius="lg" />
                    )
                  ) : (
                    <Surface level="none" tone="danger" padded="md" rounded="md">
                      <Text variant="caption" style={{ color: '#991b1b' }}>
                        No certificate was uploaded. They can’t be approved until one is.
                      </Text>
                    </Surface>
                  )}

                  {rejecting ? (
                    <Animated.View entering={FadeIn.duration(220)} style={{ gap: space.sm }}>
                      <Input
                        label="Why are you rejecting?"
                        hint="Sent to the customer verbatim"
                        placeholder="e.g. The certificate has expired"
                        value={reason}
                        onChangeText={setReason}
                        editable={!busy}
                        multiline
                        required
                      />
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Button
                          variant="secondary"
                          style={{ flex: 1 }}
                          onPress={() => { setRejecting(false); setReason(''); }}
                          disabled={busy}
                        >
                          Back
                        </Button>
                        <Button
                          variant="danger"
                          style={{ flex: 1 }}
                          loading={busy}
                          disabled={busy || reason.trim().length < 4}
                          onPress={() => void decide('REJECTED')}
                        >
                          Reject
                        </Button>
                      </View>
                    </Animated.View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Button
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() => setRejecting(true)}
                        disabled={busy}
                      >
                        Reject
                      </Button>
                      <Button
                        style={{ flex: 1.4 }}
                        loading={busy}
                        disabled={busy || !customer.pcn_certificate_url}
                        onPress={() => void decide('APPROVED')}
                        haptic="medium"
                        icon={<Icon name="check" size={16} color="#fff" />}
                      >
                        Approve
                      </Button>
                    </View>
                  )}
                </View>
              </Surface>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Review</Text>
              <Surface level="sm" padded="base" rounded="lg">
                <View style={{ gap: space.md }}>
                  <Row
                    icon="shield"
                    label="Decision"
                    value={`${STATUS_LABEL[customer.status] ?? customer.status.toLowerCase()}${customer.reviewed_by ? ` by ${customer.reviewed_by.name}` : ''}`}
                  />
                  {customer.reviewed_at ? (
                    <Row icon="calendar" label="Reviewed" value={formatDate(customer.reviewed_at)} />
                  ) : null}
                  {customer.review_note ? (
                    <Row icon="document" label="Note" value={customer.review_note} />
                  ) : null}
                  {customer.pcn_certificate_url ? (
                    certQ.data ? (
                      <CertificateViewer
                        url={certQ.data.url}
                        previewUrl={certQ.data.preview_url}
                        isPdf={certQ.data.is_pdf}
                        label={name}
                      />
                    ) : (
                      <Skeleton width="100%" height={180} radius="lg" />
                    )
                  ) : null}
                </View>
              </Surface>
            </Animated.View>
          )}

          {/* ── Sales rep ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Sales rep</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{
                    width: 34, height: 34, borderRadius: radius.full,
                    backgroundColor: customer.assigned_staff ? color.accentSoft : color.surfaceMuted,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon
                      name="team"
                      size={15}
                      color={customer.assigned_staff ? color.accent : color.textTertiary}
                      filled={!!customer.assigned_staff}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    {customer.assigned_staff ? (
                      <>
                        <Text variant="body">
                          {customer.assigned_staff.first_name} {customer.assigned_staff.last_name}
                        </Text>
                        <Text variant="caption" tone="tertiary">{customer.assigned_staff.email}</Text>
                      </>
                    ) : (
                      <>
                        <Text variant="body" tone="tertiary">Nobody assigned</Text>
                        <Text variant="caption" tone="disabled">
                          Unassigned accounts don’t appear in any rep’s figures.
                        </Text>
                      </>
                    )}
                  </View>
                  {isAdmin ? (
                    <Pressable
                      onPress={() => setAssignOpen(o => !o)}
                      haptic="light"
                      pressOpacity={0.6}
                      hitSlop={8}
                      disabled={busy}
                    >
                      <Text variant="label" tone="brand">
                        {assignOpen ? 'Close' : customer.assigned_staff ? 'Change' : 'Assign'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {isAdmin && assignOpen ? (
                  <Animated.View entering={FadeIn.duration(220)} style={{ gap: space.xs }}>
                    <View style={{ height: layout.hairlineWidth, backgroundColor: color.borderSubtle }} />

                    {repsQ.isLoading ? (
                      <Skeleton width="100%" height={44} radius="md" />
                    ) : (
                      <>
                        {(repsQ.data?.records ?? []).map(rep => {
                          const active = customer.assigned_staff?.id === rep.id;
                          return (
                            <Pressable
                              key={rep.id}
                              onPress={() => void setRep(rep.id)}
                              haptic="light"
                              pressOpacity={0.6}
                              disabled={busy}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: space.md,
                                paddingVertical: space.md, minHeight: layout.tapTarget,
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text variant="body">{rep.first_name} {rep.last_name}</Text>
                                <Text variant="caption" tone="tertiary">
                                  {rep.assigned_customers} {rep.assigned_customers === 1 ? 'account' : 'accounts'}
                                </Text>
                              </View>
                              {active ? <Icon name="check" size={16} color={color.brand} /> : null}
                            </Pressable>
                          );
                        })}

                        {customer.assigned_staff ? (
                          <Pressable
                            onPress={() => void setRep(null)}
                            haptic="light"
                            pressOpacity={0.6}
                            disabled={busy}
                            style={{ paddingVertical: space.md }}
                          >
                            <Text variant="label" tone="danger">Remove assignment</Text>
                          </Pressable>
                        ) : null}
                      </>
                    )}
                  </Animated.View>
                ) : null}
              </View>
            </Surface>
          </Animated.View>

          {/* ── Business ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(320)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Business details</Text>
            <Surface level="sm" padded="base" rounded="lg">
              <View style={{ gap: space.md }}>
                <Row icon="building" label="Business name" value={customer.company_name} />
                <Row
                  icon="email"
                  label="Email"
                  value={customer.user.email}
                  onPress={() => void emailAddress(customer.user.email)}
                />
                <Row
                  icon="phone"
                  label="Phone"
                  value={customer.user.phone}
                  onPress={() => void callNumber(customer.user.phone)}
                />
                <Row
                  icon="location"
                  label="Address"
                  value={[customer.address, customer.city, customer.state].filter(Boolean).join(', ') || null}
                />
                <Row icon="referrals" label="Referral code" value={customer.referral_code} />
                {customer.referred_by ? (
                  <Row icon="user-plus" label="Referred by" value={customer.referred_by} />
                ) : null}
              </View>
            </Surface>
          </Animated.View>

          <Button
            variant="secondary"
            fullWidth
            onPress={() => router.push(`/(staff)/orders?search=${encodeURIComponent(name)}` as never)}
            icon={<Icon name="orders" size={16} color={color.text} />}
          >
            See their orders
          </Button>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * A detail row. When `onPress` is given the value renders in brand colour with
 * a trailing affordance, because a phone number that dials should look
 * different from one that doesn't — otherwise people either don't try it, or
 * try it on the ones that aren't links.
 */
function Row({ icon, label, value, onPress }: {
  icon: IconName; label: string; value: string | null; onPress?: () => void;
}) {
  const tappable = !!value && !!onPress;

  const body = (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
      <Icon name={icon} size={16} color={tappable ? color.brand : color.textTertiary} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" tone="tertiary">{label}</Text>
        <Text variant="callout" tone={!value ? 'disabled' : tappable ? 'brand' : 'default'}>
          {value ?? 'Not provided'}
        </Text>
      </View>
      {tappable ? <Icon name="chevron-right" size={14} color={color.textDisabled} /> : null}
    </View>
  );

  if (!tappable) return body;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={{ minHeight: layout.tapTarget, justifyContent: 'center' }}
    >
      {body}
    </Pressable>
  );
}
