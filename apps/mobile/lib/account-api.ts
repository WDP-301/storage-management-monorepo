import type {
  ChangePasswordInput,
  ChangePasswordResponse,
  UpdateProfileInput,
  UpdateProfileResponse,
} from '../src/types/auth';
import { request } from './api';

export const AccountApi = {
  updateProfile: (userId: string, input: UpdateProfileInput): Promise<UpdateProfileResponse> =>
    request<UpdateProfileResponse>(`/customers/${encodeURIComponent(userId)}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  changePassword: (input: ChangePasswordInput): Promise<ChangePasswordResponse> =>
    request<ChangePasswordResponse>('/customers/me/password', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
};
