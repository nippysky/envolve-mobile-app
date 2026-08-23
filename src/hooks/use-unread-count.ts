/**
 * The unread notification count behind the bell badge.
 *
 * One hook rather than a `useQuery` copy-pasted into each home screen, because
 * the three copies had drifted: all of them cached for 30s and none of them
 * polled, so a badge sat at its first value until the screen remounted. A
 * notification that arrives while you're looking at the app should show up
 * without you having to leave and come back.
 *
 * `/api/notifications/unread-count` exists precisely for this — one indexed
 * COUNT against (user_id, is_read), not the full list endpoint.
 *
 * Polling is deliberately slow (60s) and `refetchIntervalInBackground` is left
 * off, so a backgrounded app makes no requests at all. The foreground refetch
 * is what makes it feel live; the interval is just a backstop for someone who
 * leaves the app open.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadCount } from '@/lib/services/account.service';

// Nested under ['notifications'] so marking messages read — which invalidates
// that prefix — refreshes the badge without needing to know this key exists.
const UNREAD_COUNT_KEY = ['notifications', 'unread-count'] as const;

export function useUnreadCount() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn:  getUnreadCount,
    // Signed out there is no one to count for, and the request would 401.
    enabled:  !!user,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    // A badge is ambient. Failing to fetch it should never surface an error
    // state to the user, and retrying hard on a flaky connection is wasteful.
    retry: 1,
  });

  return {
    unread:  query.data?.unread_count ?? 0,
    refetch: query.refetch,
  };
}
