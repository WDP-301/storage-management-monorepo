import { useCallback, useEffect, useRef, useState } from 'react';
import { SettlementsApi } from '../../lib/settlements-api';
import type { SettlementDecisionsInput, SettlementDetailRecord } from '../../types/settlement';
import { describeApiError, isStaleSettlementError } from './settlement-display';

export const PREVIEW_DEBOUNCE_MS = 400;

export interface SettlementPreview {
  /** Latest figures from the server; the client never adds anything up itself. */
  record: SettlementDetailRecord;
  /** The figures belong to the decisions on screen, so their version may be approved. */
  fresh: boolean;
  loading: boolean;
  error: string | null;
  /** Asks the server again with the same decisions (after the figures changed under us). */
  refresh: () => void;
}

/**
 * Server preview of the decisions, re-run 400 ms after the last change. `build` turns the
 * reviewer's entries into decisions about the lines of the latest preview, so a line that
 * appears or disappears on the server is picked up. Only the newest request may update the
 * state, so a slow answer never overwrites a later one.
 */
export function useSettlementPreview(
  contractId: string,
  initial: SettlementDetailRecord,
  build: (record: SettlementDetailRecord) => SettlementDecisionsInput,
  onStale: () => void,
): SettlementPreview {
  const [result, setResult] = useState<{ record: SettlementDetailRecord; key: string | null }>({
    record: initial,
    key: null,
  });
  const key = JSON.stringify(build(result.record));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;

  // `nonce` re-runs the preview with unchanged decisions.
  useEffect(() => {
    const request = ++latest.current;
    setLoading(true);
    const timer = setTimeout(() => {
      SettlementsApi.preview(contractId, JSON.parse(key) as SettlementDecisionsInput)
        .then((record) => {
          if (request !== latest.current) return;
          setResult({ record, key });
          setError(null);
        })
        .catch((err: unknown) => {
          if (request !== latest.current) return;
          setResult((prev) => ({ ...prev, key: null }));
          setError(describeApiError(err, 'Không tính được số liệu quyết toán.'));
          if (isStaleSettlementError(err)) onStaleRef.current();
        })
        .finally(() => {
          if (request === latest.current) setLoading(false);
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [contractId, key, nonce]);

  const refresh = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  return {
    record: result.record,
    fresh: !loading && result.key === key,
    loading,
    error,
    refresh,
  };
}
