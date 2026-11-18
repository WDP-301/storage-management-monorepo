import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ClientUnitChangeSettings } from '@storage/types';
import { CalendarBlank, CaretLeft, CaretRight, MagnifyingGlass } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ChangeRequestsApi, type UnitChangeOption } from '../../../lib/change-requests-api';
import { formatIsoDate } from '../../../lib/format-vi';
import { formatVnTime } from '../../../lib/receiving-time';
import { fromIsoDate, todayIso, toIsoDate } from '../../../lib/rental-schedule';
import { unitChangeErrorMessage } from '../../../lib/unit-change-errors';
import { Button, colors, InlineMessage, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import { contractWarehouseName } from './contract-display';
import { ChipButton } from './FilterChips';
import { MonthCalendar } from './MonthCalendar';
import { OfficeTimeChips } from './OfficeTimeChips';
import { ShelfChangePicker } from './ShelfChangePicker';
import { UnitChangeOptionRow } from './UnitChangeOptionRow';
import { useOfficeTimeSlots } from './use-office-time-slots';

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
/**
 * Settings arrive as props: the form renders inside a BottomSheetModal, which portals to the root
 * BottomSheetModalProvider above ClientSettingsProvider, so it cannot read that context itself.
 */
export function UnitChangeRequestForm({
  contract,
  settings,
  refreshSettings,
  onDone,
}: {
  contract: ApiContract;
  settings: ClientUnitChangeSettings;
  refreshSettings: () => void;
  onDone: () => void;
}) {
  const [options, setOptions] = useState<UnitChangeOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'unit'>('details');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [facilityId, setFacilityId] = useState<string | 'all'>('all');
  const [page, setPage] = useState(0);
  const [dayIso, setDayIso] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A shelf moves to another shelf, picked on the floor plan; other units keep the list.
  const isShelf = contract.unit?.kind === 'SHELF';
  const noun = isShelf ? 'kệ' : 'kho';

  // The admin-configured window: minimum notice and furthest day a move can be booked.
  const { minLeadDays, maxDaysAhead } = settings;
  const minIso = useMemo(() => addDays(todayIso(), minLeadDays), [minLeadDays]);
  const maxIso = useMemo(() => addDays(todayIso(), maxDaysAhead), [maxDaysAhead]);

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

  // The move time must land inside an OFFICE window, so the slots come from the server.
  const slots = useOfficeTimeSlots(dayIso);

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
  const chosenMoveAt = slots.chosen;
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
      setError(unitChangeErrorMessage(e, 'Gửi yêu cầu thất bại. Vui lòng thử lại.'));
      setIsSubmitting(false);
      // The window may have changed since it was loaded; the calendar picks up the live one.
      refreshSettings();
    }
  };

  return (
    <View className="gap-4 px-4 pt-2">
      <View>
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="flex-1 text-title font-bold text-text-primary">
            Đổi {noun} {contractWarehouseName(contract)}
          </Text>
          <Text className="text-caption font-semibold text-text-secondary">
            Bước {step === 'details' ? 1 : 2}/2
          </Text>
        </View>
        <Text className="mt-1 text-caption leading-5 text-text-secondary">
          {step === 'details'
            ? `Chọn ngày, giờ hành chính bạn sẽ qua chuyển đồ và lý do đổi ${noun}. ${isShelf ? 'Kệ' : 'Kho'} mới được giữ chỗ sau khi quản lý duyệt.`
            : isShelf
              ? 'Chạm vào kệ trên sơ đồ để chọn kệ muốn chuyển tới. Kệ mới được giữ chỗ sau khi quản lý duyệt.'
              : 'Chọn kho muốn chuyển tới. Kho mới được giữ chỗ sau khi quản lý duyệt.'}
        </Text>
      </View>

      {step === 'details' ? (
        <>
          <View className="gap-2">
            <Text className="text-body-sm font-semibold text-text-primary">Ngày chuyển đồ</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn ngày chuyển ${noun}`}
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
                  minIso={minIso}
                  maxIso={maxIso}
                  selectedIso={dayIso}
                  onSelect={(iso) => {
                    setDayIso(iso);
                    setCalendarOpen(false);
                  }}
                />
              </View>
            ) : null}
          </View>

          <OfficeTimeChips label="Giờ chuyển đồ" slots={slots} />

          <View className="gap-2">
            <Text className="text-body-sm font-semibold text-text-primary">Lý do đổi {noun}</Text>
            <BottomSheetTextInput
              className="min-h-20 rounded-xl border border-border-default bg-bg-subtle px-4 py-3 font-inter text-body text-text-primary"
              placeholder={`VD: cần ${noun} rộng hơn, muốn chuyển gần nhà…`}
              placeholderTextColor={colors.semantic.textPlaceholder}
              value={reason}
              onChangeText={setReason}
              maxLength={1000}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Button
            disabled={!canContinue}
            fullWidth
            label={`Tiếp tục chọn ${noun}`}
            onPress={() => setStep('unit')}
          />
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
            <Text className="text-body-sm font-medium text-text-link">
              ← {dayIso ? formatIsoDate(dayIso) : 'Chọn ngày'}
              {chosenMoveAt ? ` · ${formatVnTime(chosenMoveAt)}` : ''} · đổi lại lựa chọn
            </Text>
          </Pressable>

          <View className="gap-2">
            <Text className="text-body-sm font-semibold text-text-primary">
              {isShelf ? 'Kệ' : 'Kho'} muốn chuyển tới
            </Text>
            {!isShelf && options !== null && options.length > 1 ? (
              <>
                <View className="flex-row items-center gap-2 rounded-xl border border-border-default bg-bg-subtle px-3.5">
                  <MagnifyingGlass color={colors.semantic.textSecondary} size={16} weight="bold" />
                  <BottomSheetTextInput
                    className="flex-1 py-2.5 font-inter text-body text-text-primary"
                    placeholder="Tìm theo tên hoặc chi nhánh…"
                    placeholderTextColor={colors.semantic.textPlaceholder}
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
              <ActivityIndicator color={colors.semantic.actionPrimary} />
            ) : loadError !== null || options === null ? (
              <InlineMessage
                message={loadError ?? `Không tải được danh sách ${noun}.`}
                type="error"
              />
            ) : options.length === 0 ? (
              <Text className="text-body-sm text-text-secondary">
                {isShelf
                  ? 'Hiện không còn kệ nào trống để chuyển tới.'
                  : 'Hiện không còn kho cùng loại nào trống.'}
              </Text>
            ) : isShelf ? (
              <ShelfChangePicker
                contract={contract}
                options={options}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : visible.length === 0 ? (
              <Text className="text-body-sm text-text-secondary">
                Không có kho nào khớp tìm kiếm — thử từ khoá hoặc chi nhánh khác.
              </Text>
            ) : (
              <>
                {pageItems.map((option) => (
                  <UnitChangeOptionRow
                    key={option.unit.id}
                    option={option}
                    isSelected={option.unit.id === selectedId}
                    onPress={() => setSelectedId(option.unit.id)}
                  />
                ))}
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
                      <CaretLeft color={colors.semantic.actionPrimary} size={20} weight="bold" />
                    </Pressable>
                    <Text className="text-body-sm text-text-secondary tabular-nums">
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
                      <CaretRight color={colors.semantic.actionPrimary} size={20} weight="bold" />
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {error ? <InlineMessage message={error} type="error" /> : null}
          <Button
            disabled={!canSubmit}
            fullWidth
            label={isSubmitting ? 'Đang gửi…' : `Gửi yêu cầu đổi ${noun}`}
            loading={isSubmitting}
            onPress={() => void submit()}
          />
        </>
      )}
    </View>
  );
}

function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}
