import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useSession } from '../../lib/session';
import { StaffShiftsScreen } from '../../src/features/staff/StaffShiftsScreen';
import { useStaffShifts } from '../../src/features/staff/use-staff-shifts';

export default function StaffShiftsRoute() {
  const router = useRouter();
  const { user } = useSession();
  const isStaff = user?.roles.includes('FACILITY_STAFF') ?? false;
  const shifts = useStaffShifts(isStaff);

  const leave = useCallback(() => router.navigate('/(staff)/today'), [router]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  return (
    <StaffShiftsScreen
      actionError={shifts.actionError}
      busyShiftId={shifts.busyShiftId}
      error={shifts.error}
      isLoading={shifts.isLoading}
      isStaff={isStaff}
      nowMs={shifts.nowMs}
      onBack={leave}
      onCheckIn={(id) => void shifts.checkIn(id)}
      onCheckOut={(id) => void shifts.checkOut(id)}
      onCurrentWeek={() => shifts.setWeekOffset(0)}
      onNextWeek={() => shifts.setWeekOffset((w) => w + 1)}
      onPrevWeek={() => shifts.setWeekOffset((w) => w - 1)}
      onRefresh={shifts.refetch}
      range={shifts.range}
      shifts={shifts.shifts}
      todayIso={shifts.todayIso}
      weekOffset={shifts.weekOffset}
    />
  );
}
