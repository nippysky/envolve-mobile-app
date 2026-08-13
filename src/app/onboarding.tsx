/**
 * Onboarding.
 *
 * Three slides, paged horizontally. The polish is in the details:
 *
 *   • Artwork parallaxes at 0.4× scroll speed while copy moves at 1×, which
 *     reads as depth rather than a flat filmstrip.
 *   • Slides scale and fade based on distance from centre, so the active card
 *     is unmistakably the focus.
 *   • The pager dot stretches into a pill on the active page rather than
 *     swapping colour — movement is more legible than a colour change.
 *   • The CTA morphs its label on the last slide instead of a separate button
 *     appearing, so nothing shifts under the thumb.
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, useWindowDimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';

import { Text, Button, Pressable, Icon } from '@/components/ui';
import { color, space, radius, motion, gutter } from '@/constants/theme';
import { Storage } from '@/lib/storage';

/* ── Content ─────────────────────────────────────────────────────────────── */

interface Slide {
  key:    string;
  icon:   React.ComponentProps<typeof Icon>['name'];
  title:  string;
  body:   string;
  tint:   string;
}

const SLIDES: Slide[] = [
  {
    key:   'catalogue',
    icon:  'shop',
    title: 'The full catalogue,\nin your pocket',
    body:  'Browse every product Envolve distributes — strengths, pack sizes and live stock, updated the moment the warehouse changes it.',
    tint:  color.brand,
  },
  {
    key:   'ordering',
    icon:  'orders',
    title: 'Order in\na few taps',
    body:  'Build a basket, pay securely, and watch your order move from confirmed to delivered without picking up the phone.',
    tint:  '#0891b2',
  },
  {
    key:   'tracking',
    icon:  'truck',
    title: 'Know exactly\nwhere it is',
    body:  'Live tracking from our warehouse to your counter, with the batch numbers and expiry dates you need for compliance.',
    tint:  color.accent,
  },
];

/* ── Slide ───────────────────────────────────────────────────────────────── */

function SlideView({
  slide, index, scrollX, width,
}: {
  slide: Slide; index: number; scrollX: SharedValue<number>; width: number;
}) {
  // Distance of this slide from the viewport centre, in pages.
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const artStyle = useAnimatedStyle(() => ({
    // Parallax: artwork lags the scroll so it sits "behind" the copy.
    transform: [
      { translateX: interpolate(scrollX.value, inputRange, [width * 0.35, 0, -width * 0.35], Extrapolation.CLAMP) },
      { scale:      interpolate(scrollX.value, inputRange, [0.82, 1, 0.82], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
  }));

  const copyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollX.value, inputRange, [24, 0, 24], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={{ width, alignItems: 'center', paddingHorizontal: gutter }}>
      {/* Artwork */}
      <Animated.View
        style={[
          {
            width:  width * 0.62,
            height: width * 0.62,
            borderRadius: radius['3xl'],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space['3xl'],
          },
          artStyle,
        ]}
      >
        <LinearGradient
          colors={[`${slide.tint}22`, `${slide.tint}05`]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            ...StyleSheetAbsoluteFill,
            borderRadius: radius['3xl'],
            borderWidth: 1,
            borderColor: `${slide.tint}20`,
          }}
        />
        <View
          style={{
            width: 96, height: 96, borderRadius: radius['2xl'],
            backgroundColor: color.surface,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: slide.tint,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.22,
            shadowRadius: 28,
            elevation: 10,
          }}
        >
          <Icon name={slide.icon} size={42} color={slide.tint} />
        </View>
      </Animated.View>

      {/* Copy */}
      <Animated.View style={[{ alignItems: 'center' }, copyStyle]}>
        <Text variant="display" align="center" style={{ marginBottom: space.base }}>
          {slide.title}
        </Text>
        <Text
          variant="body"
          tone="secondary"
          align="center"
          style={{ maxWidth: 320, lineHeight: 24 }}
        >
          {slide.body}
        </Text>
      </Animated.View>
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0,
};

/* ── Pager dots ──────────────────────────────────────────────────────────── */

function Dot({ index, scrollX, width }: {
  index: number; scrollX: SharedValue<number>; width: number;
}) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      // Stretch to a pill when active — movement reads faster than colour.
      width:   interpolate(scrollX.value, inputRange, [7, 26, 7], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, inputRange, [0.28, 1, 0.28], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View
      style={[
        { height: 7, borderRadius: radius.full, backgroundColor: color.brand },
        style,
      ]}
    />
  );
}

/* ── Screen ──────────────────────────────────────────────────────────────── */

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);

  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollX.value = e.contentOffset.x; },
  });

  // Derived on the UI thread, mirrored to JS only when the page actually flips.
  const pageIndex = useDerivedValue(() => Math.round(scrollX.value / width));

  const handleMomentumEnd = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }, [width]);

  const isLast = page === SLIDES.length - 1;

  const finish = useCallback(async () => {
    await Storage.set('onboarding_complete', 'true');
    router.replace('/(auth)/sign-in');
  }, [router]);

  const next = useCallback(() => {
    if (isLast) { void finish(); return; }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  }, [isLast, page, width, finish]);

  // Skip fades out on the last slide rather than disappearing abruptly.
  const skipStyle = useAnimatedStyle(() => ({
    opacity: withTiming(pageIndex.value === SLIDES.length - 1 ? 0 : 1, {
      duration: motion.duration.base,
    }),
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1, motion.spring) }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* Ambient wash — keeps the top of the screen from reading as empty */}
      <LinearGradient
        colors={[`${color.brand}0E`, 'transparent']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 320 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Skip */}
        <Animated.View
          style={[
            { alignItems: 'flex-end', paddingHorizontal: gutter, height: 44, justifyContent: 'center' },
            skipStyle,
          ]}
          pointerEvents={isLast ? 'none' : 'auto'}
        >
          <Pressable onPress={finish} haptic="light" hitSlop={12} pressOpacity={0.6}>
            <Text variant="label" tone="tertiary">Skip</Text>
          </Pressable>
        </Animated.View>

        {/* Slides */}
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {SLIDES.map((s, i) => (
            <SlideView key={s.key} slide={s} index={i} scrollX={scrollX} width={width} />
          ))}
        </Animated.ScrollView>

        {/* Footer */}
        <View style={{ paddingHorizontal: gutter, paddingBottom: space.base, gap: space.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}>
            {SLIDES.map((s, i) => (
              <Dot key={s.key} index={i} scrollX={scrollX} width={width} />
            ))}
          </View>

          <Animated.View style={ctaStyle}>
            <Button size="lg" fullWidth onPress={next} haptic="medium">
              {isLast ? 'Get started' : 'Continue'}
            </Button>
          </Animated.View>

          <Pressable
            onPress={() => router.replace('/(public)/catalogue')}
            haptic="light"
            pressOpacity={0.6}
            style={{ alignItems: 'center', paddingVertical: space.xs }}
          >
            <Text variant="callout" tone="tertiary">
              Just browsing?{' '}
              <Text variant="callout" tone="brand" weight="600">View the catalogue</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
