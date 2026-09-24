import { Redirect } from 'expo-router';
import { useHold } from '../../lib/hold';
import { useSession } from '../../lib/session';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';

export default function SettingsRoute() {
  const { clearHold } = useHold();
  const { user, isLoggingOut, logout } = useSession();

  if (!user) {
    return <Redirect href="/login" />;
  }

  const handleLogout = async () => {
    await logout();
    clearHold();
  };

  return <SettingsScreen user={user} isLoggingOut={isLoggingOut} onLogout={handleLogout} />;
}
