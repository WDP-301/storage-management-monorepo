import { UserRole } from '@storage/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FacilitiesApi, type FacilityRecord } from '../lib/api';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'storage:selectedFacilityId';
const ALL_FACILITY_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER];
const ASSIGNED_FACILITY_ROLES: UserRole[] = [UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF];

interface FacilityContextValue {
  facilities: FacilityRecord[];
  /** Null means "all facilities"; only offered to ADMIN / OPERATIONS_MANAGER (see canSelectAll). */
  selectedFacility: FacilityRecord | null;
  /** Pass null to select every facility; ignored when the role cannot span facilities. */
  selectFacility: (id: string | null) => void;
  canSelectAll: boolean;
  isLoading: boolean;
}

const FacilityContext = createContext<FacilityContextValue | undefined>(undefined);

export const FacilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, activeRole } = useAuth();
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const shouldFetchAll = Boolean(activeRole && ALL_FACILITY_ROLES.includes(activeRole));
  const shouldFetchAssigned = Boolean(activeRole && ASSIGNED_FACILITY_ROLES.includes(activeRole));

  useEffect(() => {
    if (!user || (!shouldFetchAll && !shouldFetchAssigned)) {
      setFacilities([]);
      setSelectedFacilityId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const fetchPromise = shouldFetchAll ? FacilitiesApi.listAll() : FacilitiesApi.mine();

    fetchPromise
      .then((list) => {
        const facilityList = list || [];
        setFacilities(facilityList);
        const saved = localStorage.getItem(STORAGE_KEY);
        const valid = facilityList.find((f) => f.id === saved);
        setSelectedFacilityId(
          valid ? valid.id : shouldFetchAll ? null : (facilityList[0]?.id ?? null),
        );
      })
      .catch(() => {
        setFacilities([]);
        setSelectedFacilityId(null);
      })
      .finally(() => setIsLoading(false));
  }, [user, shouldFetchAll, shouldFetchAssigned]);

  const selectFacility = useCallback(
    (id: string | null) => {
      if (id === null && !shouldFetchAll) return;
      setSelectedFacilityId(id);
      if (id === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, id);
    },
    [shouldFetchAll],
  );

  const value = useMemo<FacilityContextValue>(
    () => ({
      facilities,
      selectedFacility: facilities.find((f) => f.id === selectedFacilityId) ?? null,
      selectFacility,
      canSelectAll: shouldFetchAll,
      isLoading,
    }),
    [facilities, selectedFacilityId, isLoading, selectFacility, shouldFetchAll],
  );

  return <FacilityContext.Provider value={value}>{children}</FacilityContext.Provider>;
};

export const useFacility = (): FacilityContextValue => {
  const context = useContext(FacilityContext);
  if (!context) {
    throw new Error('useFacility must be used within a FacilityProvider');
  }
  return context;
};
