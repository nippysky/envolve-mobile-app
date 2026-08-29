/**
 * Contact details the app shows its users, read from the server.
 *
 * The dispatch number and support address used to be constants compiled into
 * the bundle, in four separate files. Changing a phone number meant an app
 * release — so they live in Admin → Settings now and the app reads them here.
 *
 * The defaults below are exactly the values that were previously hardcoded, so
 * a failed request or an empty settings table renders what it always did
 * rather than a blank row. That matters more than freshness here: a driver
 * opening this screen with no signal still needs a number to call.
 *
 * Cached for an hour — these change about once a year, and every screen that
 * uses them shares the one query.
 */

import { useQuery } from '@tanstack/react-query';
import { getAppSettings, APP_SETTINGS_FALLBACK } from '@/lib/services/account.service';

export function useAppSettings() {
  const { data } = useQuery({
    queryKey: ['settings', 'app'],
    queryFn:  getAppSettings,
    staleTime: 60 * 60_000,
    retry: 1,
  });

  return data ?? APP_SETTINGS_FALLBACK;
}
