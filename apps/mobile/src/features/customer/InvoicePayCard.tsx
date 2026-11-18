import { Image, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { saveRemoteImage } from '../../../lib/save-image-to-library';
import { invoiceTitle, vietnamDayIso, willBeVoidedOnReturn } from '../../../lib/settlement-format';
import { CopyableCode, Dashed, Text } from '../../components/ui';
import type { ApiInvoice } from '../../types/invoice-api';
import { StatusPill } from './contract-display';
import { InfoRow } from './info-row';
import { SaveImageButton } from './SaveImageButton';

/** VietQR's "compact2" template is taller than it is wide; locking the ratio stops it stretching. */
const QR_WIDTH = 220;
const QR_ASPECT_RATIO = 0.84;

const dayLabel = (instant: string | null) => {
  const day = instant ? vietnamDayIso(instant) : null;
  return day ? formatIsoDate(day) : null;
};

/**
 * An invoice with money still owed. A rental period starting on or after the booked return day
 * is voided when the unit comes back that day, so it gets no QR.
 */
export function InvoicePayCard({
  invoice,
  returnScheduledAt,
}: {
  invoice: ApiInvoice;
  /** Day of the open return request, if any. */
  returnScheduledAt: string | null;
}) {
  const voided =
    invoice.kind !== 'SETTLEMENT' && willBeVoidedOnReturn(invoice.startAt, returnScheduledAt);
  const startDay = dayLabel(invoice.startAt);
  const dueDay = dayLabel(invoice.dueAt);
  const returnDay = dayLabel(returnScheduledAt);
  const qrUrl = invoice.paymentQrUrl;

  return (
    <View className="gap-2.5 rounded-2xl border border-border-default bg-bg-subtle p-3.5">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-body font-bold text-text-primary">
          {invoiceTitle(invoice)}
        </Text>
        <StatusPill
          label={voided ? 'Sẽ huỷ khi trả kho' : 'Cần thanh toán'}
          tone={voided ? 'neutral' : 'warning'}
        />
      </View>
      {startDay ? <InfoRow isNumeric label="Kỳ bắt đầu" value={startDay} /> : null}
      {dueDay ? <InfoRow isNumeric label="Hạn thanh toán" value={dueDay} /> : null}
      <InfoRow isNumeric label="Tổng tiền" value={formatMoney(invoice.total)} />
      {invoice.paidAmount > 0 ? (
        <InfoRow isNumeric label="Đã trả" value={formatMoney(invoice.paidAmount)} />
      ) : null}
      <InfoRow isNumeric label="Còn phải trả" value={formatMoney(invoice.amountDue)} />

      {voided ? (
        <Text className="text-body-sm text-text-secondary">
          Nếu trả đúng ngày hẹn{returnDay ? ` ${returnDay.slice(0, 5)}` : ''}.
        </Text>
      ) : qrUrl ? (
        <>
          <Dashed />
          <View className="items-center gap-2.5 pt-1">
            <View className="rounded-2xl bg-secondary-0 p-3">
              <Image
                accessibilityLabel={`Mã VietQR thanh toán hoá đơn ${invoice.invoiceNo}`}
                source={{ uri: qrUrl }}
                style={{ width: QR_WIDTH, aspectRatio: QR_ASPECT_RATIO }}
                resizeMode="contain"
              />
            </View>
            <SaveImageButton
              label="Lưu mã QR"
              isCompact
              onSave={() => saveRemoteImage(qrUrl, invoice.invoiceNo)}
            />
            <View className="w-full gap-1.5">
              <Text className="text-caption text-text-secondary">Nội dung chuyển khoản</Text>
              <CopyableCode value={invoice.invoiceNo} />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
