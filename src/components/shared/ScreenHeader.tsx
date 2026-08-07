import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

interface Props {
  title:        string;
  subtitle?:    string;
  back?:        boolean;       // show back arrow
  onBack?:      () => void;    // override default router.back()
  right?:       React.ReactNode;
  style?:       ViewStyle;
  transparent?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  back = false,
  onBack,
  right,
  style,
  transparent = false,
}: Props) {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  function handleBack() {
    if (onBack) { onBack(); return; }
    if (router.canGoBack()) router.back();
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0) },
        transparent && styles.transparent,
        style,
      ]}
    >
      <View style={styles.row}>
        {/* Left — back button or spacer */}
        <View style={styles.side}>
          {back && (
            <Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn}>
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>
          )}
        </View>

        {/* Centre — title */}
        <View style={styles.centre}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>

        {/* Right — actions */}
        <View style={[styles.side, styles.sideRight]}>
          {right ?? null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    minHeight:      44,
  },
  side:      { width: 44, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },

  centre: { flex: 1, alignItems: 'center' },

  title: {
    fontSize:   17,
    fontWeight: '700',
    color:      Colors.ink,
  },
  subtitle: {
    fontSize: 12,
    color:    Colors.ink3,
    marginTop: 1,
  },

  backBtn: {
    width:  36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgMuted,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontSize:   26,
    lineHeight: 30,
    color:      Colors.ink,
    marginLeft: -2,
  },
});
