import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ShelfItemView } from '@storage/types';
import { Button, useThemeColor } from 'heroui-native';
import { CalendarBlank, Minus, Plus } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
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
import { shelfErrorMessage } from '../../../lib/shelf-storage-format';
import { MonthCalendar } from './MonthCalendar';

const ACCENT = 'hsl(203 100% 30%)';

function Stepper({
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
        className="size-9 items-center justify-center rounded-full border border-border"
        disabled={value <= 0}
        onPress={() => onChange(value - 1)}
      >
        <Minus color={ACCENT} size={16} weight="bold" />
      </Pressable>
      <Text className="min-w-6 text-center font-numeric text-body-md text-foreground">{value}</Text>
      <Pressable
        accessibilityLabel="Tăng số lượng"
        accessibilityRole="button"
        className="size-9 items-center justify-center rounded-full border border-border"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      >
        <Plus color={ACCENT} size={16} weight="bold" />
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
  const [mutedColor] = useThemeColor(['muted']);
  const [today] = useState(() => vietnamToday(Date.now()));
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
    <View className="gap-4 px-4">
      <View>
        <Text className="text-title-md font-strong tracking-tight text-foreground">
          Yêu cầu lấy đồ
        </Text>
        <Text className="font-body mt-1 text-caption leading-5 text-muted">
          Chọn món cần lấy và thời gian bạn tới. Nhân viên sẽ chuẩn bị sẵn và báo cho bạn.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-body-sm font-strong text-foreground">Đồ cần lấy</Text>
        {items.map((item) => (
          <View key={item.id} className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="font-body text-body-md text-foreground">{item.name}</Text>
              <Text className="font-body text-caption text-muted">Trên kệ: {item.quantity}</Text>
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
        <Text className="text-body-sm font-strong text-foreground">Ngày lấy đồ</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn ngày lấy đồ"
          className="flex-row items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-3"
          onPress={() => setCalendarOpen((open) => !open)}
        >
          <CalendarBlank color={ACCENT} size={18} weight="bold" />
          <Text
            className={`flex-1 text-body-sm ${dayIso ? 'font-numeric text-foreground' : 'font-body text-muted'}`}
          >
            {dayIso ? formatIsoDate(dayIso) : 'Chọn ngày'}
          </Text>
        </Pressable>
        {calendarOpen ? (
          <View className="rounded-lg border border-border p-3">
            <MonthCalendar
              minIso={today}
              maxIso={lastRequestDay(today)}
              selectedIso={dayIso}
              onSelect={pickDay}
            />
          </View>
        ) : null}
      </View>

      {dayIso ? (
        <View className="gap-2">
          <Text className="text-body-sm font-strong text-foreground">Giờ lấy đồ</Text>
          {hours.length === 0 ? (
            <Text className="font-body text-body-sm text-muted">
              Hôm nay đã hết giờ nhận yêu cầu, hãy chọn ngày khác.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {hours.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: hour === value }}
                  className={`rounded-full border px-3 py-1.5 ${hour === value ? 'border-accent bg-accent' : 'border-border bg-surface-secondary'}`}
                  onPress={() => setHour(value)}
                >
                  <Text
                    className={`font-numeric text-body-sm ${hour === value ? 'text-white' : 'text-foreground'}`}
                  >
                    {hourLabel(value)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-body-sm font-strong text-foreground">Ghi chú (không bắt buộc)</Text>
        <BottomSheetTextInput
          className="font-body min-h-20 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground"
          placeholder="VD: mình cần lấy sớm trong giờ nghỉ trưa…"
          placeholderTextColor={mutedColor}
          value={note}
          onChangeText={setNote}
          maxLength={NOTE_MAX}
          multiline
          textAlignVertical="top"
        />
      </View>

      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      <Button isDisabled={busy} onPress={() => void submit()}>
        <Button.Label>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</Button.Label>
      </Button>
    </View>
  );
}
