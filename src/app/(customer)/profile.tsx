/**
 * Account.
 *
 * Identity at the top, the numbers that prove the relationship next, then the
 * menu. The spend and order totals aren't vanity metrics — for a wholesale
 * account they're the figures a pharmacist reconciles against their own books,
 * so they get real estate rather than a line in a list.
 *
 * Verification status is stated plainly. A pharmacy whose PCN certificate is
 * still under review can browse but not order, and finding that out at
 * checkout instead of here would be a poor way to learn it.
 */

import React, { useCallback } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Pressable, Icon, Surface, Badge, Skeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { callNumber, emailAddress } from '@/lib/contact';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useAuth } from '@/contexts/AuthContext';
import { getMyAccount } from '@/lib/services/account.service';
import type { IconName } from '@/components/ui/Icon';

const SUPPORT_EMAIL = 'info@envolvepharm.com.ng';
const SUPPORT_PHONE = '+2348055136726';

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['account', 'me'],
    queryFn:  getMyAccount,
    staleTime: 60_000,
  });

  const profile  = data?.profile;
  const referral = data?.referral;

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      'Sign out?',
      'You’ll need your email and password to sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
      ],
    );
  }, [logout]);

  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '—';

  const approved = profile?.status === 'APPROVED';


  const { refreshing, onRefresh } = useRefresh(refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader title="Account" />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: layout.tabBarHeight + space['2xl'],
          }}
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
          <Animated.View entering={FadeInDown.duration(340)}>
            <Surface level="sm" padded="base" rounded="xl">
              <View style={{ gap: space.base }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
                  <View style={{
                    width: 58, height: 58, borderRadius: radius.full,
                    backgroundColor: color.surfaceDark,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text variant="title3" style={{ color: '#fff' }}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title3" numberOfLines={1}>{fullName || 'Your account'}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {profile?.email ?? user?.email}
                    </Text>
                    {profile?.company_name ? (
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {profile.company_name}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => router.push('/(customer)/profile-edit' as never)}
                    haptic="light"
                    pressScale={0.92}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile"
                    style={{
                      width: 34, height: 34, borderRadius: radius.full,
                      backgroundColor: color.surfaceMuted,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name="edit" size={15} color={color.text} />
                  </Pressable>
                </View>

                {isLoading ? (
                  <Skeleton width="60%" height={22} radius="full" />
                ) : (
                  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                    <Badge tone={approved ? 'success' : 'warning'} size="sm" dot>
                      {approved ? 'Approved' : (profile?.status ?? 'Pending').toLowerCase()}
                    </Badge>
                    {profile?.pcn_verified ? (
                      <Badge tone="brand" size="sm">PCN verified</Badge>
                    ) : (
                      <Badge tone="neutral" size="sm">PCN under review</Badge>
                    )}
                    {profile?.member_since ? (
                      <Badge tone="neutral" size="sm">
                        Since {formatDate(profile.member_since)}
                      </Badge>
                    ) : null}
                  </View>
                )}
              </View>
            </Surface>
          </Animated.View>

          {/* ── Not yet approved ── */}
          {profile && !approved ? (
            <Animated.View entering={FadeInDown.delay(60).duration(320)}>
              <Surface tone="warning" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="clock" size={17} color={color.warning} filled />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ color: '#92400e' }}>
                      Your account is still being reviewed
                    </Text>
                    <Text variant="caption" style={{ color: '#a16207' }}>
                      You can browse the full catalogue now. Ordering unlocks once our
                      team verifies your PCN certificate.
                    </Text>
                  </View>
                </View>
              </Surface>
            </Animated.View>
          ) : null}

          {/* ── Numbers ── */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(340)}
            style={{ flexDirection: 'row', gap: space.md }}
          >
            <Stat
              label="Orders placed"
              value={isLoading ? '—' : String(profile?.total_orders ?? 0)}
            />
            <Stat
              label="Total spent"
              value={isLoading ? '—' : formatNaira(profile?.total_spent ?? 0)}
              wide
            />
          </Animated.View>

          {/* ── Menu ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(340)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Your account</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <MenuRow
                icon="referrals"
                label="Referrals"
                hint={referral?.referral_code ?? 'Share your code'}
                badge={referral?.referral_points ? `${referral.referral_points} pts` : undefined}
                onPress={() => router.push('/(customer)/referrals' as never)}
              />
              <MenuRow
                icon="notifications"
                label="Notifications"
                onPress={() => router.push('/(customer)/notifications' as never)}
              />
              <MenuRow
                icon="track"
                label="Track an order"
                onPress={() => router.push('/(customer)/track' as never)}
              />
              <MenuRow
                icon="orders"
                label="Order history"
                onPress={() => router.push('/(customer)/orders' as never)}
                last
              />
            </Surface>
          </Animated.View>

          {/* ── Business details ── */}
          {profile ? (
            <Animated.View entering={FadeInDown.delay(180).duration(340)} style={{ gap: space.sm }}>
              <Text variant="overline" tone="tertiary">Pharmacy details</Text>
              <Surface level="sm" padded="base" rounded="lg">
                <View style={{ gap: space.md }}>
                  <Detail icon="building" label="Business name" value={profile.company_name} />
                  <Detail icon="phone"    label="Phone"         value={profile.phone} />
                  <Detail
                    icon="location"
                    label="Address"
                    value={[profile.address, profile.city, profile.state].filter(Boolean).join(', ') || null}
                  />
                </View>
              </Surface>
              <Text variant="caption" tone="disabled">
                Business name, address and PCN details are locked to what our team
                verified. Contact support to change them.
              </Text>
            </Animated.View>
          ) : null}

          {/* ── Support ── */}
          <Animated.View entering={FadeInDown.delay(220).duration(340)} style={{ gap: space.sm }}>
            <Text variant="overline" tone="tertiary">Support</Text>
            <Surface level="sm" padded="none" rounded="lg">
              <MenuRow
                icon="email"
                label="Email us"
                hint={SUPPORT_EMAIL}
                onPress={() => void emailAddress(SUPPORT_EMAIL)}
              />
              <MenuRow
                icon="phone"
                label="Call us"
                hint="+234 805 513 6726"
                onPress={() => void callNumber(SUPPORT_PHONE)}
                last
              />
            </Surface>
          </Animated.View>

          <Button
            variant="ghost"
            fullWidth
            onPress={confirmSignOut}
            icon={<Icon name="logout" size={16} color={color.danger} />}
            style={{ marginTop: space.sm }}
          >
            <Text variant="bodyMedium" tone="danger">Sign out</Text>
          </Button>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function Stat({ label, value, wide = false }: {
  label: string; value: string; wide?: boolean;
}) {
  return (
    <Surface level="sm" padded="base" rounded="lg" style={{ flex: wide ? 1.4 : 1 }}>
      <View style={{ gap: space.xs }}>
        <Text variant="caption" tone="tertiary">{label}</Text>
        <Text variant="title3" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
    </Surface>
  );
}

function MenuRow({ icon, label, hint, badge, onPress, last = false }: {
  icon: IconName;
  label: string;
  hint?: string;
  badge?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.base,
        paddingVertical: space.md,
        minHeight: layout.tapTarget,
        borderBottomWidth: last ? 0 : layout.hairlineWidth,
        borderBottomColor: color.borderSubtle,
      }}
    >
      <View style={{
        width: 32, height: 32, borderRadius: radius.full,
        backgroundColor: color.surfaceMuted,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={15} color={color.textSecondary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {hint ? <Text variant="caption" tone="tertiary" numberOfLines={1}>{hint}</Text> : null}
      </View>

      {badge ? (
        <View style={{
          paddingHorizontal: space.sm, paddingVertical: 3,
          borderRadius: radius.full, backgroundColor: color.brandSoft,
        }}>
          <Text variant="caption" style={{ color: color.brand, fontWeight: '700' }}>{badge}</Text>
        </View>
      ) : null}

      <Icon name="chevron-right" size={15} color={color.textDisabled} />
    </Pressable>
  );
}

function Detail({ icon, label, value }: {
  icon: IconName; label: string; value: string | null;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <Icon name={icon} size={16} color={color.textTertiary} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" tone="tertiary">{label}</Text>
        <Text variant="callout" tone={value ? 'default' : 'disabled'}>
          {value ?? 'Not provided'}
        </Text>
      </View>
    </View>
  );
}
