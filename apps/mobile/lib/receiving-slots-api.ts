import { request } from './api';
import type { ReceivingDay } from './receiving-time';

/** The OFFICE work-shift windows a warehouse may be received in, per Vietnam day. */
export const ReceivingSlotsApi = {
  list: (from: string, to: string): Promise<ReceivingDay[]> =>
    request<{ days: ReceivingDay[] }>(
      `/bookings/receiving-slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ).then((response) => response.days),
};
