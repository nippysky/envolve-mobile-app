import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useAuth, isAppBlockedRole } from '@/contexts/AuthContext';

export default function Index() {
  const { user, isLoading: loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  if (!user) return <Redirect href="/onboarding" />;

  const role = user.role?.toUpperCase();

  // Admins belong on the web console. AuthContext clears their stored session
  // on restore, so reaching here means something unexpected — send them to
  // sign-in rather than into a console stripped of everything they came for.
  if (isAppBlockedRole(role))  return <Redirect href="/(auth)/sign-in" />;

  if (role === 'CUSTOMER')     return <Redirect href="/(customer)/catalog" />;
  if (role === 'DRIVER')       return <Redirect href="/(driver)/deliveries" />;
  if (role === 'STAFF')        return <Redirect href="/(staff)/overview" />;

  // Fallback — invalid role, clear and go to sign-in
  return <Redirect href="/(auth)/sign-in" />;
}
