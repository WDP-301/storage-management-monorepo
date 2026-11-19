import { useRouter } from 'expo-router';
import { WarehouseRulesScreen } from '../../src/features/settings/WarehouseRulesScreen';

export default function CustomerWarehouseRulesRoute() {
  const router = useRouter();

  return <WarehouseRulesScreen onBack={() => router.navigate('/(customer)/settings')} />;
}
