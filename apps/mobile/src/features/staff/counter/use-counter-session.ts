import type { CounterSessionView } from '@storage/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../../lib/api';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { secondsUntil } from '../../../../lib/shelf-storage-format';
import { shelfApiError } from '../staff-errors';

type Status = 'idle' | 'opening' | 'open' | 'expired';

/**
 * The counter session opened by scanning a customer's code: idle → opening → open → expired.
 * Stock is reloaded whenever the tab regains focus (after a receipt was saved elsewhere), and
 * the session is dropped when staff switch warehouse because a session belongs to one warehouse.
 */
export function useCounterSession(warehouseId: string | undefined) {
  const [session, setSession] = useState<CounterSessionView | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  // Deadline on the device clock from the server's ttlSeconds, so a wrong phone clock cannot
  // expire the session early or keep an expired one open.
  const [deadline, setDeadline] = useState(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const accept = useCallback((next: CounterSessionView) => {
    setSession(next);
    const at = Date.now();
    setNow(at);
    setDeadline(at + next.ttlSeconds * 1000);
  }, []);

  const end = useCallback(() => {
    setSession(null);
    setStatus('idle');
    setError(null);
  }, []);

  useEffect(() => {
    void warehouseId;
    end();
  }, [warehouseId, end]);

  const open = useCallback(
    async (qrPayload: string): Promise<boolean> => {
      if (!warehouseId) return false;
      setStatus('opening');
      setError(null);
      try {
        accept(await ShelfStorageApi.openSession({ qrPayload, warehouseId }));
        setStatus('open');
        return true;
      } catch (cause) {
        setStatus('idle');
        setError(shelfApiError(cause, 'Không mở được phiên làm việc.'));
        return false;
      }
    },
    [warehouseId, accept],
  );

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    try {
      accept(await ShelfStorageApi.getSession(current.sessionId));
    } catch (cause) {
      const gone =
        cause instanceof ApiError &&
        (cause.code === 'COUNTER_SESSION_INVALID' || cause.statusCode === 404);
      if (gone) {
        setStatus('expired');
        setError(shelfApiError(cause, 'Phiên làm việc đã hết hạn. Quét lại mã của khách.'));
      }
    }
  }, [accept]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (status !== 'open') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const secondsLeft = session ? secondsUntil(deadline, now) : 0;
  useEffect(() => {
    if (status === 'open' && session && secondsLeft === 0) {
      setStatus('expired');
      setError('Phiên làm việc đã hết hạn. Quét lại mã của khách.');
    }
  }, [status, session, secondsLeft]);

  return { session, status, error, secondsLeft, open, refresh, end };
}
