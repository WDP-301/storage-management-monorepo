import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { CalendarBlank } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { formatVnTime } from '../../../lib/receiving-time';
import { Button, colors, InlineMessage, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import { contractEndIso, contractWarehouseName, openReturn } from './contract-display';
import { OfficeTimeChips } from './OfficeTimeChips';
import { RefundAccountFields } from './RefundAccountFields';
import { ReturnDatePicker } from './ReturnDatePicker';
import { ReturnPreviewNotice } from './ReturnPreviewNotice';
import { useReturnRequestForm } from './use-return-request-form';

/** New return request, or "Đổi lịch" of the open one when the contract already has it. */
export function ReturnRequestForm({
  contract,
  onDone,
}: {
  contract: ApiContract;
  onDone: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const pending = openReturn(contract);
  const form = useReturnRequestForm(contract.id, pending, onDone);
  const isEdit = pending !== null;

  const submitHint = !form.dayIso
    ? 'Chọn ngày trả kho để tiếp tục'
    : !form.scheduledAt
      ? 'Chọn giờ trả kho để tiếp tục'
      : form.preview.isLoading
        ? 'Đang kiểm tra thông tin trả kho…'
        : form.accountProblem;

  return (
    <View className="gap-4 px-4 pt-2">
      <View>
        <Text className="text-title font-bold text-text-primary">
          {isEdit ? 'Đổi lịch trả kho' : 'Yêu cầu trả kho'} {contractWarehouseName(contract)}
        </Text>
        <Text className="mt-1 text-caption leading-5 text-text-secondary">
          Chọn ngày và giờ hành chính bạn qua dọn đồ. Nhân viên trực ca giờ đó sẽ kiểm tra kho cùng
          bạn và lập biên trả.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">Ngày trả kho</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn ngày trả kho"
          className="flex-row items-center gap-2 rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3"
          onPress={() => setCalendarOpen((open) => !open)}
        >
          <CalendarBlank color={colors.semantic.actionPrimary} size={18} weight="bold" />
          <Text
            className={`flex-1 text-body-sm ${form.dayIso ? 'font-medium text-text-primary tabular-nums' : 'text-text-secondary'}`}
          >
            {form.dayIso
              ? `${formatIsoDate(form.dayIso)}${form.scheduledAt ? ` · ${formatVnTime(form.scheduledAt)}` : ''}`
              : 'Chọn ngày'}
          </Text>
        </Pressable>
        {calendarOpen ? (
          <ReturnDatePicker
            todayIso={form.today}
            selectedIso={form.dayIso}
            lastDayIso={contract.termEndAt ? contractEndIso(contract) : null}
            onSelect={(iso) => {
              form.setDayIso(iso);
              setCalendarOpen(false);
            }}
          />
        ) : null}
        <ReturnPreviewNotice
          preview={form.preview.preview}
          isLoading={form.preview.isLoading}
          error={form.preview.error}
        />
      </View>

      <OfficeTimeChips label="Giờ trả kho" slots={form.slots} />

      <RefundAccountFields
        draft={form.account}
        onChange={form.changeAccount}
        required={form.accountRequired}
        hint={form.accountHint}
      />

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">
          Ghi chú (không bắt buộc)
        </Text>
        <BottomSheetTextInput
          className="min-h-20 rounded-xl border border-border-default bg-bg-subtle px-4 py-3 font-inter text-body text-text-primary"
          placeholder="VD: mình qua buổi sáng, cần xe đẩy…"
          placeholderTextColor={colors.semantic.textPlaceholder}
          value={form.note}
          onChangeText={form.setNote}
          maxLength={1000}
          multiline
          textAlignVertical="top"
        />
      </View>

      {form.error ? <InlineMessage message={form.error} type="error" /> : null}
      {!form.canSubmit && !form.isSubmitting && submitHint ? (
        <InlineMessage message={submitHint} type="info" />
      ) : null}
      <Button
        disabled={!form.canSubmit}
        fullWidth
        label={form.isSubmitting ? 'Đang gửi…' : isEdit ? 'Lưu thay đổi' : 'Gửi yêu cầu'}
        loading={form.isSubmitting}
        onPress={() => void form.submit()}
      />
    </View>
  );
}
