// Stub — not used by this app (we use plain RN Text with @/constants/colors)
import { Text, type TextProps } from 'react-native';
export type ThemedTextProps = TextProps & { type?: string; themeColor?: string };
export function ThemedText({ style, ...rest }: ThemedTextProps) {
  return <Text style={style} {...rest} />;
}
