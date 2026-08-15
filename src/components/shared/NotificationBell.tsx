/**
 * The notification bell and its unread badge.
 *
 * Extracted because the customer catalogue and the staff overview each carried
 * their own copy of this markup, and the driver app had none at all — so a
 * driver had no way to see that dispatch had told them something.
 *
 * Badge details that matter at this size:
 *   · It caps at 99+. A four-digit badge overflows the circle and, past a
 *     point, the exact number stops being information.
 *   · The badge has a 2pt ring in the page background colour, not white. On a
 *     tinted header a white ring reads as a rendering artefact.
 *   · The count is announced in the accessibility label, since the badge is a
 *     purely visual signal.
 */

import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Pressable } from '@/components/ui/Pressable';
import { color, radius, layout } from '@/constants/theme';

export interface NotificationBellProps {
  count: number;
  onPress: () => void;
  /** Ring colour around the badge — match the surface the bell sits on. */
  ringColor?: string;
}

export function NotificationBell({
  count, onPress, ringColor = color.bg }: NotificationBellProps) {
  const has = count > 0;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={has ? `Notifications, ${count} unread` : 'Notifications'}
      style={{
        width: 40, height: 40, borderRadius: radius.full,
        backgroundColor: color.surface,
        borderWidth: layout.hairlineWidth,
        borderColor: has ? color.brandBorder : color.border,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon
        name="notifications"
        size={18}
        color={has ? color.brand : color.text}
        filled={has}
      />

      {has ? (
        <View
          style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, paddingHorizontal: 4,
            borderRadius: radius.full,
            backgroundColor: color.danger,
            borderWidth: 2, borderColor: ringColor,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text variant="caption" style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
