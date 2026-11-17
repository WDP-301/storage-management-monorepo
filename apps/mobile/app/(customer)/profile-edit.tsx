import { useRouter } from 'expo-router';
import { useSession } from '../../lib/session';
import { EditProfileScreen } from '../../src/features/settings/EditProfileScreen';

export default function CustomerProfileEditRoute() {
  const router = useRouter();
  const { user, authenticate } = useSession();

  if (!user) return null;

  return (
    <EditProfileScreen
      includeCustomerFields
      onBack={() => router.navigate('/(customer)/settings')}
      onUserUpdated={authenticate}
      user={user}
    />
  );
}
