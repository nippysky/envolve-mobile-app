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
import { type } from '@/constants/typography';
import { Icon } from '@/components/ui/Icon';

interface Props {
  title:        string;
  subtitle?:    string;
  back?:        boolean;
  onBack?:      () => void;
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleBack() {
    if (onBack) { onBack(); return; }
    if (router.canGoBack()) router.back();
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === 'android' ? 6 : 0) },
        transparent && styles.transparent,
        style,
      ]}
    >
      <View style={styles.row}>
        {/* Left — back button or spacer */}
        <View style={styles.side}>
          {back && (
            <Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn}>
              <Icon name="back" size={18} color={Colors.ink} />
            </Pressable>
          )}
        </View>

        {/* Centre */}
        <View style={styles.centre}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>

        {/* Right */}
        <View style={[styles.side, styles.sideRight]}>
          {right ?? null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor:   Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
    paddingBottom:     12,
    paddingHorizontal: 16,
  },
  transparent: {
    backgroundColor:   'transparent',
    borderBottomColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    minHeight:     44,
  },
  side:      { width: 44, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  centre:    { flex: 1, alignItems: 'center' },

  title: {
    ...type.h4,
    color: Colors.ink,
  },
  subtitle: {
    ...type.caption,
    color:    Colors.ink3,
    marginTop: 1,
  },

  backBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    backgroundColor: Colors.bgMuted,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
