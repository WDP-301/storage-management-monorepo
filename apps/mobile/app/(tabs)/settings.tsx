import { useSession } from '../../lib/session';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';

export default function SettingsRoute() {
  const { user, isLoggingOut, logout } = useSession();

  if (!user) return null;

  return <SettingsScreen user={user} isLoggingOut={isLoggingOut} onLogout={logout} />;
}
