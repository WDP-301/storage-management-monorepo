import { useLocalSearchParams, useRouter } from 'expo-router';
import { ContractDetailScreen } from '../../src/features/customer/ContractDetailScreen';
import { useMyContracts } from '../../src/features/customer/use-my-contracts';

export default function ContractDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { contracts, isLoading, error, refetch } = useMyContracts();
  const contract = contracts.find((item) => item.id === id) ?? null;

  const openSupport = () => {
    const params = [
      contract?.facility ? `facilityId=${contract.facility.id}` : null,
      contract?.unit ? `storageUnitId=${contract.unit.id}` : null,
    ].filter(Boolean);
    router.navigate(`/(customer)/ticket-create${params.length ? `?${params.join('&')}` : ''}`);
  };

  return (
    <ContractDetailScreen
      contentBottomPadding={32}
      contract={contract}
      now={Date.now()}
      isLoading={isLoading}
      error={error}
      // Tabs go back to the first route (Browse), so return to the list explicitly.
      onBack={() => router.navigate('/(customer)/storage')}
      onSupport={openSupport}
      onRefresh={refetch}
    />
  );
}
