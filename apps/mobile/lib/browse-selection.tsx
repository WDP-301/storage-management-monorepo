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
import { useHold } from './hold';
import { isRentable } from './shelf-rental';
import { MAX_WAREHOUSES_PER_BOOKING } from './warehouse-query';

type BrowseSelection = {
  selected: Warehouse[];
  toggle: (warehouse: Warehouse) => void;
  clear: () => void;
};

const Context = createContext<BrowseSelection | null>(null);

export function BrowseSelectionProvider({ children }: { children: ReactNode }) {
  const { activeHolds, heldBooking } = useHold();
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
        return current.length >= MAX_WAREHOUSES_PER_BOOKING ? current : [...current, warehouse];
      });
    },
    [heldBooking],
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
