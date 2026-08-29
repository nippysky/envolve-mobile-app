/**
 * Shared shell for auth screens.
 *
 * Handles the things every auth screen needs and that are easy to get subtly
 * wrong per-screen: keyboard avoidance, safe areas, the brand wash, a back
 * affordance, and a scroll container that still works when the keyboard eats
 * half the viewport.
 */

import React from 'react';
import {
  View, ScrollView, KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text, Pressable, Icon } from '@/components/ui';
import { color, space, radius, gutter, layout } from '@/constants/theme';

export interface AuthScreenProps {
  /** Small caps eyebrow above the title. */
  eyebrow?:  string;
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
  /** Pinned to the bottom, outside the scroll area. */
  footer?:   React.ReactNode;
  showBack?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Tint for the wash and the eyebrow. Each door on the chooser owns a colour;
   * passing the same one here means the screen you land on reads as a
   * continuation of the card you tapped rather than a new place. Defaults to
   * brand, which is what every screen used before this existed.
   */
  accent?:   string;
}

export function AuthScreen({
  eyebrow, title, subtitle, children, footer, showBack = true, contentStyle,
  accent = color.brand,
}: AuthScreenProps) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <LinearGradient
        colors={[`${accent}14`, 'transparent']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          // On Android the window resizes, so the offset would double-count.
          keyboardVerticalOffset={0}
        >
          {/* Back */}
          {showBack ? (
            <View style={{ height: layout.tapTarget, justifyContent: 'center', paddingHorizontal: gutter }}>
              <Pressable
                onPress={() => router.back()}
                haptic="light"
                pressScale={0.9}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={{
                  width: 38, height: 38, borderRadius: radius.full,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: color.surface,
                  borderWidth: 1, borderColor: color.border,
                }}
              >
                <Icon name="back" size={17} color={color.text} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={[
              { flexGrow: 1, paddingHorizontal: gutter, paddingBottom: space.xl },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {/* Heading */}
            <Animated.View
              entering={FadeInDown.duration(380)}
              style={{ paddingTop: space.lg, marginBottom: space['2xl'] }}
            >
              {eyebrow ? (
                <Text variant="overline" style={{ marginBottom: space.sm, color: accent }}>
                  {eyebrow}
                </Text>
              ) : null}
              <Text variant="title1" style={{ marginBottom: subtitle ? space.sm : 0 }}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="body" tone="secondary">{subtitle}</Text>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).duration(380)}>
              {children}
            </Animated.View>
          </ScrollView>

          {footer ? (
            <View style={{ paddingHorizontal: gutter, paddingBottom: space.sm }}>
              {footer}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
