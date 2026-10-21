import { Text, View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { addDaysIso } from '../../../lib/settlement-format';
import { MonthCalendar } from './MonthCalendar';

/** The API accepts a return day from today (Vietnam) to this many days ahead. */
export const RETURN_MAX_DAYS_AHEAD = 365;

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
  const maxIso = addDaysIso(todayIso, RETURN_MAX_DAYS_AHEAD);
  return (
    <View className="rounded-lg border border-border p-3">
      {lastDayIso ? (
        <Text className="font-body text-body-sm text-muted">
          Hạn HĐ: đến hết {formatIsoDate(lastDayIso)}
        </Text>
      ) : null}
      <Text className="font-body mt-1 text-caption text-muted">
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
