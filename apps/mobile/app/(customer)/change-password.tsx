import { useRouter } from 'expo-router';
import { ChangePasswordScreen } from '../../src/features/settings/ChangePasswordScreen';

export default function CustomerChangePasswordRoute() {
  const router = useRouter();

  return <ChangePasswordScreen onBack={() => router.navigate('/(customer)/settings')} />;
}
