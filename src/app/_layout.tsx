import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

export default function RootLayout() {
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
