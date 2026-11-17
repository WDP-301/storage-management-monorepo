import type {
  StaffShiftListResponse,
  StaffShiftRecord,
  StaffShiftResponse,
} from '../src/types/staff-shift-api';
import { request } from './api';

export const StaffShiftsApi = {
  /** Ca làm của chính nhân viên trong khoảng ngày `from..to` (tối đa 31 ngày). */
  listMine: async (from: string, to: string, signal?: AbortSignal): Promise<StaffShiftRecord[]> => {
    const params = new URLSearchParams({ from, to });
    const res = await request<StaffShiftListResponse>(`/me/staff-shifts?${params.toString()}`, {
      method: 'GET',
      signal,
    });
    return res.staff_shifts;
  },

  /** Check-in ca làm việc (mở trước giờ bắt đầu 30 phút cho tới khi kết thúc ca). */
  checkIn: async (id: string): Promise<StaffShiftRecord> => {
    const res = await request<StaffShiftResponse>(
      `/me/staff-shifts/${encodeURIComponent(id)}/check-in`,
      {
        method: 'PATCH',
      },
    );
    return res.staff_shift;
  },

  /** Check-out sau khi đã check-in ca làm việc. */
  checkOut: async (id: string): Promise<StaffShiftRecord> => {
    const res = await request<StaffShiftResponse>(
      `/me/staff-shifts/${encodeURIComponent(id)}/check-out`,
      {
        method: 'PATCH',
      },
    );
    return res.staff_shift;
  },
};
