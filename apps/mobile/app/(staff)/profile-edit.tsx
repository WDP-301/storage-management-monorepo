import { useRouter } from 'expo-router';
import { useSession } from '../../lib/session';
import { EditProfileScreen } from '../../src/features/settings/EditProfileScreen';

export default function StaffProfileEditRoute() {
  const router = useRouter();
  const { user, authenticate } = useSession();

  if (!user) return null;

  return (
    <EditProfileScreen
      includeCustomerFields={false}
      onBack={() => router.navigate('/(staff)/settings')}
      onUserUpdated={authenticate}
      user={user}
    />
  );
}
