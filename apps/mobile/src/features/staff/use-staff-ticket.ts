import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { TicketsApi } from '../../../lib/tickets-api';
import { type PickedFile, UploadsApi } from '../../../lib/uploads-api';
import type { ServiceTicketRecord, UpdateTicketInput } from '../../types/ticket-api';

/**
 * One ticket in the staff area: loads on focus and applies processing updates. The route stays
 * mounted across ids (e.g. opened from a notification), so every response is checked against the
 * id currently shown — a late reply for another ticket must never land on this screen.
 */
export function useStaffTicket(id: string | undefined) {
  const [ticket, setTicket] = useState<ServiceTicketRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentId = useRef(id);
  // A state flag alone lets two taps in the same frame both submit; the ref closes that gap.
  const inFlight = useRef(false);

  useEffect(() => {
    currentId.current = id;
    setTicket(null);
    setError(null);
    setIsLoading(true);
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const loaded = await TicketsApi.getById(id);
      if (currentId.current === id) setTicket(loaded);
    } catch (e) {
      if (currentId.current !== id) return;
      // Whatever was shown may no longer be this user's to work (e.g. reassigned) — drop it.
      setTicket(null);
      setError(e instanceof ApiError ? e.message : 'Không tải được yêu cầu.');
    } finally {
      if (currentId.current === id) setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      void load();
    }, [load]),
  );

  /**
   * Uploads `photos`, then sends the update. The API replaces the attachment list, so new photos
   * are appended to the ones already on the ticket (the customer's included). Resolves to whether
   * the update went through; on failure the ticket is reloaded because another user may have
   * moved it in the meantime.
   */
  const update = useCallback(
    async (input: UpdateTicketInput, photos: PickedFile[] = []): Promise<boolean> => {
      if (!ticket || ticket.id !== currentId.current || inFlight.current) return false;
      inFlight.current = true;
      setIsSaving(true);
      setError(null);
      try {
        const uploaded = [];
        for (const photo of photos) {
          uploaded.push(await UploadsApi.uploadFile(photo));
        }
        const saved = await TicketsApi.update(ticket.id, {
          ...input,
          ...(uploaded.length > 0 ? { attachments: [...ticket.attachments, ...uploaded] } : {}),
        });
        if (currentId.current === saved.id) setTicket(saved);
        return true;
      } catch (e) {
        if (currentId.current === ticket.id) {
          setError(e instanceof ApiError ? e.message : 'Không cập nhật được yêu cầu. Thử lại.');
          void load();
        }
        return false;
      } finally {
        inFlight.current = false;
        setIsSaving(false);
      }
    },
    [ticket, load],
  );

  return { ticket, isLoading, isSaving, error, reload: load, update };
}
