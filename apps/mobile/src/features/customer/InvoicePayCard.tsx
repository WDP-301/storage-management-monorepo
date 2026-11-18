import { View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import { invoiceTitle, vietnamDayIso, willBeVoidedOnReturn } from '../../../lib/settlement-format';
import { Dashed, Text } from '../../components/ui';
import type { ApiInvoice } from '../../types/invoice-api';
import { StatusPill } from './contract-display';
import { InfoRow } from './info-row';
import { PaymentQr, TransferContent } from './payment-qr';

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
          <View className="items-center gap-3 pt-1">
            <PaymentQr
              label={`Mã VietQR thanh toán hoá đơn ${invoice.invoiceNo}`}
              saveName={invoice.invoiceNo}
              url={qrUrl}
            />
            <TransferContent value={invoice.invoiceNo} />
          </View>
        </>
      ) : null}
    </View>
  );
}
