import type { ApiBooking } from '../../types/booking-api';
import { useWarehouseDetails } from './use-warehouse-details';

/**
 * Warehouse names and total area for a booking's items. Booking items only carry the unit id (the
 * warehouse id), so names are looked up and fall back to the code meanwhile.
 */
export function useBookingWarehouses(booking: ApiBooking) {
  const details = useWarehouseDetails(booking.items.map((item) => item.storageUnitId));
  const names = booking.items
    .map((item) => {
      const warehouse = details.get(item.storageUnitId);
      return warehouse?.name ?? item.storageUnit?.code ?? item.storageUnitId;
    })
    .join(', ');
  const totalArea = booking.items.reduce(
    (sum, item) => sum + Number(item.storageUnit?.areaM2 ?? 0),
    0,
  );
  return { names, totalArea };
}
