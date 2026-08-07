// Stub — not used by this app (we use plain RN View with @/constants/colors)
import { View, type ViewProps } from 'react-native';
export type ThemedViewProps = ViewProps & { lightColor?: string; darkColor?: string; type?: string };
export function ThemedView({ style, ...rest }: ThemedViewProps) {
  return <View style={style} {...rest} />;
}
