import type { Contract } from '@entities/contract.entity';
import { formatVndCurrency } from '@modules/invoices/invoice-pdf.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { formatVietnamDate } from '@shared/utils/calendar.util';
import { NotificationType, type RefundBankAccount, type SettlementTotals } from '@storage/types';
import type { AppliedSettlement, OpenInvoice } from './settlement-apply.util';
import { maskRefundAccount } from './settlement-records';

type NotifiedContract = Pick<Contract, 'id' | 'contractNo'>;

const dueText = (invoice: OpenInvoice): string =>
  `hoá đơn ${invoice.invoiceNo} còn ${formatVndCurrency(invoice.amountDue)}${
    invoice.dueAt ? ` (hạn ${formatVietnamDate(invoice.dueAt)})` : ''
  }`;

/**
 * Tells the customer the outcome of the settlement; account numbers are always masked. When the
 * deposit fell short, what is still owed is listed per invoice — rent left on its rent invoice,
 * fees on the settlement invoice — so each amount is paid against the invoice it belongs to.
 */
export function settlementApprovedNotification(
  contract: NotifiedContract,
  settlementId: string,
  totals: SettlementTotals,
  bankAccount: RefundBankAccount | null,
  applied: Pick<AppliedSettlement, 'feeInvoice' | 'openInvoices'>,
): NotificationPayload {
  const masked = maskRefundAccount(bankAccount);
  const open = applied.openInvoices;
  let outcome = 'Tiền cọc đã được cấn trừ hết.';
  if (totals.refund_amount > 0) {
    outcome = `Số tiền hoàn lại ${formatVndCurrency(totals.refund_amount)} sẽ được chuyển khoản${
      masked ? ` tới tài khoản ${masked.bank_name} ${masked.account_no_masked}` : ''
    }.`;
  } else if (open.length > 0) {
    outcome = `Tiền cọc không đủ để cấn trừ hết. Vui lòng thanh toán từng hoá đơn: ${open
      .map(dueText)
      .join('; ')}.`;
  }
  return {
    type: NotificationType.SETTLEMENT_APPROVED,
    title: 'Đã duyệt quyết toán tiền cọc',
    body: `Hợp đồng ${contract.contractNo}: ${outcome}`,
    data: {
      contractId: contract.id,
      contractNo: contract.contractNo,
      settlementId,
      refundAmount: totals.refund_amount,
      shortfallAmount: totals.shortfall_amount,
      feeInvoiceId: applied.feeInvoice?.id ?? null,
      invoiceIds: open.map((invoice) => invoice.invoiceId),
      openInvoices: open.map((invoice) => ({
        invoiceId: invoice.invoiceId,
        invoiceNo: invoice.invoiceNo,
        amountDue: invoice.amountDue,
        dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
      })),
    },
  };
}

export function refundCompletedNotification(
  contract: NotifiedContract,
  settlementId: string,
  refundAmount: number,
  bankAccount: RefundBankAccount | null,
): NotificationPayload {
  const masked = maskRefundAccount(bankAccount);
  return {
    type: NotificationType.REFUND_COMPLETED,
    title: 'Đã hoàn tiền cọc',
    body: `Hợp đồng ${contract.contractNo}: đã chuyển khoản ${formatVndCurrency(refundAmount)}${
      masked ? ` tới tài khoản ${masked.bank_name} ${masked.account_no_masked}` : ''
    }.`,
    data: {
      contractId: contract.id,
      contractNo: contract.contractNo,
      settlementId,
      refundAmount,
    },
  };
}
