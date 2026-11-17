import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AuthApi } from '../../lib/api';
import { depositStage } from '../../lib/booking-payment-state';
import { useHold } from '../../lib/hold';
import { useSession } from '../../lib/session';
import { ShelfAccessCard } from '../../src/features/customer/ShelfAccessCard';
import { useMyContracts } from '../../src/features/customer/use-my-contracts';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import type { CustomerProfile } from '../../src/types/auth';

export default function SettingsRoute() {
  const router = useRouter();
  const { user, isLoggingOut, logout } = useSession();
  const { bookings, now, isLoading, error } = useHold();
  const { contracts } = useMyContracts();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const controller = new AbortController();
      AuthApi.meDetail(controller.signal)
        .then((detail) => {
          if (!controller.signal.aborted) setProfile(detail.profile);
        })
        .catch(() => undefined);
      return () => controller.abort();
    }, [user?.id]),
  );

  const rentalUnitCount = bookings
    .filter((booking) => booking.status === 'CONFIRMED')
    .reduce((sum, booking) => sum + booking.items.length, 0);
  const pendingDepositCount = bookings.filter((booking) =>
    ['awaiting', 'unavailable'].includes(depositStage(booking, now)),
  ).length;

  if (!user) return null;

  return (
    <SettingsScreen
      addressLabel={profile?.address_line ?? null}
      companyLabel={profile?.company_name ?? null}
      rentalUnitCount={isLoading || error ? null : rentalUnitCount}
      pendingDepositCount={isLoading || error ? null : pendingDepositCount}
      user={user}
      isLoggingOut={isLoggingOut}
      onLogout={logout}
      onEditProfile={() => router.navigate('/(customer)/profile-edit')}
      onChangePassword={() => router.navigate('/(customer)/change-password')}
      onSupport={() => router.navigate('/(customer)/tickets')}
      onTours={() => router.navigate('/(customer)/tours')}
      accessCard={<ShelfAccessCard contracts={contracts} />}
    />
  );
}
