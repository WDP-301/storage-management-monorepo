import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Warehouse } from '../src/types/storage-api';
import { useBookingSettings } from './client-settings';
import { useHold } from './hold';
import { isRentable } from './shelf-rental';

type BrowseSelection = {
  selected: Warehouse[];
  toggle: (warehouse: Warehouse) => void;
  clear: () => void;
};

const Context = createContext<BrowseSelection | null>(null);

export function BrowseSelectionProvider({ children }: { children: ReactNode }) {
  const { activeHolds, heldBooking } = useHold();
  const { maxUnitsPerBooking } = useBookingSettings();
  const [selected, setSelected] = useState<Warehouse[]>([]);
  const holdsKey = activeHolds.map((booking) => booking.id).join(',');

  useEffect(() => setSelected([]), [holdsKey]);

  const toggle = useCallback(
    (warehouse: Warehouse) => {
      if (!isRentable(warehouse) || heldBooking) return;
      setSelected((current) => {
        if (current.some((item) => item.id === warehouse.id)) {
          return current.filter((item) => item.id !== warehouse.id);
        }
        return current.length >= maxUnitsPerBooking ? current : [...current, warehouse];
      });
    },
    [heldBooking, maxUnitsPerBooking],
  );
  const clear = useCallback(() => setSelected([]), []);
  const value = useMemo(() => ({ selected, toggle, clear }), [selected, toggle, clear]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useBrowseSelection() {
  const value = useContext(Context);
  if (!value) throw new Error('BrowseSelectionProvider is missing');
  return value;
}
