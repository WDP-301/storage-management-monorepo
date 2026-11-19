import { View } from 'react-native';
import { useReturnSettings } from '../../../lib/client-settings';
import { formatIsoDate } from '../../../lib/format-vi';
import { addDaysIso } from '../../../lib/settlement-format';
import { Text } from '../../components/ui';
import { MonthCalendar } from './MonthCalendar';

type Props = {
  todayIso: string;
  selectedIso: string | null;
  /** Last day of the contract term; returning after it is charged per day. */
  lastDayIso: string | null;
  onSelect: (iso: string) => void;
};

/**
 * Calendar for the move-out day, rendered inline in the return sheet. A second bottom
 * sheet on top of it would hide the return form and swallow taps on Android.
 * Nothing is pre-selected: the customer has to pick a day.
 */
export function ReturnDatePicker({ todayIso, selectedIso, lastDayIso, onSelect }: Props) {
  // The API accepts a return day from today (Vietnam) to the configured horizon.
  const { maxDaysAhead } = useReturnSettings();
  const maxIso = addDaysIso(todayIso, maxDaysAhead);
  return (
    <View className="rounded-2xl border border-border-default bg-bg-card p-3.5">
      {lastDayIso ? (
        <Text className="text-body-sm text-text-secondary">
          Hạn HĐ: đến hết {formatIsoDate(lastDayIso)}
        </Text>
      ) : null}
      <Text className="mt-1 text-caption text-text-secondary">
        Có thể chọn đến {formatIsoDate(maxIso)}
      </Text>
      <View className="mt-3">
        <MonthCalendar
          minIso={todayIso}
          maxIso={maxIso}
          selectedIso={selectedIso}
          markedIso={lastDayIso}
          onSelect={onSelect}
        />
      </View>
    </View>
  );
}
