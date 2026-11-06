import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from './api';

/**
 * One Idempotency-Key per distinct request. It stays the same while the request is unchanged,
 * so a retry after a timeout or a 5xx can't record twice, and changes as soon as the form does.
 * Call renew() after a success to be able to send the same request again on purpose.
 */
export function useIdempotencyKey(request: unknown): { key: string; renew: () => void } {
  const signature = JSON.stringify(request);
  const current = useRef<{ signature: string; key: string } | null>(null);
  const [, rerender] = useState(0);
  if (current.current?.signature !== signature) {
    current.current = { signature, key: crypto.randomUUID() };
  }
  const renew = useCallback(() => {
    current.current = null;
    rerender((n) => n + 1);
  }, []);
  return { key: current.current.key, renew };
}

export interface Loaded<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
  reload: () => void;
}

/** Runs load() whenever deps change, keeping the last data while it reloads. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): Loaded<T> {
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({ loading: true });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState({ error: toApiError(e), loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, generation]);

  const reload = useCallback(() => setGeneration((n) => n + 1), []);
  return { ...state, reload };
}
