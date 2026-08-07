import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from './Button';

interface Props {
  icon?:        string;    // emoji
  title:        string;
  subtitle?:    string;
  actionLabel?: string;
  onAction?:    () => void;
}

export function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          onPress={onAction}
          style={styles.btn}
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         40,
    gap:             8,
  },
  icon:     { fontSize: 48 },
  title:    { fontSize: 17, fontWeight: '700', color: Colors.ink,  textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.ink3, textAlign: 'center', lineHeight: 20 },
  btn:      { marginTop: 16 },
});
