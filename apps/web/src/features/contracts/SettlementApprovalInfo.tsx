import type React from 'react';
import { SignedFileLink, SignedImageThumb } from '../../components/SignedFile';
import type { SettlementDetailRecord } from '../../types/settlement';
import { formatDateTime } from '../inspections/inspection-display';
import { formatVnd } from '../warehouses/warehouse-display';

const at = (value: string | Date | null) =>
  value ? formatDateTime(value instanceof Date ? value.toISOString() : value) : '—';

const Row: React.FC<{ label: string; value: string; mono?: boolean; strong?: boolean }> = ({
  label,
  value,
  mono,
  strong,
}) => (
  <div className="flex justify-between gap-3">
    <dt className="text-kumo-subtle shrink-0">{label}</dt>
    <dd
      className={`text-kumo-default text-right break-all ${mono ? 'font-mono text-xs' : ''} ${
        strong ? 'font-semibold' : ''
      }`}
    >
      {value}
    </dd>
  </div>
);

/** Where the refund goes and what to write on the transfer; the QR only while it is due. */
export const RefundTransferDetails: React.FC<{ record: SettlementDetailRecord }> = ({ record }) => {
  const account = record.bank_account;
  return (
    <div className="p-3 rounded-lg ring ring-kumo-line flex flex-col sm:flex-row gap-4">
      <dl className="grid gap-1.5 text-sm flex-1 min-w-0">
        <Row label="Số tiền hoàn" value={formatVnd(record.totals?.refund_amount ?? 0)} strong />
        <Row label="Ngân hàng" value={account?.bankName ?? '—'} />
        <Row label="Số tài khoản" value={account?.accountNo ?? '—'} mono />
        <Row label="Chủ tài khoản" value={account?.accountName ?? '—'} />
        <Row label="Nội dung chuyển khoản" value={record.transfer_content} mono />
      </dl>
      {record.refund_qr_url && (
        <img
          src={record.refund_qr_url}
          alt="Mã QR chuyển khoản hoàn cọc"
          className="w-40 h-40 object-contain self-center rounded-lg border border-kumo-line"
        />
      )}
    </div>
  );
};

/** Who approved and who confirmed the transfer, with the proof; read-only. */
export const SettlementApprovalInfo: React.FC<{ record: SettlementDetailRecord }> = ({
  record,
}) => {
  const fee = record.fee_invoice;
  const completed = record.status === 'COMPLETED';
  return (
    <div className="space-y-3">
      <dl className="grid gap-1.5 text-sm p-3 bg-kumo-control rounded-lg">
        <Row label="Người duyệt" value={record.approved_by_name ?? '—'} />
        <Row label="Duyệt lúc" value={at(record.approved_at)} />
        {record.bank_override && (
          <Row
            label="Lý do đổi tài khoản"
            value={`${record.bank_override.reason}${
              record.bank_override.by_name ? ` (${record.bank_override.by_name})` : ''
            }`}
          />
        )}
        {record.note && <Row label="Ghi chú" value={record.note} />}
        {fee && (
          <Row
            label="Hoá đơn quyết toán"
            value={`${fee.invoice_no} · ${formatVnd(fee.total)} · còn nợ ${formatVnd(fee.amount_due)}`}
          />
        )}
        {completed && (
          <>
            <Row label="Người xác nhận chuyển" value={record.completed_by_name ?? '—'} />
            <Row label="Xác nhận lúc" value={at(record.completed_at)} />
            {record.transfer_ref && <Row label="Mã giao dịch" value={record.transfer_ref} mono />}
          </>
        )}
      </dl>
      {completed && record.bank_account && <RefundTransferDetails record={record} />}
      {record.evidence.length > 0 && (
        <section className="space-y-1.5">
          <span className="text-xs font-semibold text-kumo-default block">
            Chứng từ chuyển khoản ({record.evidence.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {record.evidence.map((file) =>
              file.mimeType.startsWith('image/') ? (
                <SignedImageThumb key={file.fileKey} file={file} />
              ) : (
                <SignedFileLink key={file.fileKey} file={file} />
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
};
