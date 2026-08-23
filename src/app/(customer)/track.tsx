/**
 * Track an order.
 *
 * `/api/track/:code` takes either a delivery tracking code or an order number
 * and needs no session, so this screen works for someone chasing a delivery on
 * a colleague's behalf. The input says so explicitly rather than making people
 * guess which of the two numbers on their invoice is the right one.
 *
 * Codes are uppercased as you type because the API uppercases before lookup —
 * showing the transformation as it happens is more honest than silently
 * accepting lowercase and appearing to match something you didn't type.
 */

import React, { useCallback, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Icon, Surface, StatusBadge, EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { color, space, gutter } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { track, type TrackingResult } from '@/lib/services/orders.service';
import { ApiError } from '@/lib/api-client';

export default function TrackScreen() {
  const router = useRouter();

  const [code,   setCode]   = useState('');
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);

  const search = useCallback(async () => {
    const raw = code.trim();
    if (busy) return;
    if (raw.length < 4) {
      setError('Enter a tracking code or order number.');
      return;
    }

    setBusy(true);
    setError('');
    setResult(null);

    try {
      setResult(await track(raw));
    } catch (err) {
      const e = err as ApiError;
      setError(
        e.status === 404
          ? 'We couldn’t find anything with that code. Double-check it against your order confirmation.'
          : e.message || 'Could not look that up right now.',
      );
    } finally {
      setBusy(false);
    }
  }, [code, busy]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Track an order"
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space['2xl'] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: space.md }}>
              <Input
                label="Tracking code or order number"
                hint="Both work — e.g. EP-1234567890-ABCD or ENV-2026-000001"
                placeholder="Enter your code"
                value={code}
                onChangeText={t => { setCode(t.toUpperCase()); setError(''); }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => void search()}
                editable={!busy}
                error={error}
                leading={<Icon name="track" size={17} color={color.textTertiary} />}
              />

              <Button
                size="lg"
                fullWidth
                loading={busy}
                disabled={busy || code.trim().length < 4}
                onPress={search}
                haptic="medium"
              >
                {busy ? 'Looking up…' : 'Track'}
              </Button>
            </View>

            {result ? (
              <Animated.View entering={FadeIn.duration(300)} style={{ gap: space.lg }}>
                {/* Summary */}
                <Animated.View entering={FadeInDown.duration(320)}>
                  <Surface level="sm" padded="base" rounded="lg">
                    <View style={{ gap: space.md }}>
                      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                        {result.order_status ? (
                          <StatusBadge status={result.order_status} kind="order" />
                        ) : null}
                        {result.delivery_status ? (
                          <StatusBadge status={result.delivery_status} kind="delivery" />
                        ) : null}
                      </View>

                      {result.order_number ? (
                        <Detail label="Order number" value={result.order_number} mono />
                      ) : null}
                      {result.tracking_code ? (
                        <Detail label="Tracking code" value={result.tracking_code} mono />
                      ) : null}
                      {result.delivery_city || result.delivery_state ? (
                        <Detail
                          label="Destination"
                          value={[result.delivery_city, result.delivery_state].filter(Boolean).join(', ')}
                        />
                      ) : null}
                      {result.order_placed_at ? (
                        <Detail label="Placed" value={formatDate(result.order_placed_at)} />
                      ) : null}
                    </View>
                  </Surface>
                </Animated.View>

                {/* Timeline */}
                {result.order_status ? (
                  <Animated.View entering={FadeInDown.delay(80).duration(320)} style={{ gap: space.sm }}>
                    <Text variant="overline" tone="tertiary">Progress</Text>
                    <Surface level="sm" padded="base" rounded="lg">
                      <OrderTimeline
                        status={result.order_status}
                        deliveryStatus={result.delivery_status}
                        placedAt={result.order_placed_at}
                        dispatchedAt={result.dispatched_at}
                        deliveredAt={result.delivered_at}
                      />
                    </Surface>
                  </Animated.View>
                ) : null}

                <Button
                  variant="ghost"
                  fullWidth
                  onPress={() => router.push('/(customer)/orders' as never)}
                >
                  See all my orders
                </Button>
              </Animated.View>
            ) : !busy && !error ? (
              <EmptyState
                iconName="track"
                compact
                title="Enter a code to begin"
                subtitle="You’ll find both numbers on your order confirmation email."
              />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Detail({ label, value, mono = false }: {
  label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.base }}>
      <Text variant="callout" tone="tertiary">{label}</Text>
      <Text variant={mono ? 'mono' : 'callout'} style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
