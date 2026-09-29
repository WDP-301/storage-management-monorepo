import { Redirect, useRouter } from 'expo-router';
import { useHold } from '../../lib/hold';
import { ScheduleRentalScreen } from '../../src/features/customer/ScheduleRentalScreen';

export default function ScheduleRoute() {
  const router = useRouter();
  const { heldBooking, remaining, setSchedule } = useHold();

  // The hold expires on its own, and the screen has nothing to schedule without one.
  if (!heldBooking) return <Redirect href="/(customer)/bookings" />;

  return (
    <ScheduleRentalScreen
      booking={heldBooking}
      remaining={remaining}
      onConfirm={(schedule) => {
        setSchedule(schedule);
        router.navigate('/(customer)/bookings');
      }}
    />
  );
}
