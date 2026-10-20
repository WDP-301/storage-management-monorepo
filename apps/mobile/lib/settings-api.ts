import type { ClientSettingsResponse } from '@storage/types';
import { request } from './api';

export const SettingsApi = {
  /** Admin-configured booking rules; options are already filtered to what the API accepts. */
  client: (signal?: AbortSignal) => request<ClientSettingsResponse>('/settings/client', { signal }),
};
