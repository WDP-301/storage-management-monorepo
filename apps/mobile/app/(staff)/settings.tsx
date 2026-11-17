import { useRouter } from 'expo-router';
import { useSession } from '../../lib/session';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  const { user, isLoggingOut, logout } = useSession();

  if (!user) return null;

  return (
    <SettingsScreen
      isLoggingOut={isLoggingOut}
      onChangePassword={() => router.navigate('/(staff)/change-password')}
      onEditProfile={() => router.navigate('/(staff)/profile-edit')}
      onLogout={logout}
      onShifts={
        user.roles.includes('FACILITY_STAFF') ? () => router.navigate('/(staff)/shifts') : undefined
      }
      onSupport={() => router.navigate('/(staff)/requests')}
      user={user}
    />
  );
}
