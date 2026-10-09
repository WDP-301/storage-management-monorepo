import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useHold } from '../../lib/hold';
import { MyStorageScreen } from '../../src/features/customer/MyStorageScreen';
import { useMyContracts } from '../../src/features/customer/use-my-contracts';

export default function StorageRoute() {
  const router = useRouter();
  const {
    bookings,
    now,
    isLoading: isLoadingBookings,
    error: bookingsError,
    refreshBookings,
  } = useHold();
  const {
    contracts,
    isLoading: isLoadingContracts,
    error: contractsError,
    refetch,
  } = useMyContracts();

  // Contracts reload on focus inside their hook; holds live in the shared provider, so refresh
  // them here too — a deposit that just landed turns a hold into a contract.
  useFocusEffect(
    useCallback(() => {
      void refreshBookings().catch(() => undefined);
    }, [refreshBookings]),
  );

  return (
    <MyStorageScreen
      contentBottomPadding={32}
      bookings={bookings}
      contracts={contracts}
      now={now}
      isLoading={isLoadingBookings || isLoadingContracts}
      error={contractsError ?? bookingsError}
      onBrowse={() => router.navigate('/(customer)/browse')}
      onPay={(bookingId) => router.navigate(`/(customer)/payment?id=${bookingId}`)}
      onDetail={(contractId) => router.navigate(`/(customer)/contract-detail?id=${contractId}`)}
      onRefresh={() => {
        refetch();
        void refreshBookings().catch(() => undefined);
      }}
    />
  );
}
