import { Warning } from 'phosphor-react-native';
import { Text, View } from 'react-native';
import { useReturnSettings } from '../../../lib/client-settings';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { todayIso } from '../../../lib/rental-schedule';
import { vietnamDayIso } from '../../../lib/settlement-format';
import type { ApiContract } from '../../types/contract-api';
import { termEndState } from './term-end';

const WARNING = 'hsl(32 95% 44%)';

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
      ? `Hợp đồng hết hạn ngày ${lastDay}.` +
        (perDay !== null
          ? ` Từ ngày ${formatIsoDate(state.penaltyFromDay)}, phí quá hạn ${formatMoney(perDay)}/ngày sẽ trừ vào tiền cọc.`
          : '') +
        ' Nếu không thuê tiếp, hãy đặt lịch trả kho.'
      : `Hợp đồng đã hết hạn ngày ${lastDay}.` +
        (perDay !== null
          ? ` Phí quá hạn ${formatMoney(perDay)}/ngày trừ vào tiền cọc khi quyết toán.`
          : '') +
        (contract.return && !contract.return.finalizedAt
          ? ' Ngày hẹn trả đã qua — hãy đổi lịch trả kho.'
          : ' Hãy đặt lịch trả kho.');

  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-warning-bg px-3 py-3">
      <Warning color={WARNING} size={18} weight="fill" />
      <View className="flex-1 gap-1">
        <Text className="font-strong text-body-sm text-warning">{title}</Text>
        <Text className="font-body text-body-sm leading-5 text-warning">{body}</Text>
      </View>
    </View>
  );
}
