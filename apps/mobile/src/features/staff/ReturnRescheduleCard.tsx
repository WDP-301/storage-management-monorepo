import { Button } from 'heroui-native';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { RentalDateStrip } from '../customer/RentalDateStrip';
import { Section } from './InspectionEditor';
import {
  appointmentDayIso,
  isMovedEarlier,
  RESCHEDULE_EARLIER_NOTE,
  rescheduleOptions,
  vietnamDayIso,
} from './return-dates';
import type { useInspectionDetail } from './use-inspection-detail';

type Props = { detail: ReturnType<typeof useInspectionDetail> };

/** Moves the appointment of an open return. Separate from the form: it saves on its own. */
export function ReturnRescheduleCard({ detail }: Props) {
  const { inspection, busy } = detail;
  const today = vietnamDayIso(new Date());
  const options = useMemo(() => rescheduleOptions(today), [today]);
  const [pickedIso, setPickedIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!inspection) return null;

  const current = appointmentDayIso(inspection);
  // Starts on the current appointment when the strip reaches it, so the change is visible.
  const selectedIso =
    pickedIso ?? (current && options.some((option) => option.iso === current) ? current : '');
  const canSave = selectedIso !== '' && selectedIso !== current && busy === null;

  const save = async () => {
    setError(null);
    const failure = await detail.reschedule(selectedIso);
    if (failure) setError(failure);
    else setPickedIso(null);
  };

  return (
    <Section title="Đổi ngày hẹn trả kho">
      <Text className="font-body text-body-sm text-muted">
        {current ? `Đang hẹn ${formatIsoDate(current)}` : 'Chưa hẹn ngày'}
      </Text>
      <RentalDateStrip options={options} selectedIso={selectedIso} onSelect={setPickedIso} />
      {selectedIso && isMovedEarlier(inspection, selectedIso) ? (
        <Text className="font-body text-body-sm text-muted">{RESCHEDULE_EARLIER_NOTE}</Text>
      ) : null}
      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      <Button variant="secondary" isDisabled={!canSave} onPress={() => void save()}>
        <Button.Label>{busy === 'rescheduling' ? 'Đang lưu…' : 'Lưu ngày hẹn'}</Button.Label>
      </Button>
    </Section>
  );
}
