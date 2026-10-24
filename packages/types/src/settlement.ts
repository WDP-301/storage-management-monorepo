import type {
  ContractStatus,
  DamageSeverity,
  DepositStatus,
  InvoiceStatus,
  ReturnRequestSource,
  SettlementLineType,
  SettlementStatus,
} from './domain.enums';
import type {
  EvidenceFile,
  MaskedRefundBankAccount,
  RefundBankAccount,
  RefundBankAccountInput,
  ReturnRules,
  ReturnTimingRecord,
} from './return-request';

// Conventions: money is whole VND as a number; `*_day` is a Vietnam calendar day `YYYY-MM-DD`;
// `*_at` is an instant. Records are snake_case, request bodies camelCase.

/** Deposit settlement seen from a contract: no settlement row yet means PENDING. */
export type ContractSettlementStatus = 'PENDING' | SettlementStatus;

export interface SettlementLine {
  type: SettlementLineType;
  /** DEDUCTION lines are taken from the deposit; CREDIT lines are added back to it. */
  direction: 'DEDUCTION' | 'CREDIT';
  description: string;
  quantity: number;
  unit_amount: number;
  /** quantity × unit_amount once decided; 0 when waived or excluded. */
  amount: number;
  waived: boolean;
  waive_reason: string | null;
  /** True until staff decide (a damage without an amount, a credit awaiting review). */
  needs_decision: boolean;
  invoice_id?: string | null;
  invoice_no?: string | null;
  payment_id?: string | null;
  /** REVIEW_PAYMENT_CREDIT: whether staff counted the payment; null until decided. */
  included?: boolean | null;
  /** DAMAGE: position in the return inspection's damages. */
  damage_index?: number | null;
  severity?: DamageSeverity | null;
  /** DAMAGE: fee proposed at the return inspection; null when staff proposed none. */
  proposed_amount?: number | null;
}

export interface SettlementTotals {
  deposit_amount: number;
  credits_total: number;
  deductions_total: number;
  refund_amount: number;
  shortfall_amount: number;
}

export const SettlementWarningCode = {
  /** The deposit paid cannot be derived; approval is refused until it is recorded. */
  DEPOSIT_MISSING: 'DEPOSIT_MISSING',
  /** Refund account holder differs from the contract customer (compared without diacritics). */
  ACCOUNT_NAME_MISMATCH: 'ACCOUNT_NAME_MISMATCH',
} as const;
export type SettlementWarningCode =
  (typeof SettlementWarningCode)[keyof typeof SettlementWarningCode];

export interface SettlementWarning {
  code: SettlementWarningCode;
  message: string;
}

/** Customer view of a settlement in `/contracts/mine` (ENDED contracts only). */
export interface SettlementSummaryRecord {
  status: ContractSettlementStatus;
  deposit_amount: number | null;
  /** Empty while PENDING: amounts are final only once approved. */
  lines: SettlementLine[];
  totals: SettlementTotals | null;
  refund_account: MaskedRefundBankAccount | null;
  /** Settlement invoice for approved fees, open only for the part the deposit did not cover. */
  fee_invoice_id: string | null;
  approved_at: string | Date | null;
  completed_at: string | Date | null;
  /** Proof of the refund transfer, once staff confirmed it: the bank reference, if given. */
  refund_transfer_ref: string | null;
  /** Proof of the refund transfer: the receipts staff attached (empty until it is confirmed). */
  refund_evidence: EvidenceFile[];
}

export interface SettlementDamage {
  index: number;
  description: string;
  severity: DamageSeverity;
  evidence: EvidenceFile[];
  proposed_fee: number | null;
}

/** Back-office view of one contract's settlement: a preview until approved, then frozen. */
export interface SettlementDetailRecord {
  contract: {
    id: string;
    contract_no: string;
    status: ContractStatus;
    effective_at: string | Date;
    months: number;
    monthly_price: number;
    term_end_at: string | Date;
    customer: { id: string; full_name: string; phone: string | null; email: string | null };
    unit: { id: string; code: string; name: string } | null;
    facility: { id: string; code: string; name: string } | null;
  };
  return: {
    id: string;
    requested_at: string | Date;
    request_source: ReturnRequestSource | null;
    requested_by_name: string | null;
    notice_from: string | Date | null;
    scheduled_day: string | null;
    returned_on: string | null;
    finalized_at: string | Date | null;
    rules: ReturnRules | null;
    condition_notes: string | null;
    evidence: EvidenceFile[];
    damages: SettlementDamage[];
  };
  timing: ReturnTimingRecord;
  status: ContractSettlementStatus;
  deposit: { id: string | null; amount: number; status: DepositStatus } | null;
  lines: SettlementLine[];
  totals: SettlementTotals | null;
  warnings: SettlementWarning[];
  /** Account the customer gave with the return request; null when they gave none. */
  customer_bank_account: RefundBankAccount | null;
  /** Account the refund goes to, once approved. */
  bank_account: RefundBankAccount | null;
  bank_override: { by_name: string | null; reason: string } | null;
  transfer_content: string;
  refund_qr_url: string | null;
  /** Hash of the computed figures; approval must send it back unchanged. */
  version: string;
  fee_invoice: {
    id: string;
    invoice_no: string;
    status: InvoiceStatus;
    total: number;
    amount_due: number;
  } | null;
  transfer_ref: string | null;
  evidence: EvidenceFile[];
  note: string | null;
  approved_by_name: string | null;
  approved_at: string | Date | null;
  completed_by_name: string | null;
  completed_at: string | Date | null;
}

export interface SettlementDamageDecision {
  index: number;
  amount?: number;
  waived?: boolean;
}

export interface SettlementCreditDecision {
  paymentId: string;
  include: boolean;
}

export interface SettlementWaivedLine {
  type: typeof SettlementLineType.EARLY_RETURN_SHORT_NOTICE | typeof SettlementLineType.OVERSTAY;
  reason: string;
}

export interface SettlementDecisionsInput {
  damageDecisions?: SettlementDamageDecision[];
  creditDecisions?: SettlementCreditDecision[];
  waivedLines?: SettlementWaivedLine[];
}

export interface ApproveSettlementInput extends SettlementDecisionsInput {
  expectedVersion: string;
  bankAccount?: RefundBankAccountInput;
  /** Required when the account differs from the one the customer gave (or they gave none). */
  bankOverrideReason?: string;
  note?: string;
}

/** Marks the manual refund transfer done; needs at least one evidence file, the reference is optional. */
export interface CompleteRefundInput {
  /** At least one file proving the transfer. */
  evidence: EvidenceFile[];
  transferRef?: string;
  note?: string;
}
