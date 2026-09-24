import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useSession } from '../lib/session';
import { LoginScreen } from '../src/features/auth/LoginScreen';

const SafeAreaView = withUniwind(RNSafeAreaView);

export default function LoginRoute() {
  const { authenticate } = useSession();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LoginScreen onAuthenticated={authenticate} />
    </SafeAreaView>
  );
}
