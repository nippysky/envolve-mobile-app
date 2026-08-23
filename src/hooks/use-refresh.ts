import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh state that only reflects an actual pull.
 *
 * ## The bug this fixes
 *
 * Wiring `RefreshControl`'s `refreshing` prop straight to react-query's
 * `isRefetching` looks right and is subtly wrong. `isRefetching` is true for
 * *any* refetch, including the automatic one fired when a screen remounts —
 * which happens every time you navigate back to it.
 *
 * So you'd arrive on a screen and the spinner would already be showing, with no
 * gesture behind it. `RefreshControl` on iOS is driven by the scroll gesture:
 * it can't animate out of a state it was never dragged into, so the spinner
 * sits there looking frozen until you pull down and release to give it the
 * gesture it was waiting for.
 *
 * The fix is to stop conflating "data is being refetched" with "the user is
 * pulling to refresh". Only the latter should drive the control.
 *
 * ## Usage
 *
 * ```ts
 * const { refreshing, onRefresh } = useRefresh(ordersQ.refetch, unreadQ.refetch);
 * // …
 * <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 * ```
 *
 * Background refetches still happen and still update the list — they just do it
 * quietly, which is the point of a background refetch.
 */
export function useRefresh(
  ...refetchers: (() => Promise<unknown>)[]
): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);

  // Held in a ref so `onRefresh` keeps a stable identity. A refetch function
  // from react-query is a new closure on most renders, and a handler that
  // changed every render would make `RefreshControl` remount mid-gesture.
  //
  // The assignment lives in an effect rather than in the render body. Writing
  // to a ref during render is what `react-hooks/refs` forbids, and the reason
  // is real: with concurrent rendering a render can be thrown away, so a
  // render-phase write can persist from work that was never committed. An
  // effect only runs on committed renders. Nothing reads this ref during
  // render — `onRefresh` fires from a gesture — so a one-commit lag is
  // invisible here.
  const latest = useRef(refetchers);
  useEffect(() => { latest.current = refetchers; });

  // Guards against a second pull landing while the first is still in flight,
  // which would clear `refreshing` early and strand the spinner again.
  const inFlight = useRef(false);

  const onRefresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);

    void (async () => {
      try {
        // `allSettled`, not `all`: one failing request must not leave the
        // spinner up forever. Errors surface through each query's own error
        // state, which is where a screen already handles them.
        await Promise.allSettled(latest.current.map(fn => fn()));
      } finally {
        inFlight.current = false;
        setRefreshing(false);
      }
    })();
  }, []);

  return { refreshing, onRefresh };
}
