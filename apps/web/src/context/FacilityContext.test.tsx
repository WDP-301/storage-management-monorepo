import { UserRole } from '@storage/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FacilitiesApi } from '../lib/api';
import * as AuthContextModule from './AuthContext';
import { FacilityProvider, useFacility } from './FacilityContext';

vi.mock('../lib/api', () => ({
  FacilitiesApi: {
    mine: vi.fn(),
    listAll: vi.fn(),
  },
}));

describe('FacilityContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <FacilityProvider>{children}</FacilityProvider>
  );

  const mockFacilities = [
    {
      id: 'fac-1',
      code: 'KHO-HN1',
      name: 'Kho Hà Nội 1',
      addressLine: '123 Cầu Giấy',
      status: 'ACTIVE',
    },
    {
      id: 'fac-2',
      code: 'KHO-HCM1',
      name: 'Kho Hồ Chí Minh 1',
      addressLine: '456 Quận 1',
      status: 'ACTIVE',
    },
  ];

  it('fetches all facilities via listAll() when user is ADMIN', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-admin',
        email: 'admin@example.com',
        fullName: 'Admin User',
        status: 'ACTIVE',
        roles: [UserRole.ADMIN],
        createdAt: '',
        updatedAt: '',
      },
      activeRole: UserRole.ADMIN,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(FacilitiesApi.listAll).mockResolvedValueOnce(mockFacilities);

    const { result } = renderHook(() => useFacility(), { wrapper });

    await waitFor(() => {
      expect(result.current.facilities).toHaveLength(2);
    });

    expect(FacilitiesApi.listAll).toHaveBeenCalledTimes(1);
    expect(FacilitiesApi.mine).not.toHaveBeenCalled();
    expect(result.current.selectedFacility).toEqual(mockFacilities[0]);
  });

  it('fetches assigned facilities via mine() when user is FACILITY_MANAGER', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-mgr',
        email: 'mgr@example.com',
        fullName: 'Manager User',
        status: 'ACTIVE',
        roles: [UserRole.FACILITY_MANAGER],
        createdAt: '',
        updatedAt: '',
      },
      activeRole: UserRole.FACILITY_MANAGER,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(FacilitiesApi.mine).mockResolvedValueOnce([mockFacilities[0]]);

    const { result } = renderHook(() => useFacility(), { wrapper });

    await waitFor(() => {
      expect(result.current.facilities).toHaveLength(1);
    });

    expect(FacilitiesApi.mine).toHaveBeenCalledTimes(1);
    expect(FacilitiesApi.listAll).not.toHaveBeenCalled();
    expect(result.current.selectedFacility).toEqual(mockFacilities[0]);
  });

  it('does not fetch facilities for CUSTOMER and leaves list empty', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-cust',
        email: 'cust@example.com',
        fullName: 'Customer User',
        status: 'ACTIVE',
        roles: [UserRole.CUSTOMER],
        createdAt: '',
        updatedAt: '',
      },
      activeRole: UserRole.CUSTOMER,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    const { result } = renderHook(() => useFacility(), { wrapper });

    expect(result.current.facilities).toEqual([]);
    expect(result.current.selectedFacility).toBeNull();
    expect(FacilitiesApi.listAll).not.toHaveBeenCalled();
    expect(FacilitiesApi.mine).not.toHaveBeenCalled();
  });

  it('selectFacility updates selected facility and persists to localStorage', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-admin',
        email: 'admin@example.com',
        fullName: 'Admin User',
        status: 'ACTIVE',
        roles: [UserRole.ADMIN],
        createdAt: '',
        updatedAt: '',
      },
      activeRole: UserRole.ADMIN,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(FacilitiesApi.listAll).mockResolvedValueOnce(mockFacilities);

    const { result } = renderHook(() => useFacility(), { wrapper });

    await waitFor(() => {
      expect(result.current.facilities).toHaveLength(2);
    });

    act(() => {
      result.current.selectFacility('fac-2');
    });

    expect(result.current.selectedFacility).toEqual(mockFacilities[1]);
    expect(localStorage.getItem('storage:selectedFacilityId')).toBe('fac-2');
  });
});
