import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="catalogue/index" />
      <Stack.Screen name="catalogue/[sku]" />
    </Stack>
  );
}
