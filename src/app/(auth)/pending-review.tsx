/**
 * Post-registration holding screen.
 *
 * Registration completes with the account in PENDING_REVIEW — the customer
 * cannot sign in until compliance verifies their PCN certificate. Saying so
 * plainly here prevents the "my password doesn't work" support ticket.
 */

import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Text, Button, Surface, Icon } from '@/components/ui';
import { color, space, radius, gutter } from '@/constants/theme';

export default function PendingReviewScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <LinearGradient
        colors={[`${color.accent}12`, 'transparent']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 340 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, paddingHorizontal: gutter, justifyContent: 'center', alignItems: 'center', gap: space.xl }}>
          <Animated.View
            entering={ZoomIn.duration(420)}
            style={{
              width: 96, height: 96, borderRadius: radius['2xl'],
              backgroundColor: color.successSoft,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="check-circle" size={44} color={color.success} filled />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(420)} style={{ alignItems: 'center', gap: space.md }}>
            <Text variant="title1" align="center">Account created</Text>
            <Text variant="body" tone="secondary" align="center" style={{ maxWidth: 320 }}>
              Our compliance team is reviewing your PCN certificate. You&rsquo;ll receive an
              email as soon as your pharmacy is approved.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(420)} style={{ alignSelf: 'stretch' }}>
            <Surface tone="warning" level="none" padded="base" rounded="lg">
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Icon name="clock" size={17} color={color.warning} filled />
                <Text variant="callout" style={{ flex: 1, color: '#92400e' }}>
                  You won&rsquo;t be able to sign in until your account is approved. Reviews
                  are usually completed within one business day.
                </Text>
              </View>
            </Surface>
          </Animated.View>
        </View>

        <View style={{ paddingHorizontal: gutter, paddingBottom: space.base, gap: space.sm }}>
          <Button size="lg" fullWidth onPress={() => router.replace('/(public)/catalogue')}>
            Browse the catalogue
          </Button>
          <Button variant="ghost" fullWidth onPress={() => router.replace('/(auth)/sign-in')}>
            Back to sign in
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}
