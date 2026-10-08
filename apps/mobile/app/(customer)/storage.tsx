import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { MyStorageScreen } from '../../src/features/customer/MyStorageScreen';
import { useMyContracts } from '../../src/features/customer/use-my-contracts';

export default function StorageRoute() {
  const router = useRouter();
  const { contracts, isLoading, error, refetch } = useMyContracts();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <MyStorageScreen
      contentBottomPadding={32}
      contracts={contracts}
      now={Date.now()}
      isLoading={isLoading}
      error={error}
      onBrowse={() => router.navigate('/(customer)/browse')}
      onDetail={(contractId) => router.navigate(`/(customer)/contract-detail?id=${contractId}`)}
      onRefresh={refetch}
    />
  );
}
