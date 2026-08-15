import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { AuthProvider } from '@/contexts/AuthContext';
import { BasketProvider } from '@/hooks/use-basket';
import { ToastHost } from '@/components/ui';

// Hold splash until we signal ready
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:                2,
      staleTime:            30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * React Query's "window focus" concept has no meaning in React Native until
 * it's told what focus is. Without this the global `refetchOnWindowFocus`
 * setting is inert, so anything a query opted into — the unread badge, most
 * obviously — went stale the moment the app was backgrounded and stayed stale
 * until the screen remounted.
 */
function useAppStateFocus() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useAppStateFocus();

  // Hide splash on first render — app is ready
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Basket sits inside AuthProvider — it reads the session to know
                whether to fetch a cart at all. */}
            <BasketProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="terms"    options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="privacy"  options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="(auth)"   />
              <Stack.Screen name="(public)" />
              <Stack.Screen name="(customer)" />
              <Stack.Screen name="(staff)"  />
              <Stack.Screen name="(driver)" />
            </Stack>
            </BasketProvider>
          </AuthProvider>
        </QueryClientProvider>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
