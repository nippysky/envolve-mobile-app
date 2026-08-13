/**
 * Legal document screen — terms and privacy.
 *
 * Both documents are long, dense and read exactly once, usually because
 * someone tapped a link during sign-up and wants to get back. So: a compact
 * header with an unambiguous close, generous line height, and section numbers
 * that stay visible while scrolling past them.
 *
 * Body text is set at `callout` rather than `caption`. Legal copy that's
 * technically present but painful to read is a dark pattern; if the customer
 * is agreeing to it, they should be able to read it.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { Pressable } from '@/components/ui/Pressable';
import { Icon } from '@/components/ui/Icon';
import { color, space, radius, gutter, layout } from '@/constants/theme';

export interface LegalSection {
  title: string;
  body:  string;
}

export interface LegalScreenProps {
  title:    string;
  updated:  string;
  intro?:   string;
  sections: LegalSection[];
}

export function LegalScreen({ title, updated, intro, sections }: LegalScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: gutter,
          paddingBottom: space.md,
          borderBottomWidth: layout.hairlineWidth,
          borderBottomColor: color.borderSubtle,
        }}>
          <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>

          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            haptic="light"
            pressScale={0.92}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              width: 34, height: 34, borderRadius: radius.full,
              backgroundColor: color.surfaceMuted,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="close" size={15} color={color.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space['3xl'],
            gap: space.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: space.sm }}>
            <Text variant="caption" tone="disabled">Last updated: {updated}</Text>
            {intro ? (
              <Text variant="callout" tone="secondary" style={{ lineHeight: 22 }}>
                {intro}
              </Text>
            ) : null}
          </View>

          {sections.map((s, i) => (
            <Animated.View
              key={s.title}
              entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(300)}
              style={{ gap: space.sm }}
            >
              <Text variant="bodyMedium">{s.title}</Text>
              <Text variant="callout" tone="secondary" style={{ lineHeight: 22 }}>
                {s.body}
              </Text>
            </Animated.View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
