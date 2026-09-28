import { Redirect } from 'expo-router';
import { AREA_HOME } from '../lib/app-area';
import { useSession } from '../lib/session';

export default function IndexRoute() {
  const { area } = useSession();

  return <Redirect href={area ? AREA_HOME[area] : '/login'} />;
}
