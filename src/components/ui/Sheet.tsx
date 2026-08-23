/**
 * Bottom sheet.
 *
 * The problem this solves: a form that lays every option out inline reads as a
 * wall. Four payment methods as stacked cards is 300pt of scroll for a choice
 * the user makes once. Collapsing that to a single row — current value plus a
 * chevron — and moving the options into a sheet turns the form into a summary
 * you can take in at a glance.
 *
 * Three details do most of the work:
 *
 *   1. The sheet animates out before it unmounts. React Native's `Modal` tears
 *      its children down the instant `visible` flips, so an exit animation on
 *      the content is never seen. `mounted` is therefore local state that
 *      outlives `visible` by exactly one animation.
 *
 *   2. Drag-to-dismiss tracks the finger 1:1 downward but rubber-bands upward.
 *      A sheet that can be flung up off its detent feels broken.
 *
 *   3. Dismissal commits on velocity OR distance, not distance alone. A quick
 *      flick that only travels 40pt is unambiguously a dismiss, and requiring
 *      the full threshold makes the sheet feel sticky.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, View, Dimensions, Platform, KeyboardAvoidingView,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming } from 'react-native-reanimated';

import { Text } from './Text';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { color, space, radius, gutter, layout, motion, elevation } from '@/constants/theme';

const SCREEN_H = Dimensions.get('window').height;

/** Past this many points, or this much downward velocity, release dismisses. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /**
   * `auto` hugs the content — right for a short list of options.
   * `tall` pins to 88% of the screen — right for anything scrollable or
   * search-driven, where a sheet that resizes as results arrive is jarring.
   */
  detent?: 'auto' | 'tall';
  /** Pinned below the scrollable body — action buttons, totals. */
  footer?: React.ReactNode;
  /** Hide the × when dismissal must go through an explicit action. */
  dismissible?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  detent = 'auto',
  footer,
  dismissible = true,
  contentStyle,
  children }: SheetProps) {
  const insets = useSafeAreaInsets();

  // Outlives `visible` for the length of the exit animation — see (1) above.
  const [mounted, setMounted] = useState(visible);

  const progress = useSharedValue(0);   // 0 = offscreen, 1 = seated
  const dragY    = useSharedValue(0);

  // Mount first, animate second.
  //
  // Doing both at once started the timing animation on a frame where the sheet
  // was still returning `null`, so on a slower device (or with a heavy list
  // inside) it could finish mounting halfway through its own entrance and
  // appear to jump into place. The animation now begins on the first frame the
  // sheet actually exists.
  //
  // The mount flag is raised during render rather than in an effect — React's
  // "adjusting state when a prop changes" pattern. An effect would cost an
  // extra committed frame before the sheet exists, which is precisely the
  // delay causing the jump.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }

  useEffect(() => {
    if (visible && mounted) {
      dragY.value = 0;
      progress.value = withTiming(1, {
        duration: motion.duration.base,
        easing: Easing.bezier(...motion.easing),
      });
    } else if (!visible && mounted) {
      progress.value = withTiming(
        0,
        { duration: motion.duration.fast, easing: Easing.bezier(...motion.easing) },
        // `finished` is false when a new animation interrupts this one, which
        // is what stops a fast close→open from unmounting the reopened sheet.
        finished => { if (finished) runOnJS(setMounted)(false); },
      );
    }
  }, [visible, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => { onClose(); }, [onClose]);

  const pan = Gesture.Pan()
    .onUpdate(e => {
      // Downward tracks the finger; upward rubber-bands to a third — see (2).
      dragY.value = e.translationY > 0 ? e.translationY : e.translationY / 3;
    })
    .onEnd(e => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(close)();
      } else {
        dragY.value = withTiming(0, { duration: motion.duration.fast });
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * SCREEN_H + dragY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      {/* Keyboard avoidance is not optional here: several sheets are forms with
          a submit button pinned to the bottom (receiving stock, editing a
          batch). Without this the keyboard covers both the lower fields and the
          button, and there is no way to scroll past it — the footer sits
          outside the scrollable body by design.

          `padding` shrinks this container by the keyboard height; the sheet is
          bottom-anchored, so it rides up. Android's windowSoftInputMode already
          resizes the window, and adding padding on top of that double-counts. */}
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Scrim. Tapping it dismisses, which is the gesture people reach for
            before they find the × or the drag. */}
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
            scrimStyle,
          ]}
        >
          <Pressable
            haptic="none"
            pressScale={1}
            onPress={dismissible ? close : undefined}
            disabled={!dismissible}
            accessibilityLabel="Dismiss"
            style={{ flex: 1 }}
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              {
                backgroundColor: color.surface,
                borderTopLeftRadius:  radius['3xl'],
                borderTopRightRadius: radius['3xl'],
                paddingBottom: Math.max(insets.bottom, space.base),
                maxHeight: SCREEN_H * 0.88,
                // `flex: 1`, not a fixed height. A fixed 88% can't shrink when
                // the keyboard takes half the screen, so the top of a tall
                // sheet would run off-screen. Flex fills what's available and
                // the maxHeight still caps it at 88% when the keyboard is down.
                ...(detent === 'tall' ? { flex: 1 } : null),
                ...elevation.xl,
              },
              sheetStyle,
            ]}
          >
            {/* Grabber. Its only job is to advertise that the sheet is
                draggable — but the whole sheet responds, not just this. */}
            <View style={{ alignItems: 'center', paddingTop: space.md, paddingBottom: space.xs }}>
              <View style={{
                width: 40, height: 4, borderRadius: radius.full,
                backgroundColor: color.borderStrong,
              }} />
            </View>

            {title ? (
              <View style={{
                flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
                paddingHorizontal: gutter,
                paddingTop: space.sm,
                paddingBottom: space.base,
                borderBottomWidth: layout.hairlineWidth,
                borderBottomColor: color.borderSubtle,
              }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title3">{title}</Text>
                  {subtitle ? <Text variant="caption" tone="tertiary">{subtitle}</Text> : null}
                </View>

                {dismissible ? (
                  <Pressable
                    onPress={close}
                    haptic="light"
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={{
                      width: 30, height: 30, borderRadius: radius.full,
                      backgroundColor: color.surfaceMuted,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name="close" size={14} color={color.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* A tall sheet's body must *fill* the remaining space, or the
                FlatList inside it has no bounded height to scroll within.
                An auto sheet hugs its content instead, and only shrinks if it
                would otherwise overflow the 88% cap. */}
            <View style={[detent === 'tall' ? { flex: 1 } : { flexShrink: 1 }, contentStyle]}>
              {children}
            </View>

            {footer ? (
              <View style={{
                paddingHorizontal: gutter,
                paddingTop: space.md,
                borderTopWidth: layout.hairlineWidth,
                borderTopColor: color.borderSubtle,
              }}>
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SheetOption — one row inside a choice sheet
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SheetOptionProps {
  label: string;
  hint?: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Trailing text — a price, a count. Replaced by the tick when selected. */
  trailing?: string;
  last?: boolean;
}

export function SheetOption({
  label, hint, icon, selected = false, disabled = false, onPress, trailing, last = false }: SheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      pressOpacity={0.6}
      pressScale={1}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: gutter,
        paddingVertical: space.md,
        minHeight: layout.tapTarget + 8,
        borderBottomWidth: last ? 0 : layout.hairlineWidth,
        borderBottomColor: color.borderSubtle,
      }}
    >
      {icon ? (
        <View style={{
          width: 36, height: 36, borderRadius: radius.full,
          backgroundColor: selected ? color.brand : color.surfaceMuted,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon
            name={icon}
            size={16}
            color={selected ? '#fff' : color.textTertiary}
            filled={selected}
          />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{label}</Text>
        {hint ? <Text variant="caption" tone="tertiary" numberOfLines={2}>{hint}</Text> : null}
      </View>

      {trailing && !selected ? (
        <Text variant="caption" tone="tertiary">{trailing}</Text>
      ) : null}

      <View style={{
        width: 22, height: 22, borderRadius: radius.full,
        borderWidth: selected ? 0 : 1.5,
        borderColor: color.borderStrong,
        backgroundColor: selected ? color.brand : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {selected ? <Icon name="check" size={12} color="#fff" /> : null}
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SelectField — the collapsed row that opens a sheet
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SelectFieldProps {
  label?: string;
  /** The chosen value. When absent, `placeholder` shows in a muted tone. */
  value?: string;
  placeholder?: string;
  /** Second line under the value — an address, an email, a hint. */
  caption?: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Replaces the chevron — e.g. a "Change" affordance once a value is set. */
  action?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SelectField({
  label, value, placeholder = 'Choose…', caption, icon, error, hint,
  required = false, disabled = false, onPress, action, containerStyle }: SelectFieldProps) {
  const empty = !value;

  return (
    <View style={containerStyle}>
      {label ? (
        <View style={{ flexDirection: 'row', gap: 3, marginBottom: space.sm }}>
          <Text variant="label" tone="secondary">{label}</Text>
          {required ? <Text variant="label" tone="danger">*</Text> : null}
        </View>
      ) : null}

      <Pressable
        onPress={onPress}
        disabled={disabled}
        haptic="light"
        pressScale={0.985}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Select'}: ${value ?? placeholder}`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space.md,
          paddingHorizontal: space.base,
          paddingVertical: space.md,
          minHeight: 56,
          borderRadius: radius.lg,
          backgroundColor: color.surface,
          borderWidth: error ? 1.5 : layout.hairlineWidth,
          borderColor: error ? color.danger : color.border,
        }}
      >
        {icon ? (
          <View style={{
            width: 38, height: 38, borderRadius: radius.full,
            backgroundColor: empty ? color.surfaceMuted : color.brandSoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon
              name={icon}
              size={17}
              color={empty ? color.textDisabled : color.brand}
              filled={!empty}
            />
          </View>
        ) : null}

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant={empty ? 'body' : 'bodyMedium'}
            tone={empty ? 'disabled' : 'default'}
            numberOfLines={1}
          >
            {value ?? placeholder}
          </Text>
          {caption ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>{caption}</Text>
          ) : null}
        </View>

        {action ?? <Icon name="chevron-right" size={16} color={color.textDisabled} />}
      </Pressable>

      {error ? (
        <Text
          variant="caption"
          tone="danger"
          style={{ marginTop: space.xs }}
          accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: space.xs }}>{hint}</Text>
      ) : null}
    </View>
  );
}
