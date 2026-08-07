/**
 * Onboarding — premium illustrated carousel.
 *
 * Each slide is a full-bleed gradient with geometric illustration,
 * clean brand typography, and reanimated scroll transitions.
 * No emojis — all visuals built from styled Views + LinearGradient.
 */

import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';

const { width: W, height: H } = Dimensions.get('window');

// ── Slide data ────────────────────────────────────────────────────────────────

interface Slide {
  key:      string;
  gradient: readonly [string, string, ...string[]];
  title:    string;
  body:     string;
  Illustration: React.FC;
}

function PillIllustration() {
  return (
    <View style={ill.root}>
      {/* Background glow rings */}
      <View style={[ill.ring, { width: 220, height: 220, opacity: 0.12 }]} />
      <View style={[ill.ring, { width: 160, height: 160, opacity: 0.18 }]} />

      {/* Main pill body */}
      <View style={ill.pillWrap}>
        <LinearGradient
          colors={['#ffffff', 'rgba(255,255,255,0.7)']}
          style={ill.pillLeft}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.15)']}
          style={ill.pillRight}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
      </View>

      {/* Decorative dots */}
      <View style={[ill.dot, { top: 24, right: 52, width: 14, height: 14, opacity: 0.6 }]} />
      <View style={[ill.dot, { bottom: 28, left: 44, width: 10, height: 10, opacity: 0.4 }]} />
      <View style={[ill.dot, { top: 60, left: 32, width: 8,  height: 8,  opacity: 0.3 }]} />

      {/* Cross / plus icon (pharmacy) */}
      <View style={ill.crossV} />
      <View style={ill.crossH} />
    </View>
  );
}

function TrackingIllustration() {
  return (
    <View style={ill.root}>
      <View style={[ill.ring, { width: 200, height: 200, opacity: 0.12 }]} />

      {/* Route line */}
      <View style={ill.routeLine} />

      {/* Stop dots */}
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={[ill.routeStop, {
            bottom: 60 + i * 36,
            left:   '50%' as any,
            marginLeft: -8,
            opacity: i === 2 ? 1 : 0.55,
            width:  i === 2 ? 22 : 16,
            height: i === 2 ? 22 : 16,
            borderRadius: i === 2 ? 11 : 8,
          }]}
        />
      ))}

      {/* Pin at top */}
      <View style={ill.pinCircle} />
      <View style={ill.pinTail} />

      {/* Package box */}
      <View style={ill.box}>
        <View style={ill.boxLid} />
      </View>
    </View>
  );
}

function ShieldIllustration() {
  return (
    <View style={ill.root}>
      <View style={[ill.ring, { width: 210, height: 210, opacity: 0.12 }]} />

      {/* Shield body */}
      <View style={ill.shield}>
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.6)']}
          style={ill.shieldFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        {/* Tick mark */}
        <View style={ill.tickH} />
        <View style={ill.tickV} />
      </View>

      {/* Lock dot */}
      <View style={[ill.dot, { width: 18, height: 18, top: 20, right: 48, opacity: 0.7 }]} />
      <View style={[ill.dot, { width: 10, height: 10, bottom: 32, left: 40, opacity: 0.4 }]} />
    </View>
  );
}

function NetworkIllustration() {
  const nodes = [
    { top: 28,  left: '50%' as any, ml: -22, size: 44, label: '🧑‍💼' },
    { top: 90,  left: 32,           ml: 0,   size: 38, label: '💊'  },
    { top: 90,  right: 32,          ml: 0,   size: 38, label: '🚚'  },
    { top: 148, left: '50%' as any, ml: -19, size: 38, label: '👤'  },
  ];

  return (
    <View style={ill.root}>
      <View style={[ill.ring, { width: 210, height: 210, opacity: 0.1 }]} />

      {/* Connection lines */}
      <View style={[ill.netLine, { top: 52,  left: 100, width: 70, transform: [{ rotate: '30deg' }] }]} />
      <View style={[ill.netLine, { top: 52,  right: 96, width: 70, transform: [{ rotate: '-30deg' }] }]} />
      <View style={[ill.netLine, { top: 116, left: 68,  width: 80, transform: [{ rotate: '-20deg' }] }]} />
      <View style={[ill.netLine, { top: 116, right: 62, width: 80, transform: [{ rotate: '20deg' }] }]} />

      {/* Nodes */}
      {nodes.map((n, i) => (
        <View
          key={i}
          style={[ill.netNode, {
            top:    n.top,
            left:   (n as any).left,
            right:  (n as any).right,
            marginLeft: n.ml,
            width:  n.size,
            height: n.size,
            borderRadius: n.size / 2,
          }]}
        >
          <Text style={{ fontSize: n.size * 0.45 }}>{n.label}</Text>
        </View>
      ))}
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    key:          's1',
    gradient:     ['#0091ba', '#00a6d4', '#00c4f0'],
    title:        "Nigeria's pharmacy,\nat your door",
    body:         'Order prescription and OTC medicines from licensed Envolve pharmacies. Fast, safe, fully compliant.',
    Illustration: PillIllustration,
  },
  {
    key:          's2',
    gradient:     ['#0d6e3d', '#16a34a', '#22c55e'],
    title:        'Real-time\norder tracking',
    body:         'From dispensing to doorstep — track every stage of your order live, with instant push updates.',
    Illustration: TrackingIllustration,
  },
  {
    key:          's3',
    gradient:     ['#b45309', '#d97706', '#f59e0b'],
    title:        'Safe, private\n& compliant',
    body:         'Your health data is encrypted end-to-end and handled in strict compliance with NDPR and NAFDAC.',
    Illustration: ShieldIllustration,
  },
  {
    key:          's4',
    gradient:     ['#0c1418', '#1e2d35', '#2a3f4a'],
    title:        'Built for\neveryone in the chain',
    body:         'Customers, pharmacists, admins, drivers — one powerful platform connecting your entire medicine supply journey.',
    Illustration: NetworkIllustration,
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const insets  = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);

  function next() {
    if (index < SLIDES.length - 1) {
      const n = index + 1;
      listRef.current?.scrollToIndex({ index: n, animated: true });
      setIndex(n);
    } else {
      router.replace('/(auth)/sign-in');
    }
  }

  function skip() { router.replace('/(auth)/sign-in'); }

  function onScroll(e: { nativeEvent: { contentOffset: { x: number } } }) {
    scrollX.value = e.nativeEvent.contentOffset.x;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));
  }

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.root}>
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
        style={{ flex: 1 }}
      />

      {/* Bottom panel */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
        {/* Logo */}
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} i={i} scrollX={scrollX} />
          ))}
        </View>

        {/* CTA */}
        <Button variant="primary" size="lg" fullWidth onPress={next}>
          {isLast ? 'Get Started' : 'Continue'}
        </Button>

        {!isLast ? (
          <Pressable onPress={skip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <Text style={styles.legalText}>
            By continuing you accept our{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/terms')}>Terms</Text>
            {' '}&{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/privacy')}>Privacy Policy</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

// ── SlideView ─────────────────────────────────────────────────────────────────

function SlideView({
  slide,
  slideIndex,
  scrollX,
}: {
  slide:      Slide;
  slideIndex: number;
  scrollX:    SharedValue<number>;
}) {
  const range = [(slideIndex - 1) * W, slideIndex * W, (slideIndex + 1) * W];

  const illStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(scrollX.value, range, [0.8, 1, 0.8], Extrapolation.CLAMP),
    }],
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(scrollX.value, range, [20, 0, 20], Extrapolation.CLAMP),
    }],
  }));

  return (
    <LinearGradient
      colors={slide.gradient}
      style={{ width: W, flex: 1 }}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      {/* Illustration */}
      <Animated.View style={[styles.illustration, illStyle]}>
        <slide.Illustration />
      </Animated.View>

      {/* Text */}
      <Animated.View style={[styles.slideText, textStyle]}>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideBody}>{slide.body}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

// ── Dot ───────────────────────────────────────────────────────────────────────

function Dot({ i, scrollX }: { i: number; scrollX: SharedValue<number> }) {
  const range = [(i - 1) * W, i * W, (i + 1) * W];
  const style = useAnimatedStyle(() => ({
    width:   interpolate(scrollX.value, range, [6, 22, 6], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, range, [0.35, 1, 0.35], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

// ── Illustration primitives ───────────────────────────────────────────────────

const ill = StyleSheet.create({
  root: {
    width:          220,
    height:         220,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ring: {
    position:        'absolute',
    borderRadius:    999,
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.4)',
    alignSelf:       'center',
  },
  dot: {
    position:      'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius:  999,
  },

  // Pill
  pillWrap: {
    flexDirection: 'row',
    width:         140,
    height:        60,
    borderRadius:  30,
    overflow:      'hidden',
    shadowColor:   '#000',
    shadowOpacity: 0.25,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 8 },
    elevation:     10,
  },
  pillLeft: {
    flex:               1,
    borderRightWidth:   1.5,
    borderRightColor:   'rgba(0,0,0,0.12)',
  },
  pillRight: { flex: 1 },
  crossV: {
    position:        'absolute',
    width:            4,
    height:          28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius:     2,
  },
  crossH: {
    position:        'absolute',
    width:           28,
    height:           4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius:    2,
  },

  // Tracking
  routeLine: {
    position:        'absolute',
    width:            3,
    height:          120,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius:    2,
    bottom:          50,
    left:            '50%' as any,
    marginLeft:      -1.5,
  },
  routeStop: {
    position:        'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  pinCircle: {
    position:        'absolute',
    top:             22,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor:     '#000',
    shadowOpacity:   0.2,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       6,
  },
  pinTail: {
    position:        'absolute',
    top:             46,
    width:            4,
    height:          14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius:    2,
  },
  box: {
    position:        'absolute',
    bottom:          32,
    width:           44,
    height:          38,
    borderRadius:     8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       5,
  },
  boxLid: {
    position:        'absolute',
    top:             -7,
    left:            4,
    right:           4,
    height:          10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius:    3,
  },

  // Shield
  shield: {
    width:          100,
    height:         116,
    borderRadius:   16,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    overflow:       'hidden',
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOpacity:  0.22,
    shadowRadius:   18,
    shadowOffset:   { width: 0, height: 6 },
    elevation:      8,
  },
  shieldFill: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
  },
  tickV: {
    position:        'absolute',
    width:            4,
    height:          28,
    backgroundColor: '#16a34a',
    borderRadius:    2,
    left:            42,
    top:             42,
    transform:       [{ rotate: '45deg' }],
  },
  tickH: {
    position:        'absolute',
    width:            4,
    height:          16,
    backgroundColor: '#16a34a',
    borderRadius:    2,
    left:            30,
    top:             50,
    transform:       [{ rotate: '-45deg' }],
  },

  // Network
  netNode: {
    position:        'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 3 },
    elevation:       4,
  },
  netLine: {
    position:        'absolute',
    height:           2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius:    1,
  },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  illustration: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     60,
  },

  slideText: {
    paddingHorizontal: 32,
    paddingBottom:     40,
  },
  slideTitle: {
    fontSize:     30,
    fontWeight:   '800',
    color:        '#ffffff',
    lineHeight:   38,
    letterSpacing: -0.5,
    marginBottom:  12,
  },
  slideBody: {
    fontSize:   15,
    color:      'rgba(255,255,255,0.78)',
    lineHeight: 23,
  },

  panel: {
    backgroundColor:   Colors.white,
    paddingHorizontal: 28,
    paddingTop:        28,
    gap:               16,
  },

  logo: {
    width:      160,
    height:     58,
    alignSelf:  'center',
    marginBottom: 4,
  },

  dots: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:             6,
  },
  dot: {
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.brand,
  },

  skipBtn:  { alignItems: 'center', paddingVertical: 4 },
  skipText: { fontSize: 15, color: Colors.ink3, fontWeight: '500' },
  legalText: {
    fontSize:   12,
    color:      Colors.ink4,
    textAlign:  'center',
    lineHeight: 18,
  },
  legalLink: { color: Colors.brand, fontWeight: '600' },
});
