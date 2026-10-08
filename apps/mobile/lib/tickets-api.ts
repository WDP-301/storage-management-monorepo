import * as Crypto from 'expo-crypto';
import type {
  CreateTicketInput,
  ListTicketsParams,
  ServiceTicketListResponse,
  ServiceTicketRecord,
  TicketFormOptions,
} from '../src/types/ticket-api';
import { request } from './api';

export const TicketsApi = {
  listMine: (params?: ListTicketsParams, signal?: AbortSignal) =>
    request<ServiceTicketListResponse>(`/service-tickets${toQuery(params)}`, { signal }),

  getById: async (id: string, signal?: AbortSignal): Promise<ServiceTicketRecord> =>
    (await request<{ ticket: ServiceTicketRecord }>(`/service-tickets/${id}`, { signal })).ticket,

  /**
   * Types + facilities/units the customer may file against, straight from the same rental
   * rules the create endpoint enforces.
   */
  formOptions: async (signal?: AbortSignal): Promise<TicketFormOptions> =>
    (await request<{ options: TicketFormOptions }>('/service-tickets/form-options', { signal }))
      .options,

  /**
   * Retries must reuse the same `idempotencyKey` — generate it once per form mount with
   * `newIdempotencyKey()`, keep it in a ref, and pass it back in.
   */
  create: async (input: CreateTicketInput, idempotencyKey: string): Promise<ServiceTicketRecord> =>
    (
      await request<{ ticket: ServiceTicketRecord }>('/service-tickets', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(input),
        timeoutMs: 30000,
      })
    ).ticket,

  cancel: async (id: string): Promise<ServiceTicketRecord> =>
    (
      await request<{ ticket: ServiceTicketRecord }>(`/service-tickets/${id}/cancel`, {
        method: 'PATCH',
      })
    ).ticket,

  newIdempotencyKey: () => Crypto.randomUUID(),
};

function toQuery(params?: ListTicketsParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.status) search.set('status', params.status);
  if (params.priority) search.set('priority', params.priority);
  if (params.typeId) search.set('typeId', params.typeId);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
