import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ContractDetailScreen } from '../../src/features/customer/ContractDetailScreen';
import { useMyContracts } from '../../src/features/customer/use-my-contracts';

export default function ContractDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contracts, isLoading, refetch } = useMyContracts();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <ContractDetailScreen
      contentBottomPadding={32}
      contract={contracts.find((contract) => contract.id === id) ?? null}
      now={Date.now()}
      isLoading={isLoading}
      onBack={() => router.back()}
      onSupport={() => router.navigate('/(customer)/ticket-create')}
      onRefresh={refetch}
    />
  );
}
