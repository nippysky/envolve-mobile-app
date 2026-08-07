import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, isLoading: loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  if (!user) return <Redirect href="/onboarding" />;

  const role = user.role?.toUpperCase();
  if (role === 'CUSTOMER')                           return <Redirect href="/(customer)/catalog" />;
  if (role === 'DRIVER')                             return <Redirect href="/(driver)/deliveries" />;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN')    return <Redirect href="/(staff)/overview" />;
  if (role === 'STAFF')                              return <Redirect href="/(staff)/overview" />;

  // Fallback — invalid role, clear and go to sign-in
  return <Redirect href="/(auth)/sign-in" />;
}
