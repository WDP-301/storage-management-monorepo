import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ShelfItemView } from '@storage/types';
import { Button, useThemeColor } from 'heroui-native';
import { CalendarBlank, Plus, X } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import {
  addNewLine,
  type NewItemLine,
  toDropOffRequestInput,
} from '../../../lib/drop-off-request-draft';
import { formatIsoDate } from '../../../lib/format-vi';
import {
  availableHours,
  hourLabel,
  lastRequestDay,
  NOTE_MAX,
  vietnamToday,
} from '../../../lib/pickup-request-draft';
import { MAX_QUANTITY, nameKey } from '../../../lib/shelf-receipt-draft';
import { ShelfStorageApi } from '../../../lib/shelf-storage-api';
import { shelfErrorMessage } from '../../../lib/shelf-storage-format';
import { MonthCalendar } from './MonthCalendar';
import { Stepper } from './PickupRequestForm';

const ACCENT = 'hsl(203 100% 30%)';

/** What the customer will bring (more of an item on the shelf, or new items), and when. */
export function DropOffRequestForm({
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
  const [newLines, setNewLines] = useState<NewItemLine[]>([]);
  const [newName, setNewName] = useState('');
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
    if (hour !== null && !availableHours(iso, Date.now()).includes(hour)) setHour(null);
  };

  const addTyped = () => {
    // A name already on the shelf tops that item up instead of creating a duplicate line.
    const existing = items.find((item) => nameKey(item.name) === nameKey(newName));
    if (existing) {
      setQuantities((current) => ({
        ...current,
        [existing.id]: Math.min((current[existing.id] ?? 0) + 1, MAX_QUANTITY),
      }));
    } else {
      setNewLines((lines) => addNewLine(lines, newName));
    }
    setNewName('');
  };

  const setNewQuantity = (key: string, quantity: number) =>
    setNewLines((lines) =>
      quantity <= 0
        ? lines.filter((line) => line.key !== key)
        : lines.map((line) => (line.key === key ? { ...line, quantity } : line)),
    );

  const submit = async () => {
    const draft = toDropOffRequestInput(items, quantities, newLines, dayIso, hour, note);
    if ('error' in draft) {
      setError(draft.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ShelfStorageApi.createDropOffRequest(contractId, draft.input);
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
          Yêu cầu gửi đồ
        </Text>
        <Text className="font-body mt-1 text-caption leading-5 text-muted">
          Báo trước món bạn sẽ mang tới và thời gian tới. Kho xác nhận rồi bạn đưa mã gửi / lấy đồ
          cho nhân viên khi tới.
        </Text>
      </View>

      {items.length > 0 ? (
        <View className="gap-2">
          <Text className="text-body-sm font-strong text-foreground">Thêm vào món đang gửi</Text>
          {items.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="font-body text-body-md text-foreground">{item.name}</Text>
                <Text className="font-body text-caption text-muted">Trên kệ: {item.quantity}</Text>
              </View>
              <Stepper
                value={quantities[item.id] ?? 0}
                max={MAX_QUANTITY}
                onChange={(next) => setQuantities((current) => ({ ...current, [item.id]: next }))}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-body-sm font-strong text-foreground">Món mới</Text>
        <View className="flex-row items-center gap-2">
          <BottomSheetTextInput
            accessibilityLabel="Tên món mới"
            className="font-body flex-1 rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-body-sm text-foreground"
            placeholder="VD: Thùng quần áo"
            placeholderTextColor={mutedColor}
            value={newName}
            onChangeText={setNewName}
            maxLength={120}
            returnKeyType="done"
            onSubmitEditing={addTyped}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm món mới"
            className={`size-10 items-center justify-center rounded-lg bg-accent ${newName.trim() ? '' : 'opacity-40'}`}
            disabled={!newName.trim()}
            onPress={addTyped}
          >
            <Plus color="white" size={18} weight="bold" />
          </Pressable>
        </View>
        {newLines.map((line) => (
          <View key={line.key} className="flex-row items-center justify-between gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Bỏ ${line.name}`}
              className="flex-1 flex-row items-center gap-2"
              onPress={() => setNewQuantity(line.key, 0)}
            >
              <X color={mutedColor} size={14} weight="bold" />
              <Text className="flex-1 font-body text-body-md text-foreground">{line.name}</Text>
            </Pressable>
            <Stepper
              value={line.quantity}
              max={MAX_QUANTITY}
              onChange={(next) => setNewQuantity(line.key, next)}
            />
          </View>
        ))}
      </View>

      <View className="gap-2">
        <Text className="text-body-sm font-strong text-foreground">Ngày gửi đồ</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn ngày gửi đồ"
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
          <Text className="text-body-sm font-strong text-foreground">Giờ gửi đồ</Text>
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
          placeholder="VD: mình mang tới bằng xe máy, cần người phụ bê…"
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
