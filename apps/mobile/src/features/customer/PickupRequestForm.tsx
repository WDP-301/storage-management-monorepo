import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ShelfItemView } from '@storage/types';
import { CalendarBlank, Minus, Plus } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { useShelfRequestSettings } from '../../../lib/client-settings';
import { formatIsoDate } from '../../../lib/format-vi';
import {
  availableHours,
  hourLabel,
  lastRequestDay,
  NOTE_MAX,
  toPickupRequestInput,
  vietnamToday,
} from '../../../lib/pickup-request-draft';
import { ShelfStorageApi } from '../../../lib/shelf-storage-api';
import { quantityWithUnit, shelfErrorMessage } from '../../../lib/shelf-storage-format';
import { Button, colors, InlineMessage, TabChip, Text } from '../../components/ui';
import { MonthCalendar } from './MonthCalendar';

/** − value + control for a request form inside a bottom sheet (no typed input, no keyboard). */
export function Stepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        accessibilityLabel="Giảm số lượng"
        accessibilityRole="button"
        className={`size-9 items-center justify-center rounded-full border border-border-default bg-bg-card ${value <= 0 ? 'opacity-40' : ''}`}
        disabled={value <= 0}
        onPress={() => onChange(value - 1)}
      >
        <Minus color={colors.semantic.actionPrimary} size={16} weight="bold" />
      </Pressable>
      <Text className="min-w-6 text-center text-body font-semibold text-text-primary tabular-nums">
        {value}
      </Text>
      <Pressable
        accessibilityLabel="Tăng số lượng"
        accessibilityRole="button"
        className={`size-9 items-center justify-center rounded-full border border-border-default bg-bg-card ${value >= max ? 'opacity-40' : ''}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      >
        <Plus color={colors.semantic.actionPrimary} size={16} weight="bold" />
      </Pressable>
    </View>
  );
}

/** Items and quantities to take out, plus the day and hour the customer plans to come. */
export function PickupRequestForm({
  contractId,
  items,
  onDone,
}: {
  contractId: string;
  items: ShelfItemView[];
  onDone: () => void;
}) {
  const [today] = useState(() => vietnamToday(Date.now()));
  const { requestMaxDaysAhead } = useShelfRequestSettings();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hours = dayIso ? availableHours(dayIso, Date.now()) : [];
  const pickDay = (iso: string) => {
    setDayIso(iso);
    setCalendarOpen(false);
    // An hour that is not offered on the new day would be sent silently otherwise.
    if (hour !== null && !availableHours(iso, Date.now()).includes(hour)) setHour(null);
  };

  const submit = async () => {
    const draft = toPickupRequestInput(items, quantities, dayIso, hour, note);
    if ('error' in draft) {
      setError(draft.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ShelfStorageApi.createPickupRequest(contractId, draft.input);
      onDone();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? shelfErrorMessage(cause.code, cause.details, cause.message)
          : 'Không gửi được yêu cầu. Vui lòng thử lại.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-4 px-4 pt-2">
      <View>
        <Text className="text-title font-bold text-text-primary">Yêu cầu lấy đồ</Text>
        <Text className="mt-1 text-caption leading-5 text-text-secondary">
          Chọn món cần lấy và thời gian bạn tới. Nhân viên sẽ chuẩn bị sẵn và báo cho bạn.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">Đồ cần lấy</Text>
        {items.map((item) => (
          <View key={item.id} className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-body text-text-primary">{item.name}</Text>
              <Text className="text-caption text-text-secondary">
                Trên kệ: {quantityWithUnit(item.quantity, item.unit)}
              </Text>
            </View>
            <Stepper
              value={quantities[item.id] ?? 0}
              max={item.quantity}
              onChange={(next) => setQuantities((current) => ({ ...current, [item.id]: next }))}
            />
          </View>
        ))}
      </View>

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">Ngày lấy đồ</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn ngày lấy đồ"
          className="flex-row items-center gap-2 rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3"
          onPress={() => setCalendarOpen((open) => !open)}
        >
          <CalendarBlank color={colors.semantic.actionPrimary} size={18} weight="bold" />
          <Text
            className={`flex-1 text-body-sm ${dayIso ? 'font-medium text-text-primary tabular-nums' : 'text-text-secondary'}`}
          >
            {dayIso ? formatIsoDate(dayIso) : 'Chọn ngày'}
          </Text>
        </Pressable>
        {calendarOpen ? (
          <View className="rounded-2xl border border-border-default bg-bg-card p-3.5">
            <MonthCalendar
              minIso={today}
              maxIso={lastRequestDay(today, requestMaxDaysAhead)}
              selectedIso={dayIso}
              onSelect={pickDay}
            />
          </View>
        ) : null}
      </View>

      {dayIso ? (
        <View className="gap-2">
          <Text className="text-body-sm font-semibold text-text-primary">Giờ lấy đồ</Text>
          {hours.length === 0 ? (
            <Text className="text-body-sm text-text-secondary">
              Hôm nay đã hết giờ nhận yêu cầu, hãy chọn ngày khác.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {hours.map((value) => (
                <TabChip
                  key={value}
                  label={hourLabel(value)}
                  onPress={() => setHour(value)}
                  selected={hour === value}
                  tone="primary"
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">
          Ghi chú (không bắt buộc)
        </Text>
        <BottomSheetTextInput
          className="min-h-20 rounded-xl border border-border-default bg-bg-subtle px-4 py-3 font-inter text-body text-text-primary"
          placeholder="VD: mình cần lấy sớm trong giờ nghỉ trưa…"
          placeholderTextColor={colors.semantic.textPlaceholder}
          value={note}
          onChangeText={setNote}
          maxLength={NOTE_MAX}
          multiline
          textAlignVertical="top"
        />
      </View>

      {error ? <InlineMessage message={error} type="error" /> : null}
      <Button
        disabled={busy}
        fullWidth
        label={busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
