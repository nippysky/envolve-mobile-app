import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { humanise } from '@/lib/format';

interface Props {
  status: string;
  type?:  'order' | 'payment' | 'delivery' | 'custom';
  bg?:    string;
  text?:  string;
  dot?:   string;
}

export function StatusBadge({ status, type = 'order', bg, text, dot }: Props) {
  const key = status.toLowerCase();

  let palette: { bg: string; text: string; dot: string };

  if (bg && text && dot) {
    palette = { bg, text, dot };
  } else if (type === 'payment') {
    palette = Colors.paymentStatus[key] ?? { bg: Colors.bgMuted, text: Colors.ink3, dot: Colors.ink4 };
  } else if (type === 'delivery') {
    palette = Colors.deliveryStatus[key] ?? { bg: Colors.bgMuted, text: Colors.ink3, dot: Colors.ink4 };
  } else {
    palette = Colors.orderStatus[key] ?? { bg: Colors.bgMuted, text: Colors.ink3, dot: Colors.ink4 };
  }

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <View style={[styles.dot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.label, { color: palette.text }]}>
        {humanise(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:   20,
    alignSelf:      'flex-start',
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  label: {
    fontSize:   11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
