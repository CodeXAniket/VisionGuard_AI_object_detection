import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../services/apiClient';

/**
 * Runs `request()` whenever `deps` change and tracks loading/error state.
 * Previous data is kept while reloading so tables don't flash empty.
 */
export function useApi(request, deps) {
  const [state, setState] = useState({ data: null, error: null, isLoading: true });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, error: null, isLoading: true }));

    request()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, isLoading: false });
      })
      .catch((error) => {
        if (!cancelled) setState((previous) => ({ ...previous, error: getErrorMessage(error), isLoading: false }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const setData = useCallback((data) => setState((previous) => ({ ...previous, data })), []);

  return { ...state, reload, setData };
}

// Calls `reload` every `intervalMs` while `enabled` (e.g. while monitoring,
// so lists pick up new events without a page refresh).
export function useAutoReload(reload, enabled, intervalMs = 10000) {
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(reload, intervalMs);
    return () => clearInterval(timer);
  }, [reload, enabled, intervalMs]);
}
