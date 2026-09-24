import { useRouter } from 'expo-router';
import { useHold } from '../../lib/hold';
import { MyBookingsScreen } from '../../src/features/customer/MyBookingsScreen';

export default function BookingsRoute() {
  const router = useRouter();
  const { heldBooking, remaining } = useHold();

  return (
    <MyBookingsScreen
      contentBottomPadding={32}
      heldBooking={heldBooking}
      remaining={remaining}
      onBrowse={() => router.navigate('/(tabs)/browse')}
    />
  );
}
