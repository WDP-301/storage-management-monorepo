import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useHold } from '../../lib/hold';
import { ScheduleRentalScreen } from '../../src/features/customer/ScheduleRentalScreen';

export default function ScheduleRoute() {
  const router = useRouter();
  const { selectedUnits, heldBooking, createBooking, isCreating } = useHold();
  const [error, setError] = useState<string | null>(null);

  if (!selectedUnits) {
    return <Redirect href={heldBooking ? '/(customer)/bookings' : '/(customer)/browse'} />;
  }

  return (
    <ScheduleRentalScreen
      key={selectedUnits.map((unit) => unit.id).join(',')}
      units={selectedUnits}
      isCreating={isCreating}
      error={error}
      onConfirm={async (schedule) => {
        setError(null);
        try {
          // Straight to the deposit: the hold is already ticking, so the transfer is the next step.
          const booking = await createBooking(schedule);
          if (booking) router.navigate(`/(customer)/payment?id=${booking.id}`);
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : 'Không giữ được kho. Vui lòng thử lại.',
          );
        }
      }}
    />
  );
}
