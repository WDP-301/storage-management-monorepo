import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useSession } from '../lib/session';
import { UnsupportedRoleScreen } from '../src/features/auth/UnsupportedRoleScreen';

const SafeAreaView = withUniwind(RNSafeAreaView);

export default function UnsupportedRoute() {
  const { user, isLoggingOut, logout } = useSession();

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <UnsupportedRoleScreen user={user} isLoggingOut={isLoggingOut} onLogout={logout} />
    </SafeAreaView>
  );
}
