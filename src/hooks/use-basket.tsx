/**
 * Basket.
 *
 * Server-backed, not local state. The cart lives in the database so it follows
 * the customer between web and mobile — which is the whole point of the two
 * products sharing an API. Consumes the existing routes:
 *
 *   GET    /api/cart                 → { cart: { items, subtotal, item_count } }
 *   POST   /api/cart/items           { product_id, quantity }  → { cart_id, item_count, subtotal }
 *   PATCH  /api/cart/items/:itemId   { quantity }              → { item_id, quantity }
 *   DELETE /api/cart/items/:itemId                             → { removed: true }
 *   DELETE /api/cart                 (clear)                   → { cleared: true }
 *
 * Note the asymmetry above: only GET returns the full cart. The mutation
 * routes return acknowledgements, so each mutation applies an optimistic local
 * change, fires the request, then re-reads the cart to reconcile. Treating a
 * mutation response as a cart would blank the basket on every tap.
 *
 * Rollback snapshots are read from a ref that mirrors state rather than from a
 * dependency, which keeps the mutation callbacks stable across renders — a
 * quantity stepper shouldn't re-create its handlers every time the number
 * beside it changes.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

export interface BasketItem {
  id:            number;
  product_id:    number;
  quantity:      number;
  unit_price:    number;
  subtotal:      number;
  brand_name:    string;
  generic_name:  string | null;
  sku:           string;
  pack_size:     string | null;
  primary_image: string | null;
  in_stock:      boolean;
}

interface CartResponse {
  cart: {
    id?:        number;
    uuid?:      string;
    items:      BasketItem[];
    subtotal:   number;
    item_count: number;
  };
}

interface BasketState {
  items:    BasketItem[];
  subtotal: number;
  count:    number;
}

const EMPTY: BasketState = { items: [], subtotal: 0, count: 0 };

interface BasketValue extends BasketState {
  isLoading: boolean;
  /** True while a mutation is in flight — drives disabled states on steppers. */
  isMutating: boolean;
  refresh:   () => Promise<void>;
  add:       (productId: number, quantity?: number) => Promise<void>;
  setQty:    (itemId: number, quantity: number) => Promise<void>;
  remove:    (itemId: number) => Promise<void>;
  clear:     () => Promise<void>;
  /** Quantity of a product already in the basket, 0 if absent. */
  quantityOf: (productId: number) => number;
}

const BasketContext = createContext<BasketValue | null>(null);

/** Recompute totals from line items so optimistic state stays self-consistent. */
function totals(items: BasketItem[]): BasketState {
  return {
    items,
    subtotal: items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    count:    items.reduce((s, i) => s + i.quantity, 0),
  };
}

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [state,      setState]     = useState<BasketState>(EMPTY);
  const [isLoading,  setLoading]   = useState(false);
  const [isMutating, setMutating]  = useState(false);

  const isCustomer = user?.role === 'CUSTOMER';

  // Guards against a slow cart read landing after sign-out and repopulating a
  // basket that should be empty.
  const requestId = useRef(0);

  // Mirrors `state` so mutation callbacks can snapshot the pre-change basket
  // for rollback without taking `state` as a dependency (which would give them
  // a new identity on every quantity tap) and without doing it inside a state
  // updater (which must stay pure — React may invoke it twice in development).
  const latest = useRef<BasketState>(EMPTY);

  const commit = useCallback((next: BasketState) => {
    latest.current = next;
    setState(next);
  }, []);

  const read = useCallback(async () => {
    const id = ++requestId.current;
    const res = await apiFetch<CartResponse>('/api/cart');
    if (id !== requestId.current) return;
    commit({
      items:    res.cart.items ?? [],
      subtotal: res.cart.subtotal ?? 0,
      count:    res.cart.item_count ?? 0,
    });
  }, [commit]);

  const refresh = useCallback(async () => {
    // Only customers have a cart — skip the call entirely for other roles
    // rather than firing a request that will 403.
    if (!isCustomer) {
      requestId.current++;
      commit(EMPTY);
      return;
    }
    setLoading(true);
    try {
      await read();
    } catch {
      // A failed cart read shouldn't blank an already-populated basket.
    } finally {
      setLoading(false);
    }
  }, [isCustomer, read, commit]);

  // Load on sign-in, clear on sign-out.
  //
  // This one stays an effect, unlike the form-seeding elsewhere in the app.
  // Fetching from the server on mount is the case effects exist for —
  // synchronising with an external system — and there is no render-phase
  // equivalent. `refresh` does flip `loading` synchronously, which is what the
  // rule objects to, but that flag is the whole point: it's what renders the
  // basket's loading state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  /**
   * Shared mutation shell: apply an optimistic change, run the request, then
   * reconcile from the server. On failure the snapshot taken during the
   * optimistic update is restored and the error re-thrown for the caller to
   * surface — the basket never silently disagrees with the server.
   */
  const mutate = useCallback(async (
    optimistic: (prev: BasketState) => BasketState,
    request:    () => Promise<unknown>,
  ) => {
    const snapshot = latest.current;
    commit(optimistic(snapshot));
    setMutating(true);
    try {
      await request();
      await read();
    } catch (err) {
      commit(snapshot);
      throw err;
    } finally {
      setMutating(false);
    }
  }, [read, commit]);

  const add = useCallback((productId: number, quantity = 1) => mutate(
    // The line's id and price aren't known until the server replies, so the
    // optimistic step only bumps the count. The reconcile fills in the rest.
    prev => ({ ...prev, count: prev.count + quantity }),
    () => apiFetch('/api/cart/items', {
      method: 'POST',
      body:   JSON.stringify({ product_id: productId, quantity }),
    }),
  ), [mutate]);

  const setQty = useCallback((itemId: number, quantity: number) => mutate(
    prev => totals(prev.items.map(i =>
      i.id === itemId ? { ...i, quantity, subtotal: i.unit_price * quantity } : i,
    )),
    () => apiFetch(`/api/cart/items/${itemId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ quantity }),
    }),
  ), [mutate]);

  const remove = useCallback((itemId: number) => mutate(
    prev => totals(prev.items.filter(i => i.id !== itemId)),
    () => apiFetch(`/api/cart/items/${itemId}`, { method: 'DELETE' }),
  ), [mutate]);

  const clear = useCallback(async () => {
    const snapshot = latest.current;
    commit(EMPTY);
    setMutating(true);
    try {
      await apiFetch('/api/cart', { method: 'DELETE' });
    } catch (err) {
      commit(snapshot);
      throw err;
    } finally {
      setMutating(false);
    }
  }, [commit]);

  const value = useMemo<BasketValue>(() => ({
    ...state,
    isLoading,
    isMutating,
    refresh,
    add,
    setQty,
    remove,
    clear,
    quantityOf: (productId: number) =>
      state.items.find(i => i.product_id === productId)?.quantity ?? 0,
  }), [state, isLoading, isMutating, refresh, add, setQty, remove, clear]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

/**
 * Selector-style access.
 *
 * This is ergonomic sugar, not a performance optimisation — every consumer of
 * a context re-renders when the provider's value changes, selector or not. It
 * exists so `useBasket(s => s.count)` reads cleanly at call sites that only
 * want one field. The basket is small enough that the re-renders don't matter;
 * if that ever changes, the fix is splitting the provider, not this hook.
 */
export function useBasket<T>(selector: (v: BasketValue) => T): T;
export function useBasket(): BasketValue;
export function useBasket<T>(selector?: (v: BasketValue) => T) {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasket must be used inside <BasketProvider>');
  return selector ? selector(ctx) : ctx;
}
