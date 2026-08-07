import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="customer-login" />
      <Stack.Screen name="staff-login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
