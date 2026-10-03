import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useHold } from '../../lib/hold';
import { MyBookingsScreen } from '../../src/features/customer/MyBookingsScreen';

export default function BookingsRoute() {
  const router = useRouter();
  const { bookings, isLoading, error, refreshBookings } = useHold();

  useFocusEffect(
    useCallback(() => {
      void refreshBookings().catch(() => undefined);
    }, [refreshBookings]),
  );

  return (
    <MyBookingsScreen
      contentBottomPadding={32}
      bookings={bookings}
      isLoading={isLoading}
      error={error}
      onBrowse={() => router.navigate('/(customer)/browse')}
      onRefresh={() => void refreshBookings().catch(() => undefined)}
    />
  );
}
