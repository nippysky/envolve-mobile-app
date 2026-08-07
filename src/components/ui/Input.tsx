import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';

interface Props extends TextInputProps {
  label?:       string;
  error?:       string;
  hint?:        string;
  leftIcon?:    React.ReactNode;
  rightIcon?:   React.ReactNode;
  onRightPress?: () => void;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightPress,
  style,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.row,
          focused && styles.rowFocused,
          !!error && styles.rowError,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          {...rest}
          style={[styles.input, !!leftIcon && styles.inputWithLeft, style]}
          placeholderTextColor={Colors.ink4}
          onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={e  => { setFocused(false); rest.onBlur?.(e); }}
        />

        {rightIcon && (
          <Pressable style={styles.iconRight} onPress={onRightPress} hitSlop={10}>
            {rightIcon}
          </Pressable>
        )}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },

  label: {
    ...type.label,
    color:        Colors.ink2,
    marginBottom: 6,
  },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderWidth:     1.5,
    borderColor:     Colors.line,
    borderRadius:    14,
    overflow:        'hidden',
  },
  rowFocused: { borderColor: Colors.brand },
  rowError:   { borderColor: Colors.danger },

  input: {
    flex:              1,
    paddingHorizontal: 14,
    paddingVertical:   14,
    ...type.body,
    color:             Colors.ink,
  },
  inputWithLeft: { paddingLeft: 8 },

  iconLeft: {
    paddingLeft:  14,
    paddingRight: 4,
    justifyContent: 'center',
    alignItems:     'center',
  },
  iconRight: {
    paddingHorizontal: 14,
    justifyContent:    'center',
    alignItems:        'center',
  },

  error: { ...type.caption, marginTop: 5, color: Colors.danger },
  hint:  { ...type.caption, marginTop: 5, color: Colors.ink4   },
});
