import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Button, useThemeColor } from 'heroui-native';
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  MagnifyingGlass,
} from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ChangeRequestsApi, type UnitChangeOption } from '../../../lib/change-requests-api';
import { formatArea, formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { ReceivingSlotsApi } from '../../../lib/receiving-slots-api';
import type { ReceivingDay } from '../../../lib/receiving-time';
import {
  defaultInstant,
  formatVnTime,
  isWithinWindows,
  timeOptionsForDate,
} from '../../../lib/receiving-time';
import { fromIsoDate, todayIso, toIsoDate } from '../../../lib/rental-schedule';
import { ChoiceChip } from '../../components/ChoiceChip';
import type { ApiContract } from '../../types/contract-api';
import { contractWarehouseName } from './contract-display';
import { ChipButton } from './FilterChips';
import { MonthCalendar } from './MonthCalendar';

const ACCENT = 'hsl(203 100% 30%)';
const MOVE_MAX_DAYS_AHEAD = 90;
const PAGE_SIZE = 5;

/** Accent-free lowercase match so "di an" finds "Kho Dĩ An". */
function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/** New unit-change request: pick the destination, the move day, then send. */
export function UnitChangeRequestForm({
  contract,
  onDone,
}: {
  contract: ApiContract;
  onDone: () => void;
}) {
  const [mutedColor] = useThemeColor(['muted']);
  const [options, setOptions] = useState<UnitChangeOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'unit'>('details');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [facilityId, setFacilityId] = useState<string | 'all'>('all');
  const [page, setPage] = useState(0);
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<ReceivingDay[]>([]);
  const [moveAt, setMoveAt] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minIso = useMemo(() => addDays(todayIso(), 1), []);
  const maxIso = useMemo(() => addDays(todayIso(), MOVE_MAX_DAYS_AHEAD), []);

  useEffect(() => {
    const controller = new AbortController();
    ChangeRequestsApi.options(contract.id, controller.signal)
      .then(setOptions)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          e instanceof ApiError ? e.message : 'Không tải được danh sách kho. Vui lòng thử lại.',
        );
      });
    return () => controller.abort();
  }, [contract.id]);

  // The move time must land inside an OFFICE window, so the slots come from the server rather than
  // being picked freely. Refetched whenever the chosen day changes.
  useEffect(() => {
    if (!dayIso) {
      setSlots([]);
      setMoveAt(null);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    ReceivingSlotsApi.list(dayIso, dayIso)
      .then((days) => {
        if (cancelled) return;
        setSlots(days);
        setMoveAt(defaultInstant(days, dayIso));
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
        setMoveAt(null);
        setSlotsError('Không tải được khung giờ. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayIso]);

  const facilities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const option of options ?? []) {
      if (!seen.has(option.unit.facility_id)) {
        seen.set(option.unit.facility_id, option.unit.facility_name);
      }
    }
    return [...seen.entries()];
  }, [options]);

  const visible = useMemo(() => {
    const needle = normText(query.trim());
    return (options ?? []).filter((option) => {
      if (facilityId !== 'all' && option.unit.facility_id !== facilityId) return false;
      if (!needle) return true;
      const haystack = normText(
        `${option.unit.name} ${option.unit.code} ${option.unit.facility_name}`,
      );
      return haystack.includes(needle);
    });
  }, [options, query, facilityId]);

  // A new search or facility choice drops the user back on the first page.
  useEffect(() => setPage(0), [query, facilityId]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const selected = options?.find((o) => o.unit.id === selectedId) ?? null;
  const timeOptions = useMemo(() => timeOptionsForDate(slots, dayIso ?? ''), [slots, dayIso]);
  // The pick only counts while it still falls inside the shown day's windows.
  const chosenMoveAt = dayIso && moveAt && isWithinWindows(slots, dayIso, moveAt) ? moveAt : null;
  const canContinue = chosenMoveAt !== null && reason.trim().length > 0;
  const canSubmit = selected !== null && canContinue && !isSubmitting;

  const submit = async () => {
    if (!selected || !chosenMoveAt) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await ChangeRequestsApi.create({
        contractId: contract.id,
        newUnitId: selected.unit.id,
        reason: reason.trim(),
        moveAt: chosenMoveAt,
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };

  return (
    <View className="gap-4 px-4">
      <View>
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="text-title-md font-strong tracking-tight text-foreground">
            Đổi kho {contractWarehouseName(contract)}
          </Text>
          <Text className="font-ui text-caption text-muted">
            Bước {step === 'details' ? 1 : 2}/2
          </Text>
        </View>
        <Text className="font-body mt-1 text-caption leading-5 text-muted">
          {step === 'details'
            ? 'Chọn ngày, giờ hành chính bạn sẽ qua chuyển đồ và lý do đổi kho. Kho mới được giữ chỗ sau khi quản lý duyệt.'
            : 'Chọn kho muốn chuyển tới. Kho mới được giữ chỗ sau khi quản lý duyệt.'}
        </Text>
      </View>

      {step === 'details' ? (
        <>
          <View className="gap-2">
            <Text className="text-body-sm font-strong text-foreground">Ngày chuyển đồ</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn ngày chuyển kho"
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
              <MonthCalendar
                minIso={minIso}
                maxIso={maxIso}
                selectedIso={dayIso}
                onSelect={(iso) => {
                  setDayIso(iso);
                  setSlots([]);
                  setMoveAt(null);
                  setCalendarOpen(false);
                }}
              />
            ) : null}
          </View>

          <View className="gap-2">
            <Text className="text-body-sm font-strong text-foreground">Giờ chuyển đồ</Text>
            {dayIso === null ? (
              <Text className="font-body text-body-sm text-muted">Chọn ngày chuyển đồ trước.</Text>
            ) : slotsLoading ? (
              <Text className="font-body text-body-sm text-muted">Đang tải khung giờ…</Text>
            ) : slotsError !== null ? (
              <Text className="font-body text-body-sm text-danger">{slotsError}</Text>
            ) : timeOptions.length === 0 ? (
              <Text className="font-body text-body-sm text-danger">
                Ngày này không còn khung giờ hành chính. Vui lòng chọn ngày khác.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {timeOptions.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    isSelected={chosenMoveAt === option.value}
                    label={option.label}
                    onPress={() => setMoveAt(option.value)}
                  />
                ))}
              </View>
            )}
          </View>

          <View className="gap-2">
            <Text className="text-body-sm font-strong text-foreground">Lý do đổi kho</Text>
            <BottomSheetTextInput
              className="font-body min-h-20 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground"
              placeholder="VD: cần kho rộng hơn, muốn chuyển gần nhà…"
              placeholderTextColor={mutedColor}
              value={reason}
              onChangeText={setReason}
              maxLength={1000}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Button isDisabled={!canContinue} onPress={() => setStep('unit')}>
            <Button.Label>Tiếp tục chọn kho</Button.Label>
          </Button>
        </>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại bước chọn ngày và lý do"
            hitSlop={8}
            className="self-start"
            onPress={() => setStep('details')}
          >
            <Text className="font-ui text-body-sm text-accent">
              ← {dayIso ? formatIsoDate(dayIso) : 'Chọn ngày'}
              {chosenMoveAt ? ` · ${formatVnTime(chosenMoveAt)}` : ''} · đổi lại lựa chọn
            </Text>
          </Pressable>

          <View className="gap-2">
            <Text className="text-body-sm font-strong text-foreground">Kho muốn chuyển tới</Text>
            {options !== null && options.length > 1 ? (
              <>
                <View className="flex-row items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3">
                  <MagnifyingGlass color={mutedColor} size={16} weight="bold" />
                  <BottomSheetTextInput
                    className="flex-1 font-body py-2.5 text-body-sm text-foreground"
                    placeholder="Tìm theo tên, mã kho hoặc chi nhánh…"
                    placeholderTextColor={mutedColor}
                    value={query}
                    onChangeText={setQuery}
                    accessibilityLabel="Tìm kho muốn chuyển tới"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {facilities.length > 1 ? (
                  <View className="flex-row flex-wrap gap-2">
                    <ChipButton
                      label="Tất cả"
                      isSelected={facilityId === 'all'}
                      onPress={() => setFacilityId('all')}
                    />
                    {facilities.map(([id, name]) => (
                      <ChipButton
                        key={id}
                        label={name}
                        isSelected={facilityId === id}
                        onPress={() => setFacilityId(facilityId === id ? 'all' : id)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            {options === null && loadError === null ? (
              <ActivityIndicator color={ACCENT} />
            ) : loadError !== null || options === null ? (
              <Text className="font-body text-body-sm text-danger">{loadError}</Text>
            ) : options.length === 0 ? (
              <Text className="font-body text-body-sm text-muted">
                Hiện không còn kho cùng loại nào trống.
              </Text>
            ) : visible.length === 0 ? (
              <Text className="font-body text-body-sm text-muted">
                Không có kho nào khớp tìm kiếm — thử từ khoá hoặc chi nhánh khác.
              </Text>
            ) : (
              <>
                {pageItems.map((option) => {
                  const isSelected = option.unit.id === selectedId;
                  return (
                    <Pressable
                      key={option.unit.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      className={`flex-row items-center gap-3 rounded-lg border px-3 py-3 ${
                        isSelected
                          ? 'border-accent bg-accent/5'
                          : 'border-border bg-surface-secondary'
                      }`}
                      onPress={() => setSelectedId(option.unit.id)}
                    >
                      <View className="flex-1 gap-0.5">
                        <Text className="font-strong text-body-sm text-foreground">
                          {option.unit.name}
                        </Text>
                        <Text className="font-numeric text-caption text-muted">
                          {option.unit.code}
                        </Text>
                        <Text className="font-body text-caption text-muted">
                          {option.unit.facility_name}
                          {option.unit.area_m2 !== null
                            ? ` · ${formatArea(option.unit.area_m2)}`
                            : ''}
                        </Text>
                        <Text className="font-body text-caption text-muted">
                          {formatMoney(option.unit.monthly_price)}/tháng
                          {option.rent_difference !== 0
                            ? ` (${option.rent_difference > 0 ? '+' : '−'}${formatMoney(Math.abs(option.rent_difference))}/tháng)`
                            : ''}
                        </Text>
                        {option.deposit_difference > 0 ? (
                          <Text className="font-body text-caption text-warning">
                            Bù cọc thêm {formatMoney(option.deposit_difference)}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected ? <Check color={ACCENT} size={20} weight="bold" /> : null}
                    </Pressable>
                  );
                })}
                {pageCount > 1 ? (
                  <View className="flex-row items-center justify-center gap-4 pt-1">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Trang trước"
                      accessibilityState={{ disabled: safePage === 0 }}
                      hitSlop={8}
                      disabled={safePage === 0}
                      style={({ pressed }) => ({
                        opacity: safePage === 0 ? 0.3 : pressed ? 0.6 : 1,
                      })}
                      onPress={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <CaretLeft color={ACCENT} size={20} weight="bold" />
                    </Pressable>
                    <Text className="font-numeric text-body-sm text-muted">
                      Trang {safePage + 1} / {pageCount}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Trang sau"
                      accessibilityState={{ disabled: safePage >= pageCount - 1 }}
                      hitSlop={8}
                      disabled={safePage >= pageCount - 1}
                      style={({ pressed }) => ({
                        opacity: safePage >= pageCount - 1 ? 0.3 : pressed ? 0.6 : 1,
                      })}
                      onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      <CaretRight color={ACCENT} size={20} weight="bold" />
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
          <Button isDisabled={!canSubmit} onPress={() => void submit()}>
            <Button.Label>{isSubmitting ? 'Đang gửi…' : 'Gửi yêu cầu đổi kho'}</Button.Label>
          </Button>
        </>
      )}
    </View>
  );
}

function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}
