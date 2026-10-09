import type { ApiBooking } from '../../types/booking-api';
import { useWarehouseDetails } from './use-warehouse-details';

/**
 * Warehouse names and total area for a booking's items. Booking items only carry the unit (whose
 * code equals the warehouse code), so names are looked up and fall back to the code meanwhile.
 */
export function useBookingWarehouses(booking: ApiBooking) {
  const details = useWarehouseDetails(
    booking.items.map((item) => item.storageUnit?.facilityId ?? ''),
  );
  const names = booking.items
    .map((item) => {
      const warehouse = details.get(item.storageUnit?.facilityId ?? '');
      return warehouse?.name ?? item.storageUnit?.code ?? item.storageUnitId;
    })
    .join(', ');
  const totalArea = booking.items.reduce(
    (sum, item) => sum + Number(item.storageUnit?.areaM2 ?? 0),
    0,
  );
  return { names, totalArea };
}
