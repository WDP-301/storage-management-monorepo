import type { Contract } from '@entities/contract.entity';
import type { ContractSettlement } from '@entities/contract-settlement.entity';
import { toAccountHolderName } from '@modules/contracts/refund-account.util';
import { buildVietQrUrl } from '@modules/payments/vietqr.util';
import { vietnamDate } from '@shared/utils/calendar.util';
import {
  type ContractSettlementStatus,
  type DepositStatus,
  type InvoiceStatus,
  type MaskedRefundBankAccount,
  type RefundBankAccount,
  type SettlementDetailRecord,
  type SettlementLine,
  type SettlementTotals,
  type SettlementWarning,
  SettlementWarningCode,
} from '@storage/types';
import { toReturnTimingRecord } from './return-timing';
import type { SettlementInput } from './settlement-input.loader';

/** The customer only sees the last four digits of a refund account. */
export function maskRefundAccount(
  account: RefundBankAccount | null | undefined,
): MaskedRefundBankAccount | null {
  if (!account) return null;
  return {
    bank_name: account.bankName,
    account_no_masked: `••••${account.accountNo.slice(-4)}`,
    account_name: account.accountName,
  };
}

/** Transfer content of the refund, so the customer recognises it on their statement. */
export const refundTransferContent = (contractNo: string): string => `HOAN COC ${contractNo}`;

export function customerName(contract: Contract): string {
  const snapshot = contract.customerSnapshot ?? {};
  return typeof snapshot.fullName === 'string' && snapshot.fullName
    ? snapshot.fullName
    : (contract.customer?.fullName ?? '');
}

/** Warns (never blocks) when the account holder is not the contract customer. */
export function accountNameWarnings(
  account: RefundBankAccount | null | undefined,
  contract: Contract,
): SettlementWarning[] {
  const name = toAccountHolderName(customerName(contract));
  if (!account || !name || toAccountHolderName(account.accountName) === name) return [];
  return [
    {
      code: SettlementWarningCode.ACCOUNT_NAME_MISMATCH,
      message: `Chủ tài khoản ${account.accountName} khác tên khách hàng ${name}`,
    },
  ];
}

export const depositMissingWarning = (): SettlementWarning => ({
  code: SettlementWarningCode.DEPOSIT_MISSING,
  message: 'Không xác định được tiền cọc đã nộp — cần kiểm tra thủ công',
});

export interface SettlementDetailParts {
  contract: Contract;
  input: SettlementInput;
  status: ContractSettlementStatus;
  deposit: { id: string | null; amount: number; status: DepositStatus } | null;
  lines: SettlementLine[];
  totals: SettlementTotals | null;
  warnings: SettlementWarning[];
  version: string;
  settlement: ContractSettlement | null;
  feeInvoice: {
    id: string;
    invoice_no: string;
    status: InvoiceStatus;
    total: number;
    amount_due: number;
  } | null;
}

export function toSettlementDetailRecord(parts: SettlementDetailParts): SettlementDetailRecord {
  const { contract, input, settlement } = parts;
  const { inspection } = input;
  const unit = contract.bookingItem?.storageUnit;
  const snapshot = contract.customerSnapshot ?? {};
  const pick = (key: string, fallback?: string | null) =>
    typeof snapshot[key] === 'string' ? (snapshot[key] as string) : (fallback ?? null);
  const bankAccount = settlement?.bankAccount ?? null;
  const transferContent = refundTransferContent(contract.contractNo);
  const refund = parts.totals?.refund_amount ?? 0;
  return {
    contract: {
      id: contract.id,
      contract_no: contract.contractNo,
      status: contract.status,
      effective_at: contract.effectiveAt,
      months: contract.months,
      monthly_price: Number(contract.monthlyPriceSnapshot),
      term_end_at: input.timing.termEndAt,
      customer: {
        id: contract.customerId,
        full_name: customerName(contract),
        phone: pick('phone', contract.customer?.phone),
        email: pick('email', contract.customer?.email),
      },
      unit: unit ? { id: unit.id, code: unit.code, name: unit.name } : null,
      facility: unit?.facility
        ? { id: unit.facility.id, code: unit.facility.code, name: unit.facility.name }
        : null,
    },
    return: {
      id: inspection.id,
      requested_at: inspection.createdAt,
      request_source: inspection.requestSource ?? null,
      requested_by_name: inspection.requester?.fullName ?? null,
      notice_from: inspection.noticeFrom ?? null,
      scheduled_day: inspection.scheduledAt ? vietnamDate(inspection.scheduledAt) : null,
      returned_on: input.returnedOn,
      finalized_at: inspection.finalizedAt ?? null,
      rules: input.rules,
      condition_notes: inspection.conditionNotes ?? null,
      evidence: inspection.evidence ?? [],
      damages: input.damages.map((d) => ({
        index: d.index,
        description: d.description,
        severity: d.severity as NonNullable<typeof d.severity>,
        evidence: d.evidence,
        proposed_fee: d.proposedFee,
      })),
    },
    timing: toReturnTimingRecord(input.timing),
    status: parts.status,
    deposit: parts.deposit,
    lines: parts.lines,
    totals: parts.totals,
    warnings: parts.warnings,
    customer_bank_account: settlement
      ? (settlement.customerBankAccount ?? null)
      : input.customerBankAccount,
    bank_account: bankAccount,
    bank_override: settlement?.bankOverrideReason
      ? {
          by_name: settlement.bankOverrider?.fullName ?? null,
          reason: settlement.bankOverrideReason,
        }
      : null,
    transfer_content: transferContent,
    refund_qr_url:
      parts.status === 'AWAITING_REFUND' && bankAccount?.bankBin && refund > 0
        ? buildVietQrUrl({
            bankId: bankAccount.bankBin,
            accountNo: bankAccount.accountNo,
            accountName: bankAccount.accountName,
            amount: refund,
            addInfo: transferContent,
          })
        : null,
    version: parts.version,
    fee_invoice: parts.feeInvoice,
    transfer_ref: settlement?.transferRef ?? null,
    evidence: settlement?.evidence ?? [],
    note: settlement?.note ?? null,
    approved_by_name: settlement?.approver?.fullName ?? null,
    approved_at: settlement?.approvedAt ?? null,
    completed_by_name: settlement?.completer?.fullName ?? null,
    completed_at: settlement?.completedAt ?? null,
  };
}
