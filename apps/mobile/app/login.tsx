import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useSession } from '../lib/session';
import { LoginScreen } from '../src/features/auth/LoginScreen';
import { SessionLoadingScreen } from '../src/features/auth/SessionLoadingScreen';

const SafeAreaView = withUniwind(RNSafeAreaView);

export default function LoginRoute() {
  const { user, isCheckingSession, authenticate } = useSession();

  if (isCheckingSession) {
    return <SessionLoadingScreen />;
  }

  if (user) {
    return <Redirect href="/(tabs)/browse" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LoginScreen onAuthenticated={authenticate} />
    </SafeAreaView>
  );
}
