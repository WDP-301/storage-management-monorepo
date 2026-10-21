import { type BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Button, useThemeColor } from 'heroui-native';
import { CalendarBlank } from 'phosphor-react-native';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import type { ApiContract } from '../../types/contract-api';
import { contractEndIso, contractWarehouseName, openReturn } from './contract-display';
import { RefundAccountFields } from './RefundAccountFields';
import { ReturnDatePickerSheet } from './ReturnDatePickerSheet';
import { ReturnPreviewNotice } from './ReturnPreviewNotice';
import { useReturnRequestForm } from './use-return-request-form';

const ACCENT = 'hsl(203 100% 30%)';

/** New return request, or "Đổi lịch" of the open one when the contract already has it. */
export function ReturnRequestForm({
  contract,
  onDone,
}: {
  contract: ApiContract;
  onDone: () => void;
}) {
  const [mutedColor] = useThemeColor(['muted']);
  const dateSheet = useRef<BottomSheetModal>(null);
  const pending = openReturn(contract);
  const form = useReturnRequestForm(contract.id, pending, onDone);
  const isEdit = pending !== null;

  return (
    <View className="gap-4 px-4">
      <View>
        <Text className="text-title-md font-strong tracking-tight text-foreground">
          {isEdit ? 'Đổi lịch trả kho' : 'Yêu cầu trả kho'} {contractWarehouseName(contract)}
        </Text>
        <Text className="font-body mt-1 text-caption leading-5 text-muted">
          Chọn ngày bạn qua dọn đồ. Nhân viên sẽ kiểm tra kho cùng bạn và lập biên trả.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-body-sm font-strong text-foreground">Ngày trả kho</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn ngày trả kho"
          className="flex-row items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-3"
          onPress={() => dateSheet.current?.present()}
        >
          <CalendarBlank color={ACCENT} size={18} weight="bold" />
          <Text
            className={`flex-1 text-body-sm ${form.dayIso ? 'font-numeric text-foreground' : 'font-body text-muted'}`}
          >
            {form.dayIso ? formatIsoDate(form.dayIso) : 'Chọn ngày'}
          </Text>
        </Pressable>
        <ReturnPreviewNotice
          preview={form.preview.preview}
          isLoading={form.preview.isLoading}
          error={form.preview.error}
          movedEarlier={form.movedEarlier}
        />
      </View>

      <RefundAccountFields
        draft={form.account}
        onChange={form.changeAccount}
        required={form.accountRequired}
        mutedColor={mutedColor}
      />

      <View className="gap-2">
        <Text className="text-body-sm font-strong text-foreground">Ghi chú (không bắt buộc)</Text>
        <BottomSheetTextInput
          className="font-body min-h-20 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground"
          placeholder="VD: mình qua buổi sáng, cần xe đẩy…"
          placeholderTextColor={mutedColor}
          value={form.note}
          onChangeText={form.setNote}
          maxLength={1000}
          multiline
          textAlignVertical="top"
        />
      </View>

      {form.error ? <Text className="font-body text-body-sm text-danger">{form.error}</Text> : null}
      <Button isDisabled={!form.canSubmit} onPress={() => void form.submit()}>
        <Button.Label>
          {form.isSubmitting ? 'Đang gửi…' : isEdit ? 'Lưu thay đổi' : 'Gửi yêu cầu'}
        </Button.Label>
      </Button>

      <ReturnDatePickerSheet
        sheetRef={dateSheet}
        todayIso={form.today}
        selectedIso={form.dayIso}
        lastDayIso={contract.termEndAt ? contractEndIso(contract) : null}
        onSelect={form.setDayIso}
      />
    </View>
  );
}
