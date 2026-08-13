/**
 * Debounce a rapidly-changing value.
 *
 * Used for search inputs so typing doesn't fire a request per keystroke —
 * the field stays fully responsive while the query lags behind it.
 */

import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
