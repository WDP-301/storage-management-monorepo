import { Warning } from 'phosphor-react-native';
import { View } from 'react-native';
import { useReturnSettings } from '../../../lib/client-settings';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { todayIso } from '../../../lib/rental-schedule';
import { vietnamDayIso } from '../../../lib/settlement-format';
import { colors, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import { termEndState } from './term-end';

/** Ending-soon or overdue banner of an ACTIVE contract; the per-day charge is the server's. */
export function TermEndNotice({ contract }: { contract: ApiContract }) {
  const { noticeDays } = useReturnSettings();
  const state = termEndState(contract, vietnamDayIso(new Date()) ?? todayIso(), noticeDays);
  if (!state) return null;

  const perDay = contract.overduePenaltyPerDay;
  const lastDay = formatIsoDate(state.lastDay);
  const title =
    state.kind === 'ending'
      ? 'Hợp đồng sắp hết hạn'
      : `Hợp đồng đã quá hạn ${state.daysOverdue} ngày`;
  const body =
    state.kind === 'ending'
      ? `Hợp đồng hết hạn hết ngày ${lastDay}.` +
        (perDay !== null
          ? ` Từ ngày ${formatIsoDate(state.penaltyFromDay)}, phí quá hạn ${formatMoney(perDay)}/ngày sẽ trừ vào tiền cọc.`
          : '') +
        ' Muốn thuê tiếp, hãy gửi yêu cầu gia hạn; nếu không, hãy đặt lịch trả kho.'
      : `Kỳ thuê đã kết thúc hết ngày ${lastDay} (hiện quá ${state.daysOverdue} ngày so với hạn hợp đồng).` +
        (perDay !== null
          ? ` Phí phát sinh ${formatMoney(perDay)}/ngày được tính từ ngày kế tiếp đến khi chốt biên bản trả kho và trừ vào tiền cọc.`
          : '') +
        (contract.return && !contract.return.finalizedAt
          ? ' Lịch hẹn trả cũ đã qua — hãy chọn lại ngày trả kho mới.'
          : ' Hãy đặt lịch trả kho sớm nhất.');

  return (
    <View className="flex-row items-start gap-2.5 rounded-[16px] border border-warning-500/30 bg-warning-0 px-3.5 py-3">
      <Warning color={colors.warning[700]} size={18} weight="fill" />
      <View className="flex-1 gap-1">
        <Text className="text-body-sm font-semibold text-warning-700">{title}</Text>
        <Text className="text-body-sm leading-5 text-warning-700">{body}</Text>
      </View>
    </View>
  );
}
