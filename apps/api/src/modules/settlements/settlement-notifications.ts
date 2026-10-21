import type { Contract } from '@entities/contract.entity';
import type { Invoice } from '@entities/invoice.entity';
import { formatVndCurrency } from '@modules/invoices/invoice-pdf.service';
import type { NotificationPayload } from '@modules/notifications/types/notification';
import { formatVietnamDate } from '@shared/utils/calendar.util';
import { NotificationType, type RefundBankAccount, type SettlementTotals } from '@storage/types';
import { maskRefundAccount } from './settlement-records';

type NotifiedContract = Pick<Contract, 'id' | 'contractNo'>;

/** Tells the customer the outcome of the settlement; account numbers are always masked. */
export function settlementApprovedNotification(
  contract: NotifiedContract,
  settlementId: string,
  totals: SettlementTotals,
  bankAccount: RefundBankAccount | null,
  feeInvoice: Pick<Invoice, 'id' | 'invoiceNo' | 'dueAt'> | null,
): NotificationPayload {
  const masked = maskRefundAccount(bankAccount);
  let outcome = 'Tiền cọc đã được cấn trừ hết.';
  if (totals.refund_amount > 0) {
    outcome = `Số tiền hoàn lại ${formatVndCurrency(totals.refund_amount)} sẽ được chuyển khoản${
      masked ? ` tới tài khoản ${masked.bank_name} ${masked.account_no_masked}` : ''
    }.`;
  } else if (totals.shortfall_amount > 0 && feeInvoice) {
    const due = feeInvoice.dueAt ? `, hạn ${formatVietnamDate(feeInvoice.dueAt)}` : '';
    outcome = `Tiền cọc không đủ: vui lòng thanh toán thêm ${formatVndCurrency(
      totals.shortfall_amount,
    )} theo hoá đơn ${feeInvoice.invoiceNo}${due}.`;
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
      feeInvoiceId: feeInvoice?.id ?? null,
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
