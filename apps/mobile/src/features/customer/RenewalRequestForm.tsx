import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { ClientBookingSettings } from '@storage/types';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ContractRenewalsApi } from '../../../lib/contract-renewals-api';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { addDaysIso, vietnamDayIso } from '../../../lib/settlement-format';
import { Button, colors, InlineMessage, TabChip, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';

const NOTE_MAX = 500;

/** Last rental day once `months` more are added to a term ending at `termEndAt`. */
function renewedLastDay(termEndAt: string, months: number): string | null {
  const termEndDay = vietnamDayIso(termEndAt);
  if (!termEndDay) return null;
  const [y, m, d] = termEndDay.split('-').map(Number);
  // Same clamp as the server: 31/01 + 1 month ends on the last day of February.
  const lastOfTarget = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastOfTarget)));
  return addDaysIso(end.toISOString().slice(0, 10), -1);
}

type Props = {
  contract: ApiContract;
  booking: Pick<ClientBookingSettings, 'rentalMonthsOptions' | 'defaultRentalMonths'>;
  onDone: () => void;
};

/** Asks the branch to extend the contract at its current price; a manager approves it. */
export function RenewalRequestForm({ contract, booking, onDone }: Props) {
  const options = contract.renewalMonthsOptions ?? booking.rentalMonthsOptions;
  const [months, setMonths] = useState(
    options.includes(booking.defaultRentalMonths) ? booking.defaultRentalMonths : options[0],
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastDay = contract.termEndAt ? renewedLastDay(contract.termEndAt, months) : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await ContractRenewalsApi.create({ contractId: contract.id, months, note });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không gửi được yêu cầu. Vui lòng thử lại.');
      setBusy(false);
    }
  };

  return (
    <View className="gap-4 px-4 pt-2">
      <View>
        <Text className="text-title font-bold text-text-primary">Gia hạn hợp đồng</Text>
        <Text className="mt-1 text-caption leading-5 text-text-secondary">
          Thuê tiếp với giá hiện tại {formatMoney(contract.monthlyPrice)}/tháng, giữ nguyên tiền
          cọc. Chi nhánh sẽ duyệt yêu cầu và báo cho bạn.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">Thêm bao lâu?</Text>
        <View className="flex-row flex-wrap gap-2">
          {options.map((option) => (
            <TabChip
              key={option}
              label={`${option} tháng`}
              selected={months === option}
              onPress={() => setMonths(option)}
            />
          ))}
        </View>
        {lastDay ? (
          <Text className="text-body-sm text-text-secondary tabular-nums">
            Thuê đến hết ngày{' '}
            <Text className="font-semibold text-text-primary">{formatIsoDate(lastDay)}</Text>
          </Text>
        ) : null}
      </View>

      <InlineMessage
        message="Sau khi gia hạn, trả kho trước ngày hết hạn mới vẫn là trả trước hạn và sẽ mất tiền cọc."
        type="warning"
      />

      <View className="gap-2">
        <Text className="text-body-sm font-semibold text-text-primary">
          Ghi chú (không bắt buộc)
        </Text>
        <BottomSheetTextInput
          className="min-h-20 rounded-xl border border-border-default bg-bg-subtle px-4 py-3 font-inter text-body text-text-primary"
          placeholder="VD: mình muốn thuê thêm để chờ chuyển nhà…"
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
        label={busy ? 'Đang gửi…' : 'Gửi yêu cầu gia hạn'}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}
