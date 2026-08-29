/**
 * Auth stack.
 *
 * `slide_from_right` rather than the platform default: the chooser hands off
 * to a sign-in screen mid-animation, and a lateral slide reads as moving
 * *into* that context. A cross-fade or a modal presentation would read as
 * replacing the screen instead.
 *
 * `pending-review` is presented without a gesture — it is a terminal state a
 * customer is sent to after signing up, and swiping back from it would return
 * them to a form they have already submitted.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="customer-login" />
      <Stack.Screen name="staff-login" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="pending-review" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
