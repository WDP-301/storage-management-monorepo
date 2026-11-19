import { ActivityIndicator, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { earlyForfeitLabel } from '../../../lib/settlement-format';
import { colors, InlineMessage, Text } from '../../components/ui';
import type { ReturnPreviewRecord } from '../../types/contract-api';

type Props = {
  preview: ReturnPreviewRecord | null;
  isLoading: boolean;
  error: string | null;
};

/** The server's figures for the chosen day, verbatim — the app never computes the money. */
export function ReturnPreviewNotice({ preview, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <View className="flex-row items-center gap-2 py-1">
        <ActivityIndicator color={colors.semantic.actionPrimary} size="small" />
        <Text className="text-body-sm text-text-secondary">Đang kiểm tra ngày trả…</Text>
      </View>
    );
  }
  if (error) return <InlineMessage message={error} type="error" />;
  if (!preview) return null;

  const warnings: string[] = [];
  // Previews from before the share was configurable forfeited the whole deposit.
  const percent = preview.early_forfeit_percent ?? 100;
  const forfeit = preview.early ? earlyForfeitLabel(percent) : null;
  if (forfeit) {
    const whole = percent >= 100 && preview.deposit_held !== null;
    const deposit = whole ? ` (${formatMoney(preview.deposit_held ?? 0)})` : '';
    warnings.push(
      `Trả trước hạn hợp đồng (${formatIsoDate(preview.last_day)}) — mất ${forfeit}` +
        `${deposit}. Tiền thuê còn nợ và phí phát sinh vẫn phải trả thêm.`,
    );
  }
  if (preview.overstay_days > 0) {
    warnings.push(
      `Quá hạn hợp đồng ${preview.overstay_days} ngày × ` +
        `${formatMoney(preview.overstay_penalty_per_day)} = ${formatMoney(preview.overstay_penalty)}` +
        ', trừ vào tiền cọc khi quyết toán.',
    );
  }

  return (
    <View className="gap-2 pt-1">
      {warnings.map((warning) => (
        <View key={warning} className="rounded-xl bg-warning-0 px-3 py-2.5">
          <Text className="text-body-sm leading-5 text-warning-700">{warning}</Text>
        </View>
      ))}
      <Text className="text-caption leading-5 text-text-secondary">
        Số tiền trên tính cho trường hợp trả đúng ngày này; khi quyết toán, tiền tính tới ngày nhân
        viên chốt biên bản trả kho.
      </Text>
      <Text className="text-caption font-medium text-text-secondary">
        {preview.deposit_held === null
          ? 'Tiền cọc đang được xác minh.'
          : `Tiền cọc đang giữ: ${formatMoney(preview.deposit_held)}`}
      </Text>
    </View>
  );
}
