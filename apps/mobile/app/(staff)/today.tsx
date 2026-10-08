import { useRouter } from 'expo-router';
import { StaffTodayScreen } from '../../src/features/staff/StaffTodayScreen';

export default function StaffTodayRoute() {
  const router = useRouter();
  return (
    <StaffTodayScreen onOpen={(id) => router.navigate(`/(staff)/inspection-detail?id=${id}`)} />
  );
}
