import { Redirect } from 'expo-router';
import { useSession } from '../lib/session';

export default function IndexRoute() {
  const { user } = useSession();

  return <Redirect href={user ? '/(tabs)/browse' : '/login'} />;
}
