/**
 * usePolling — a React hook that repeatedly invokes an async function on a
 * fixed interval and exposes the latest resolved value.
 *
 * The default interval is 3000ms (~3s). Because the design relies on
 * short-interval polling to satisfy the "within 5 seconds" freshness
 * acceptance criteria (order status 6.4, metrics 7.5, trending 11.2), a 3s
 * cadence guarantees a refresh well inside that 5s window.
 *
 * Behavior:
 *   - Fetches once immediately on mount (and whenever `fn`/`intervalMs`/
 *     `enabled` change), then every `intervalMs` thereafter.
 *   - Ignores results from stale in-flight requests (guards against overlap
 *     and post-unmount state updates).
 *   - `enabled: false` pauses polling without unmounting.
 *   - Exposes `refresh()` for an on-demand fetch (e.g. after a user action).
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Default polling interval in milliseconds (~1 second). */
export const DEFAULT_POLL_INTERVAL_MS = 1000;

export interface UsePollingOptions {
  /** Interval between polls in milliseconds. Defaults to 3000ms. */
  intervalMs?: number;
  /** When false, polling is paused. Defaults to true. */
  enabled?: boolean;
}

export interface UsePollingResult<T> {
  /** The latest successfully resolved value, or undefined before first load. */
  data: T | undefined;
  /** The most recent error, or undefined when the last poll succeeded. */
  error: Error | undefined;
  /** True while the first fetch has not yet resolved. */
  loading: boolean;
  /** Trigger an immediate out-of-band fetch. */
  refresh: () => void;
}

export function usePolling<T>(
  fn: () => Promise<T>,
  options: UsePollingOptions = {}
): UsePollingResult<T> {
  const { intervalMs = DEFAULT_POLL_INTERVAL_MS, enabled = true } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  // Keep the latest fn in a ref so the polling effect does not need to tear
  // down and restart when a caller passes an inline function each render.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // Monotonically increasing id identifying the most recent request; results
  // from older requests are discarded.
  const requestIdRef = useRef(0);
  // Tracks whether the component is still mounted to avoid post-unmount sets.
  const mountedRef = useRef(true);

  const runFetch = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const result = await fnRef.current();
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setData(result);
      setError(undefined);
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    void runFetch();
  }, [runFetch]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }

    // Immediate fetch on mount/param change, then on the interval.
    void runFetch();
    const timer = setInterval(() => {
      void runFetch();
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [runFetch, intervalMs, enabled]);

  return { data, error, loading, refresh };
}
