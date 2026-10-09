import { useRouter } from 'expo-router';
import { depositStage } from '../../lib/booking-payment-state';
import { useHold } from '../../lib/hold';
import { useSession } from '../../lib/session';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  const { user, isLoggingOut, logout } = useSession();
  const { bookings, now, isLoading, error } = useHold();
  const rentalUnitCount = bookings
    .filter((booking) => booking.status === 'CONFIRMED')
    .reduce((sum, booking) => sum + booking.items.length, 0);
  const pendingDepositCount = bookings.filter((booking) =>
    ['awaiting', 'unavailable'].includes(depositStage(booking, now)),
  ).length;

  if (!user) return null;

  return (
    <SettingsScreen
      rentalUnitCount={isLoading || error ? null : rentalUnitCount}
      pendingDepositCount={isLoading || error ? null : pendingDepositCount}
      user={user}
      isLoggingOut={isLoggingOut}
      onLogout={logout}
      onSupport={() => router.navigate('/(customer)/tickets')}
    />
  );
}
