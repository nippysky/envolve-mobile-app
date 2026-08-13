/**
 * Order lifecycle timeline.
 *
 * Shows the whole journey from placement to doorstep as a fixed set of stages,
 * with the reached ones filled and the rest waiting. Two decisions shape it:
 *
 *   • Every stage is always visible, including ones not yet reached. A
 *     progress indicator that only renders what's happened can't tell you how
 *     much is left, which is the actual question a customer has.
 *   • Order status and delivery status are merged into one sequence. They're
 *     two columns in the database but one experience — nobody thinks "my order
 *     is CONFIRMED and my delivery is PENDING", they think "it's been accepted
 *     and hasn't shipped".
 *
 * A cancelled order replaces the sequence entirely rather than showing a
 * half-filled track with a red cap. Cancellation isn't a stage of fulfilment;
 * it's the absence of one.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInLeft } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { color, space, radius, layout } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import type { OrderStatus, DeliveryStatus } from '@/lib/services/orders.service';

interface Stage {
  key:   string;
  label: string;
  hint:  string;
  icon:  IconName;
}

const STAGES: Stage[] = [
  { key: 'placed',     label: 'Order placed',   hint: 'We’ve received your order',         icon: 'receipt' },
  { key: 'confirmed',  label: 'Confirmed',      hint: 'Payment settled and stock reserved', icon: 'check-circle' },
  { key: 'processing', label: 'Being packed',   hint: 'Your items are being picked',        icon: 'inventory' },
  { key: 'dispatched', label: 'Out for delivery', hint: 'On the way to you',                icon: 'truck' },
  { key: 'delivered',  label: 'Delivered',      hint: 'Signed for at your pharmacy',        icon: 'home' },
];

/**
 * Farthest stage reached, as an index into STAGES. Delivery status wins when
 * present because it's the more specific signal — an order can sit at
 * CONFIRMED while its delivery is already IN_TRANSIT.
 */
function reachedIndex(order: OrderStatus, delivery: DeliveryStatus | null): number {
  if (delivery === 'DELIVERED') return 4;
  if (delivery === 'OUT_FOR_DELIVERY' || delivery === 'IN_TRANSIT') return 3;
  // ASSIGNED means a driver has it but it hasn't left — still "being packed".
  if (delivery === 'ASSIGNED') return 2;

  switch (order) {
    case 'DELIVERED':  return 4;
    case 'DISPATCHED': return 3;
    case 'PROCESSING': return 2;
    case 'CONFIRMED':  return 1;
    default:           return 0;
  }
}

export interface OrderTimelineProps {
  status:          OrderStatus;
  deliveryStatus?: DeliveryStatus | null;
  placedAt?:       string | null;
  dispatchedAt?:   string | null;
  deliveredAt?:    string | null;
}

export function OrderTimeline({
  status,
  deliveryStatus = null,
  placedAt,
  dispatchedAt,
  deliveredAt,
}: OrderTimelineProps) {
  const failed    = deliveryStatus === 'FAILED' || deliveryStatus === 'RETURNED';
  const cancelled = status === 'CANCELLED';
  const current   = useMemo(() => reachedIndex(status, deliveryStatus), [status, deliveryStatus]);

  const timestamps: Record<string, string | null | undefined> = {
    placed:     placedAt,
    dispatched: dispatchedAt,
    delivered:  deliveredAt,
  };

  if (cancelled) {
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        padding: space.base,
        borderRadius: radius.lg,
        backgroundColor: color.dangerSoft,
        borderWidth: layout.hairlineWidth,
        borderColor: '#fecaca',
      }}>
        <View style={{
          width: 34, height: 34, borderRadius: radius.full,
          backgroundColor: color.danger,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="close" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" style={{ color: '#991b1b' }}>Order cancelled</Text>
          <Text variant="caption" style={{ color: '#b91c1c' }}>
            Nothing further will be dispatched. Any settled payment is refunded to
            your account.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 0 }}>
      {STAGES.map((stage, i) => {
        const done   = i < current;
        const active = i === current;
        const filled = done || active;
        const isLast = i === STAGES.length - 1;

        // A failed delivery marks the dispatch stage rather than adding a
        // sixth one — the failure happened *at* that step.
        const isFailure = failed && i === 3;

        const dotBg =
          isFailure ? color.danger
          : active  ? color.brand
          : done    ? color.accent
          : color.surface;

        const dotFg = filled || isFailure ? '#fff' : color.textDisabled;
        const stamp = timestamps[stage.key];

        return (
          <Animated.View
            key={stage.key}
            entering={FadeInLeft.delay(i * 60).duration(320)}
            style={{ flexDirection: 'row', gap: space.md }}
          >
            {/* Rail */}
            <View style={{ alignItems: 'center', width: 34 }}>
              <View
                style={{
                  width: 34, height: 34, borderRadius: radius.full,
                  backgroundColor: dotBg,
                  borderWidth: filled || isFailure ? 0 : layout.hairlineWidth,
                  borderColor: color.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon
                  name={isFailure ? 'alert' : done ? 'check' : stage.icon}
                  size={15}
                  color={dotFg}
                  filled={filled}
                />
              </View>

              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 26,
                    marginVertical: 2,
                    borderRadius: 1,
                    backgroundColor: done ? color.accent : color.border,
                  }}
                />
              ) : null}
            </View>

            {/* Label */}
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : space.base, paddingTop: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text
                  variant={active ? 'bodyMedium' : 'body'}
                  tone={filled ? 'default' : 'disabled'}
                >
                  {isFailure ? 'Delivery attempt failed' : stage.label}
                </Text>

                {active && !isFailure ? (
                  <View style={{
                    paddingHorizontal: space.sm, paddingVertical: 2,
                    borderRadius: radius.full, backgroundColor: color.brandSoft,
                  }}>
                    <Text variant="caption" style={{ color: color.brand, fontSize: 10, fontWeight: '700' }}>
                      NOW
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text variant="caption" tone={filled ? 'tertiary' : 'disabled'}>
                {isFailure
                  ? 'Our team will contact you to rearrange.'
                  : stamp ? formatDate(stamp) : stage.hint}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
