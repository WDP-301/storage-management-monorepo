import { Redirect } from 'expo-router';
import { useSession } from '../lib/session';
import { SessionLoadingScreen } from '../src/features/auth/SessionLoadingScreen';

export default function IndexRoute() {
  const { user, isCheckingSession } = useSession();

  if (isCheckingSession) {
    return <SessionLoadingScreen />;
  }

  return <Redirect href={user ? '/(tabs)/browse' : '/login'} />;
}
