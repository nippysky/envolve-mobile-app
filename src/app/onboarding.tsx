import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';

const { width: W } = Dimensions.get('window');

interface Slide {
  key:      string;
  emoji:    string;
  title:    string;
  body:     string;
  bg:       string;
}

const SLIDES: Slide[] = [
  {
    key:   's1',
    emoji: '💊',
    title: 'Your pharmacy, delivered',
    body:  'Order prescriptions and OTC medicines from the comfort of your home. Fast, safe, discreet.',
    bg:    '#EEF2FF',
  },
  {
    key:   's2',
    emoji: '⚡',
    title: 'Lightning-fast fulfilment',
    body:  'Real-time order tracking from the moment you tap checkout to when it lands at your door.',
    bg:    '#F0FDFA',
  },
  {
    key:   's3',
    emoji: '🔒',
    title: 'Safe & confidential',
    body:  'Your health data is encrypted and never shared. Compliant with NDPR & global standards.',
    bg:    '#FFF7ED',
  },
  {
    key:   's4',
    emoji: '👥',
    title: 'Built for everyone',
    body:  'Customers, pharmacists, drivers — one powerful app connecting your entire healthcare journey.',
    bg:    '#F5F3FF',
  },
];

export default function Onboarding() {
  const insets   = useSafeAreaInsets();
  const listRef  = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const scrollX  = useSharedValue(0);

  function next() {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      router.replace('/(auth)/sign-in');
    }
  }

  function skip() {
    router.replace('/(auth)/sign-in');
  }

  function onScroll(e: { nativeEvent: { contentOffset: { x: number } } }) {
    scrollX.value = e.nativeEvent.contentOffset.x;
    const page = Math.round(e.nativeEvent.contentOffset.x / W);
    setIndex(page);
  }

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 24 }]}>
      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={s => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        renderItem={({ item, index: i }: ListRenderItemInfo<Slide>) => (
          <SlideView slide={item} slideIndex={i} scrollX={scrollX} />
        )}
        style={styles.list}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <Dot key={i} i={i} scrollX={scrollX} />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={next}
        >
          {isLast ? 'Get Started' : 'Next'}
        </Button>

        {!isLast && (
          <Pressable onPress={skip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}

        {isLast && (
          <Pressable
            onPress={() => router.push('/terms')}
            style={styles.skipBtn}
          >
            <Text style={styles.legalText}>
              By continuing you accept our{' '}
              <Text style={styles.legalLink}>Terms</Text> &{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── SlideView ────────────────────────────────────────────────────────────────

function SlideView({
  slide,
  slideIndex,
  scrollX,
}: {
  slide:      Slide;
  slideIndex: number;
  scrollX:    Animated.SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(slideIndex - 1) * W, slideIndex * W, (slideIndex + 1) * W];
    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <View style={[styles.slide, { width: W, backgroundColor: slide.bg }]}>
      <Animated.View style={[styles.slideInner, animStyle]}>
        <View style={styles.emojiWrap}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
        </View>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideBody}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

// ── Dot ──────────────────────────────────────────────────────────────────────

function Dot({ i, scrollX }: { i: number; scrollX: Animated.SharedValue<number> }) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(i - 1) * W, i * W, (i + 1) * W];
    const width = interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
    return { width, opacity };
  });
  return <Animated.View style={[styles.dot, animStyle]} />;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.white },
  list:    { flex: 1 },

  slide: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  slideInner: {
    alignItems:     'center',
    paddingHorizontal: 40,
    gap:            20,
  },
  emojiWrap: {
    width:          120,
    height:         120,
    borderRadius:   60,
    backgroundColor: Colors.white,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOpacity:  0.08,
    shadowRadius:   16,
    shadowOffset:   { width: 0, height: 4 },
    elevation:      4,
  },
  emoji:      { fontSize: 56 },
  slideTitle: { fontSize: 26, fontWeight: '800', color: Colors.ink, textAlign: 'center', lineHeight: 33 },
  slideBody:  { fontSize: 15, color: Colors.ink3, textAlign: 'center', lineHeight: 23 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginVertical: 28 },
  dot:  { height: 8, borderRadius: 4, backgroundColor: Colors.brand },

  actions:  { paddingHorizontal: 24, gap: 12 },
  skipBtn:  { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 15, color: Colors.ink3, fontWeight: '600' },
  legalText: { fontSize: 12, color: Colors.ink4, textAlign: 'center', lineHeight: 18 },
  legalLink: { color: Colors.brand, fontWeight: '600' },
});
