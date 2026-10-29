import { ActivityIndicator, Text, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
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
        <ActivityIndicator size="small" />
        <Text className="font-body text-body-sm text-muted">Đang kiểm tra ngày trả…</Text>
      </View>
    );
  }
  if (error) return <Text className="font-body text-body-sm text-danger">{error}</Text>;
  if (!preview) return null;

  const warnings: string[] = [];
  if (preview.short_notice) {
    warnings.push(
      `Trả trước hạn hợp đồng (${formatIsoDate(preview.last_day)}) nhưng mới báo trước ` +
        `${preview.notice_days}/${preview.required_notice_days} ngày — sẽ trừ ` +
        `${formatMoney(preview.short_notice_deduction)} (1 tháng tiền thuê) vào tiền cọc.`,
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
    <View className="gap-2">
      {warnings.map((warning) => (
        <View key={warning} className="rounded-lg bg-warning-bg px-3 py-2.5">
          <Text className="font-body text-body-sm leading-5 text-warning">{warning}</Text>
        </View>
      ))}
      <Text className="font-body text-body-sm text-muted">
        Số tiền trên tính cho trường hợp trả đúng ngày này; khi quyết toán, tiền tính tới ngày nhân
        viên chốt biên bản trả kho.
      </Text>
      <Text className="font-body text-body-sm text-muted">
        {preview.deposit_held === null
          ? 'Tiền cọc đang được xác minh.'
          : `Tiền cọc đang giữ: ${formatMoney(preview.deposit_held)}`}
      </Text>
    </View>
  );
}
