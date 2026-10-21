import { Image, Text, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { saveRemoteImage } from '../../../lib/save-image-to-library';
import { invoiceTitle, vietnamDayIso, willBeVoidedOnReturn } from '../../../lib/settlement-format';
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
    <View className="gap-2 rounded-xl border border-border bg-background p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-strong text-body-sm text-foreground">{invoiceTitle(invoice)}</Text>
          <Text className="font-numeric text-caption text-muted">{invoice.invoiceNo}</Text>
        </View>
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
        <Text className="font-body text-body-sm text-muted">
          Nếu trả đúng ngày hẹn{returnDay ? ` ${returnDay.slice(0, 5)}` : ''}.
        </Text>
      ) : qrUrl ? (
        <View className="items-center gap-2 pt-1">
          <Image
            accessibilityLabel={`Mã VietQR thanh toán hoá đơn ${invoice.invoiceNo}`}
            source={{ uri: qrUrl }}
            style={{ width: QR_WIDTH, aspectRatio: QR_ASPECT_RATIO }}
            resizeMode="contain"
          />
          <SaveImageButton
            label="Lưu mã QR"
            isCompact
            onSave={() => saveRemoteImage(qrUrl, invoice.invoiceNo)}
          />
          <Text className="font-body text-center text-caption text-muted">
            Nội dung chuyển khoản: {invoice.invoiceNo}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
