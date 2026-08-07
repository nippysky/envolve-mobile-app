import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from './Button';

interface Props {
  iconName?:    IconName;
  icon?:        string;      // legacy emoji fallback
  title:        string;
  subtitle?:    string;
  actionLabel?: string;
  onAction?:    () => void;
}

export function EmptyState({
  iconName = 'clipboard',
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.iconWrap}>
        <Icon name={iconName} size={36} color={Colors.ink4} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onPress={onAction} style={styles.btn}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        40,
    gap:            10,
  },
  iconWrap: {
    width:           72,
    height:          72,
    borderRadius:    20,
    backgroundColor: Colors.bgMuted,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  title:    { ...type.h3, color: Colors.ink,  textAlign: 'center' },
  subtitle: { ...type.bodySm, color: Colors.ink3, textAlign: 'center', lineHeight: 20 },
  btn:      { marginTop: 12 },
});
