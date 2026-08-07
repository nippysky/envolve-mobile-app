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
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}

        <TextInput
          {...rest}
          style={[styles.input, leftIcon && styles.inputWithLeft, style]}
          placeholderTextColor={Colors.ink4}
          onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={e  => { setFocused(false); rest.onBlur?.(e); }}
        />

        {rightIcon && (
          <Pressable style={styles.icon} onPress={onRightPress} hitSlop={8}>
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
    fontSize:     13,
    fontWeight:   '600',
    color:        Colors.ink2,
    marginBottom: 6,
  },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderWidth:     1.5,
    borderColor:     Colors.line,
    borderRadius:    12,
    overflow:        'hidden',
  },
  rowFocused: { borderColor: Colors.brand },
  rowError:   { borderColor: Colors.danger },

  input: {
    flex:            1,
    paddingHorizontal: 14,
    paddingVertical:   13,
    fontSize:        15,
    color:           Colors.ink,
  },
  inputWithLeft: { paddingLeft: 8 },

  icon: {
    paddingHorizontal: 12,
    justifyContent:    'center',
    alignItems:        'center',
  },

  error: { marginTop: 5, fontSize: 12, color: Colors.danger },
  hint:  { marginTop: 5, fontSize: 12, color: Colors.ink4   },
});
