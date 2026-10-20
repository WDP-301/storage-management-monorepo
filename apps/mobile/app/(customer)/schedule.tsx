import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '../../lib/api';
import { bookingErrorMessage } from '../../lib/booking-errors';
import { useRefreshBookingSettings } from '../../lib/client-settings';
import { useHold } from '../../lib/hold';
import { ScheduleRentalScreen } from '../../src/features/customer/ScheduleRentalScreen';

export default function ScheduleRoute() {
  const router = useRouter();
  const { selectedWarehouses, heldBooking, createBooking, clearSelection, isCreating } = useHold();
  const refreshBookingSettings = useRefreshBookingSettings();
  const [error, setError] = useState<string | null>(null);

  if (!selectedWarehouses) {
    return <Redirect href={heldBooking ? '/(customer)/storage' : '/(customer)/browse'} />;
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
          const message = bookingErrorMessage(cause);
          if (
            cause instanceof ApiError &&
            (cause.code === 'UNIT_NOT_AVAILABLE' || cause.code === 'RESOURCE_NOT_FOUND')
          ) {
            clearSelection();
            Alert.alert('Kệ hoặc kho không còn trống', message);
            router.navigate('/(customer)/browse');
          } else {
            // A rule rejection means the rules shown here are stale; reload them so the screen
            // re-clamps its choices before the customer tries again.
            if (cause instanceof ApiError && cause.code === 'VALIDATION_FAILED') {
              refreshBookingSettings();
            }
            setError(message);
          }
        }
      }}
    />
  );
}
