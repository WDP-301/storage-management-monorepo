import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { bookingErrorMessage } from '../../lib/booking-errors';
import { useHold } from '../../lib/hold';
import { ScheduleRentalScreen } from '../../src/features/customer/ScheduleRentalScreen';

export default function ScheduleRoute() {
  const router = useRouter();
  const { selectedWarehouses, heldBooking, createBooking, isCreating } = useHold();
  const [error, setError] = useState<string | null>(null);

  if (!selectedWarehouses) {
    return <Redirect href={heldBooking ? '/(customer)/bookings' : '/(customer)/browse'} />;
  }

  return (
    <ScheduleRentalScreen
      key={selectedWarehouses.map((warehouse) => warehouse.id).join(',')}
      warehouses={selectedWarehouses}
      isCreating={isCreating}
      error={error}
      onBack={() => router.navigate('/(customer)/browse')}
      onConfirm={async (schedule) => {
        setError(null);
        try {
          // Straight to the deposit: the hold is already ticking, so the transfer is the next step.
          const booking = await createBooking(schedule);
          if (booking) router.navigate(`/(customer)/payment?id=${booking.id}`);
        } catch (cause) {
          setError(bookingErrorMessage(cause));
        }
      }}
    />
  );
}
