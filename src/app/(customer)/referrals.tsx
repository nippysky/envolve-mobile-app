/**
 * Referrals.
 *
 * The code is the screen. It's set large, in monospace with wide tracking, on
 * a dark card — sized to be read aloud over a phone call, which is how most of
 * these codes actually travel between pharmacists.
 *
 * Share produces a full sign-up link with the code pre-filled rather than the
 * bare code, matching what the web portal shares. Nobody should have to
 * explain where to type it.
 *
 * The reward mechanics are quoted from `referral.programme`, which the API
 * reads live from admin settings — so changing the threshold in the admin
 * console changes what this screen says, with no release needed.
 *
 * The balance is naira. Both awards credit money into one wallet, and that
 * wallet becomes spendable at checkout once the business enables redemption —
 * `programme.redemption_enabled`. While it's off, the screen says the balance
 * is accruing rather than offering an action the server would refuse.
 */

import React, { useCallback } from 'react';
import { View, ScrollView, RefreshControl, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Icon, Surface, Skeleton, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { API_BASE } from '@/constants/api';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { getMyAccount, type CustomerStatus } from '@/lib/services/account.service';
import { toast } from '@/lib/toast';

/** Short labels — the raw enum values are too long for a list row. */
const REFERRAL_STATUS: Record<CustomerStatus, string> = {
  APPROVED:          'Active',
  PENDING_REVIEW:    'Awaiting review',
  PCN_CERT_UPLOADED: 'Cert uploaded',
  OTP_CONFIRMED:     'Email confirmed',
  REGISTERED:        'Registered',
  REJECTED:          'Rejected',
};

export default function ReferralsScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['account', 'me'],
    queryFn:  getMyAccount,
    staleTime: 60_000,
  });

  const referral  = data?.referral;
  const code      = referral?.referral_code ?? null;
  const programme = referral?.programme ?? null;

  const copyCode = useCallback(async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    toast.success('Referral code copied to your clipboard.');
  }, [code]);

  const shareCode = useCallback(async () => {
    if (!code) return;
    const link = `${API_BASE}/sign-up?ref=${encodeURIComponent(code)}`;
    await Share.share({
      message:
        `Join me on EnvolveCare Express — wholesale pharmaceuticals for verified ` +
        `pharmacies. Sign up with my referral code ${code}:\n${link}`,
    });
  }, [code]);


  const { refreshing, onRefresh } = useRefresh(refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader variant="compact" back title="Referrals" />

        <ScrollView
          contentContainerStyle={{
            padding: gutter,
            gap: space.lg,
            paddingBottom: space['2xl'],
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
          {isLoading ? (
            <View style={{ gap: space.base }}>
              <Skeleton width="100%" height={180} radius="xl" />
              <Skeleton width="100%" height={90}  radius="lg" />
              <Skeleton width="100%" height={140} radius="lg" />
            </View>
          ) : isError ? (
            <EmptyState
              iconName="alert"
              tone="danger"
              title="Couldn’t load your referrals"
              actionLabel="Retry"
              onAction={() => void refetch()}
            />
          ) : !code ? (
            <EmptyState
              iconName="referrals"
              tone="brand"
              title="No referral code yet"
              subtitle="Codes are issued once your pharmacy account is approved. Yours will appear here."
            />
          ) : (
            <>
              {/* ── Code card ── */}
              <Animated.View entering={FadeInDown.duration(360)}>
                <View style={{
                  padding: space.xl,
                  borderRadius: radius['2xl'],
                  backgroundColor: color.surfaceDark,
                  gap: space.base,
                  overflow: 'hidden',
                }}>
                  {/* Decorative bloom — keeps the dark card from reading flat. */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute', top: -70, right: -50,
                      width: 200, height: 200, borderRadius: 100,
                      backgroundColor: color.brand, opacity: 0.16,
                    }}
                  />

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Icon name="sparkles" size={15} color="#7dd3fc" />
                    <Text variant="overline" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Your referral code
                    </Text>
                  </View>

                  <Text
                    variant="display"
                    style={{ color: '#fff', letterSpacing: 3, fontVariant: ['tabular-nums'] }}
                    selectable
                  >
                    {code}
                  </Text>

                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {programme
                      ? `Share it with another pharmacy. You earn ${formatNaira(programme.signup_bonus)} when they sign up, and ${formatNaira(programme.spend_reward)} more once their orders reach ${formatNaira(programme.spend_threshold)}.`
                      : 'Share it with another pharmacy. When they sign up with your code and start ordering, you earn reward credit.'}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                    <Button
                      variant="secondary"
                      onPress={copyCode}
                      haptic="light"
                      icon={<Icon name="copy" size={16} color={color.text} />}
                      style={{ flex: 1 }}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={shareCode}
                      haptic="medium"
                      icon={<Icon name="share" size={16} color={color.text} />}
                      style={{ flex: 1.3 }}
                    >
                      Share
                    </Button>
                  </View>
                </View>
              </Animated.View>

              {/* ── Stats ── */}
              <Animated.View
                entering={FadeInDown.delay(80).duration(340)}
                style={{ flexDirection: 'row', gap: space.md }}
              >
                <Stat
                  icon="customers"
                  value={String(referral?.referral_count ?? 0)}
                  label={referral?.referral_count === 1 ? 'Pharmacy referred' : 'Pharmacies referred'}
                />
                <Stat
                  icon="star"
                  value={formatNaira(referral?.referral_points ?? 0)}
                  label="Reward balance"
                  tone="brand"
                />
              </Animated.View>

              {/* ── Spendability ── */}
              <Animated.View entering={FadeInDown.delay(110).duration(340)}>
                <Surface
                  tone={programme?.redemption_enabled ? 'brand' : 'subtle'}
                  level="none"
                  padded="base"
                  rounded="lg"
                >
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Icon
                      name={programme?.redemption_enabled ? 'money' : 'lock'}
                      size={16}
                      color={programme?.redemption_enabled ? color.brand : color.textTertiary}
                      filled
                    />
                    <Text
                      variant="caption"
                      style={{ flex: 1, color: programme?.redemption_enabled ? '#006a8a' : color.textSecondary }}
                    >
                      {programme?.redemption_enabled
                        ? (referral && referral.redeemable > 0
                            ? `${formatNaira(referral.redeemable)} can be applied to your next order at checkout.`
                            : `Reach ${formatNaira(programme.min_redemption)} to start spending your balance at checkout.`)
                        : 'Spending your balance against orders will be switched on soon. Nothing expires in the meantime.'}
                    </Text>
                  </View>
                </Surface>
              </Animated.View>

              {/* ── Who referred you ── */}
              {referral?.referred_by ? (
                <Animated.View entering={FadeInDown.delay(130).duration(340)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Who referred you</Text>
                  <Surface level="sm" padded="base" rounded="lg">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <View style={{
                        width: 34, height: 34, borderRadius: radius.full,
                        backgroundColor: color.surfaceMuted,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text variant="caption" tone="secondary" style={{ fontWeight: '700' }}>
                          {referral.referred_by.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body" numberOfLines={1}>{referral.referred_by.name}</Text>
                        {referral.referred_by.code ? (
                          <Text variant="mono" tone="tertiary">{referral.referred_by.code}</Text>
                        ) : null}
                      </View>
                    </View>
                  </Surface>
                </Animated.View>
              ) : null}

              {/* ── Pharmacies you referred ── */}
              {referral && referral.referrals.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(150).duration(340)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Pharmacies you referred</Text>
                  <Surface level="sm" padded="none" rounded="lg">
                    {referral.referrals.map((r, i, arr) => (
                      <View
                        key={r.id}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: space.md,
                          paddingHorizontal: space.base, paddingVertical: space.md,
                          borderBottomWidth: i === arr.length - 1 ? 0 : layout.hairlineWidth,
                          borderBottomColor: color.borderSubtle,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text variant="body" numberOfLines={1}>{r.name}</Text>
                          <Text variant="caption" tone="tertiary">
                            {REFERRAL_STATUS[r.status] ?? r.status.toLowerCase()} · {formatDate(r.joined_at)}
                          </Text>
                        </View>
                        <Text
                          variant="bodyMedium"
                          tone={r.reward_earned > 0 ? 'success' : 'disabled'}
                        >
                          {r.reward_earned > 0 ? `+${formatNaira(r.reward_earned)}` : '—'}
                        </Text>
                      </View>
                    ))}
                  </Surface>
                </Animated.View>
              ) : null}

              {/* ── Balance history ── */}
              {referral && referral.ledger.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(170).duration(340)} style={{ gap: space.sm }}>
                  <Text variant="overline" tone="tertiary">Balance history</Text>
                  <Surface level="sm" padded="none" rounded="lg">
                    {referral.ledger.map((e, i, arr) => (
                      <View
                        key={e.id}
                        style={{
                          flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
                          paddingHorizontal: space.base, paddingVertical: space.md,
                          borderBottomWidth: i === arr.length - 1 ? 0 : layout.hairlineWidth,
                          borderBottomColor: color.borderSubtle,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text variant="callout" numberOfLines={2}>{e.description}</Text>
                          <Text variant="caption" tone="disabled">{formatDate(e.created_at)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text variant="bodyMedium" tone={e.delta > 0 ? 'success' : 'default'}>
                            {e.delta > 0 ? '+' : '−'}{formatNaira(Math.abs(e.delta))}
                          </Text>
                          <Text variant="caption" tone="disabled">
                            {formatNaira(e.balance_after)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Surface>
                </Animated.View>
              ) : null}

              {/* ── How it works ── */}
              <Animated.View entering={FadeInDown.delay(140).duration(340)} style={{ gap: space.sm }}>
                <Text variant="overline" tone="tertiary">How it works</Text>
                <Surface level="sm" padded="base" rounded="lg">
                  <View style={{ gap: space.base }}>
                    <Step
                      n="1"
                      title="Share your code"
                      body="Send it to a pharmacy that buys wholesale."
                    />
                    <Step
                      n="2"
                      title={
                        programme
                          ? `They sign up — you get ${formatNaira(programme.signup_bonus)}`
                          : 'They sign up with it'
                      }
                      body="Credited as soon as their account is created, before they order anything."
                    />
                    <Step
                      n="3"
                      title={
                        programme
                          ? `They spend ${formatNaira(programme.spend_threshold)} — you get ${formatNaira(programme.spend_reward)}`
                          : 'They start ordering'
                      }
                      body={
                        programme
                          ? `Awarded once their paid orders total ${formatNaira(programme.spend_threshold)}. Paid once per referred pharmacy.`
                          : 'A further reward lands once their purchases reach the qualifying amount.'
                      }
                      last
                    />
                  </View>
                </Surface>
              </Animated.View>

              <Text variant="caption" tone="disabled" align="center">
                {programme?.redemption_enabled
                  ? 'Apply your balance to any order at checkout. It never expires.'
                  : 'Your balance is held safely until spending is switched on. It never expires.'}
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function Stat({ icon, value, label, tone = 'neutral' }: {
  icon: 'customers' | 'star';
  value: string;
  label: string;
  tone?: 'neutral' | 'brand';
}) {
  return (
    <Surface level="sm" padded="base" rounded="lg" style={{ flex: 1 }}>
      <View style={{ gap: space.sm }}>
        <View style={{
          width: 30, height: 30, borderRadius: radius.full,
          backgroundColor: tone === 'brand' ? color.brandSoft : color.surfaceMuted,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon
            name={icon}
            size={15}
            color={tone === 'brand' ? color.brand : color.textTertiary}
            filled={tone === 'brand'}
          />
        </View>
        <Text variant="title2">{value}</Text>
        <Text variant="caption" tone="tertiary">{label}</Text>
      </View>
    </Surface>
  );
}

function Step({ n, title, body, last = false }: {
  n: string; title: string; body: string; last?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{
          width: 24, height: 24, borderRadius: radius.full,
          backgroundColor: color.brandSoft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text variant="caption" style={{ color: color.brand, fontWeight: '700', fontSize: 11 }}>
            {n}
          </Text>
        </View>
        {!last ? (
          <View style={{
            width: 2, flex: 1, minHeight: 18, marginTop: 2,
            backgroundColor: color.borderSubtle, borderRadius: 1,
          }} />
        ) : null}
      </View>

      <View style={{ flex: 1, paddingBottom: last ? 0 : space.sm }}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="caption" tone="tertiary">{body}</Text>
      </View>
    </View>
  );
}
