import { UserRole } from '@storage/types';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { FacilitiesApi, type FacilityRecord } from '../lib/api';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'storage:selectedFacilityId';
const FACILITY_SCOPED_ROLES: UserRole[] = [UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF];

interface FacilityContextValue {
  facilities: FacilityRecord[];
  selectedFacility: FacilityRecord | null;
  selectFacility: (id: string) => void;
  isLoading: boolean;
}

const FacilityContext = createContext<FacilityContextValue | undefined>(undefined);

export const FacilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, activeRole } = useAuth();
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isFacilityScoped = Boolean(activeRole && FACILITY_SCOPED_ROLES.includes(activeRole));

  useEffect(() => {
    if (!user || !isFacilityScoped) {
      setFacilities([]);
      setSelectedFacilityId(null);
      return;
    }

    setIsLoading(true);
    FacilitiesApi.mine()
      .then((list) => {
        setFacilities(list);
        const saved = localStorage.getItem(STORAGE_KEY);
        const valid = list.find((f) => f.id === saved);
        setSelectedFacilityId((valid ?? list[0])?.id ?? null);
      })
      .catch(() => setFacilities([]))
      .finally(() => setIsLoading(false));
  }, [user, isFacilityScoped]);

  const selectFacility = (id: string) => {
    setSelectedFacilityId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const value = useMemo<FacilityContextValue>(
    () => ({
      facilities,
      selectedFacility: facilities.find((f) => f.id === selectedFacilityId) ?? null,
      selectFacility,
      isLoading,
    }),
    [facilities, selectedFacilityId, isLoading],
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
