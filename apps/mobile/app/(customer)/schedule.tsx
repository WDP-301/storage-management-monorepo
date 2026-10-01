import { Redirect, useRouter } from 'expo-router';
import { useHold } from '../../lib/hold';
import { ScheduleRentalScreen } from '../../src/features/customer/ScheduleRentalScreen';

export default function ScheduleRoute() {
  const router = useRouter();
  const { heldBooking, remaining, setSchedule } = useHold();

  // The hold expires on its own, and the screen has nothing to schedule without one.
  if (!heldBooking) return <Redirect href="/(customer)/bookings" />;

  return (
    // Keyed by booking so a new hold mounts a fresh screen. The screen lives in a tab navigator
    // and keeps its draft state once visited; without this it would carry the previous booking's
    // unconfirmed date and duration over, and the draft would silently disagree with the booking
    // card. Today a hold must be released before the next one starts, which already forces a
    // remount — the key stops that from being the only thing holding the invariant up.
    <ScheduleRentalScreen
      key={heldBooking.id}
      booking={heldBooking}
      remaining={remaining}
      onConfirm={(schedule) => {
        setSchedule(schedule);
        router.navigate('/(customer)/bookings');
      }}
    />
  );
}
