import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ShelfItemUnit, ShelfItemView } from '@storage/types';
import { CalendarBlank, Plus, X } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
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
import {
  DEFAULT_UNIT,
  quantityWithUnit,
  shelfErrorMessage,
  unitLabel,
} from '../../../lib/shelf-storage-format';
import { UnitPicker } from '../../components/UnitPicker';
import { Button, colors, InlineMessage, TabChip, Text } from '../../components/ui';
import { MonthCalendar } from './MonthCalendar';
import { Stepper } from './PickupRequestForm';

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
  const [today] = useState(() => vietnamToday(Date.now()));
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [newLines, setNewLines] = useState<NewItemLine[]>([]);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState<ShelfItemUnit>(DEFAULT_UNIT);
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
      setNewLines((lines) => addNewLine(lines, newName, newUnit));
    }
    setNewName('');
    setNewUnit(DEFAULT_UNIT);
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
    <View className="gap-4 px-4 pt-2">
      <View>
        <Text className="text-title font-bold text-text-primary">Yêu cầu gửi đồ</Text>
        <Text className="mt-1 text-caption leading-5 text-text-secondary">
          Báo trước món bạn sẽ mang tới và thời gian tới. Kho xác nhận rồi bạn đưa mã gửi / lấy đồ
          cho nhân viên khi tới.
        </Text>
      </View>

      {items.length > 0 ? (
        <View className="gap-2">
          <Text className="text-body-sm font-semibold text-text-primary">
            Thêm vào món đang gửi
          </Text>
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
                max={MAX_QUANTITY}
                onChange={(next) => setQuantities((current) => ({ ...current, [item.id]: next }))}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">Món mới</Text>
        <View className="flex-row items-center gap-2">
          <BottomSheetTextInput
            accessibilityLabel="Tên món mới"
            className="flex-1 rounded-xl border border-border-default bg-bg-subtle px-3.5 py-2.5 font-inter text-body text-text-primary"
            placeholder="VD: Thùng quần áo"
            placeholderTextColor={colors.semantic.textPlaceholder}
            value={newName}
            onChangeText={setNewName}
            maxLength={120}
            returnKeyType="done"
            onSubmitEditing={addTyped}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm món mới"
            className={`size-11 items-center justify-center rounded-xl bg-action-primary ${newName.trim() ? '' : 'opacity-40'}`}
            disabled={!newName.trim()}
            onPress={addTyped}
          >
            <Plus color={colors.semantic.textInverse} size={18} weight="bold" />
          </Pressable>
        </View>
        <UnitPicker value={newUnit} onChange={setNewUnit} />
        {newLines.map((line) => (
          <View key={line.key} className="flex-row items-center justify-between gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Bỏ ${line.name}`}
              className="flex-1 flex-row items-center gap-2"
              onPress={() => setNewQuantity(line.key, 0)}
            >
              <X color={colors.semantic.textSecondary} size={14} weight="bold" />
              <Text className="flex-1 text-body text-text-primary">
                {line.name} · {unitLabel(line.unit)}
              </Text>
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
        <Text className="text-body-sm font-semibold text-text-primary">Ngày gửi đồ</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn ngày gửi đồ"
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
              maxIso={lastRequestDay(today)}
              selectedIso={dayIso}
              onSelect={pickDay}
            />
          </View>
        ) : null}
      </View>

      {dayIso ? (
        <View className="gap-2">
          <Text className="text-body-sm font-semibold text-text-primary">Giờ gửi đồ</Text>
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
          placeholder="VD: mình mang tới bằng xe máy, cần người phụ bê…"
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
