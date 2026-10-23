import { Badge, Button } from '@cloudflare/kumo';
import { CaretDown, CaretRight, WarningCircle } from '@phosphor-icons/react';
import type { ContractInvoiceRecord } from '@storage/types';
import type React from 'react';
import { useEffect, useState } from 'react';
import { SignedFileLink, SignedImageThumb } from '../../components/SignedFile';
import { InvoicesApi } from '../../lib/invoices-api';
import { formatDateTime, formatDay } from '../inspections/inspection-display';
import { formatVnd } from '../warehouses/warehouse-display';
import { InvoicePaymentForm } from './InvoicePaymentForm';
import { invoicePeriodLabel, invoiceStatusBadge, PAYMENT_METHOD_LABEL } from './invoice-display';
import { describeApiError } from './settlement-display';

// Shared record types allow Date for the API side; over the wire they are always ISO strings.
const iso = (value: string | Date | null): string | null =>
  value === null ? null : new Date(value).toISOString();

const isPayable = (invoice: ContractInvoiceRecord) =>
  invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID';

interface Props {
  contractId: string;
  /** Bumped when another section in the dialog (e.g. deposit settlement) mutates invoices. */
  refreshKey?: number;
  /** Called after a payment so the page reloads the contract list. */
  onChanged: () => void;
}

/**
 * Invoices of the contract with their payments. An unpaid invoice can be settled by hand when
 * SePay could not match the transfer (wrong content) or the customer paid cash.
 */
export const ContractInvoicesSection: React.FC<Props> = ({
  contractId,
  refreshKey = 0,
  onChanged,
}) => {
  const [invoices, setInvoices] = useState<ContractInvoiceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  // `reloads` and `refreshKey` force a fresh load of the same contract.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    InvoicesApi.listForContract(contractId)
      .then((next) => !cancelled && setInvoices(next))
      .catch((err: unknown) => {
        if (!cancelled) setError(describeApiError(err, 'Không tải được hóa đơn.'));
      });
    return () => {
      cancelled = true;
    };
  }, [contractId, reloads, refreshKey]);

  const recorded = (next: ContractInvoiceRecord) => {
    setInvoices(
      (prev) => prev?.map((invoice) => (invoice.id === next.id ? next : invoice)) ?? null,
    );
    setPaying(null);
    setExpanded(next.id);
    onChanged();
  };

  return (
    <section className="space-y-3 pt-3 border-t border-kumo-line">
      <span className="text-xs font-semibold text-kumo-default block">Hóa đơn</span>

      {error && (
        <div
          role="alert"
          className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex gap-2"
        >
          <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {!invoices && !error && <p className="text-sm text-kumo-subtle">Đang tải hóa đơn…</p>}
      {invoices?.length === 0 && (
        <p className="text-sm text-kumo-subtle">Hợp đồng chưa có hóa đơn nào.</p>
      )}

      <ul className="space-y-2">
        {invoices?.map((invoice) => {
          const badge = invoiceStatusBadge(invoice);
          const isOpen = expanded === invoice.id;
          return (
            <li key={invoice.id} className="rounded-lg ring ring-kumo-line p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono text-kumo-default"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : invoice.id)}
                >
                  {isOpen ? (
                    <CaretDown className="w-3.5 h-3.5" />
                  ) : (
                    <CaretRight className="w-3.5 h-3.5" />
                  )}
                  {invoice.invoice_no}
                </button>
                <span className="text-kumo-subtle">{invoicePeriodLabel(invoice)}</span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {invoice.is_overdue && invoice.status === 'PARTIALLY_PAID' && (
                  <Badge variant="warning">Thanh toán một phần</Badge>
                )}
                <span className="ml-auto text-kumo-default">
                  {formatVnd(invoice.paid_amount)} / {formatVnd(invoice.total)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-kumo-subtle">
                <span>
                  {invoice.due_at
                    ? `Hạn thanh toán: ${formatDay(iso(invoice.due_at))}`
                    : 'Thanh toán khi nhận kho'}
                </span>
                {invoice.amount_due > 0 && (
                  <span>Còn phải thu: {formatVnd(invoice.amount_due)}</span>
                )}
                {isPayable(invoice) && paying !== invoice.id && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto"
                    onClick={() => setPaying(invoice.id)}
                  >
                    Ghi nhận thanh toán
                  </Button>
                )}
              </div>

              {paying === invoice.id && isPayable(invoice) && (
                <InvoicePaymentForm
                  contractId={contractId}
                  invoice={invoice}
                  onRecorded={recorded}
                  onStale={() => setReloads((n) => n + 1)}
                  onCancel={() => setPaying(null)}
                />
              )}

              {isOpen && <PaymentList invoice={invoice} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

function PaymentList({ invoice }: { invoice: ContractInvoiceRecord }) {
  if (invoice.payments.length === 0) {
    return <p className="text-xs text-kumo-subtle">Chưa có khoản thanh toán nào.</p>;
  }
  return (
    <ul className="space-y-2 border-t border-kumo-line pt-2">
      {invoice.payments.map((payment) => (
        <li key={payment.id} className="space-y-1">
          <div className="flex flex-wrap gap-x-3 text-xs text-kumo-default">
            <span className="font-medium">{formatVnd(payment.amount)}</span>
            <span>{PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}</span>
            <span>{formatDateTime(iso(payment.paid_at))}</span>
            <span className="text-kumo-subtle">
              {payment.is_manual
                ? `Ghi nhận bởi ${payment.recorded_by?.full_name ?? 'nhân viên'}`
                : 'Tự động qua SePay'}
            </span>
            {payment.transfer_ref && (
              <span className="font-mono text-kumo-subtle">Mã GD: {payment.transfer_ref}</span>
            )}
          </div>
          {payment.note && <p className="text-xs text-kumo-subtle">{payment.note}</p>}
          {payment.evidence.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {payment.evidence.map((file) =>
                file.mimeType.startsWith('image/') ? (
                  <SignedImageThumb key={file.fileKey} file={file} />
                ) : (
                  <SignedFileLink key={file.fileKey} file={file} />
                ),
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
