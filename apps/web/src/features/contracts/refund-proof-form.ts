import type {
  CompleteRefundInput,
  EvidenceFile,
  SettlementDetailRecord,
} from '../../types/settlement';
import { ACCEPTED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from './contract-display';
import {
  type BankFormState,
  EMPTY_BANK_FORM,
  isSameAccount,
  toBankAccountInput,
  toBankForm,
  validateBankForm,
} from './refund-account-form';
import { DEFAULT_OVERRIDE_REASON, MAX_NOTE_LENGTH, MAX_REASON_LENGTH } from './settlement-form';

export const MAX_REFUND_EVIDENCE = 5;
export const MAX_TRANSFER_REF_LENGTH = 100;

export interface RefundProofState {
  evidence: EvidenceFile[];
  transferRef: string;
  note: string;
  bank: BankFormState;
  bankReason: string;
}

export type RefundProofInputState = Omit<RefundProofState, 'bank' | 'bankReason'> &
  Partial<Pick<RefundProofState, 'bank' | 'bankReason'>>;

export const EMPTY_REFUND_PROOF: RefundProofState = {
  evidence: [],
  transferRef: '',
  note: '',
  bank: EMPTY_BANK_FORM,
  bankReason: DEFAULT_OVERRIDE_REASON,
};

export function initRefundProof(record: SettlementDetailRecord): RefundProofState {
  return {
    ...EMPTY_REFUND_PROOF,
    bank: toBankForm(record.customer_bank_account),
    bankReason: record.customer_bank_account ? '' : DEFAULT_OVERRIDE_REASON,
  };
}

export const needsMissingRefundBank = (record: SettlementDetailRecord): boolean =>
  !record.bank_account && (record.totals?.refund_amount ?? 0) > 0;

/** Pre-check of picked files so a bad pick never costs an upload; the API stays the authority. */
export function validateProofFiles(existing: number, files: readonly File[]): string | null {
  if (existing + files.length > MAX_REFUND_EVIDENCE)
    return `Tối đa ${MAX_REFUND_EVIDENCE} ảnh chứng từ (hiện có ${existing}).`;
  for (const file of files) {
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type))
      return `"${file.name}" không đúng định dạng — chỉ nhận ảnh (JPG, PNG, WebP, HEIC) hoặc PDF.`;
    if (file.size > MAX_DOCUMENT_BYTES) return `"${file.name}" vượt quá 15 MB.`;
    if (file.size === 0) return `"${file.name}" là file rỗng.`;
  }
  return null;
}

/** The transfer needs proof: at least one evidence file, and a verified bank account if not recorded yet. */
export function validateRefundProof(
  state: RefundProofInputState,
  record?: Pick<SettlementDetailRecord, 'bank_account' | 'customer_bank_account' | 'totals'>,
): string | null {
  const bank = state.bank ?? EMPTY_BANK_FORM;
  const bankReason = state.bankReason ?? '';
  if (record && !record.bank_account && (record.totals?.refund_amount ?? 0) > 0) {
    const bankProblem = validateBankForm(bank);
    if (bankProblem) return bankProblem;
    if (!isSameAccount(bank, record.customer_bank_account)) {
      const reason = bankReason.trim();
      if (!reason) return 'Nhập lý do sử dụng tài khoản nhận hoàn tiền này.';
      if (reason.length > MAX_REASON_LENGTH)
        return `Lý do đổi tài khoản tối đa ${MAX_REASON_LENGTH} ký tự.`;
    }
  }
  const ref = state.transferRef.trim();
  if (state.evidence.length === 0) return 'Đính kèm ít nhất 1 ảnh chứng từ chuyển khoản.';
  if (state.evidence.length > MAX_REFUND_EVIDENCE)
    return `Tối đa ${MAX_REFUND_EVIDENCE} ảnh chứng từ.`;
  if (ref.length > MAX_TRANSFER_REF_LENGTH)
    return `Mã giao dịch tối đa ${MAX_TRANSFER_REF_LENGTH} ký tự.`;
  if (state.note.trim().length > MAX_NOTE_LENGTH) return `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự.`;
  return null;
}

export function buildRefundInput(
  state: RefundProofInputState,
  record?: Pick<SettlementDetailRecord, 'bank_account' | 'customer_bank_account' | 'totals'>,
): CompleteRefundInput {
  const bank = state.bank ?? EMPTY_BANK_FORM;
  const bankReason = state.bankReason ?? '';
  const input: CompleteRefundInput = { evidence: state.evidence };
  const ref = state.transferRef.trim();
  if (ref) input.transferRef = ref;
  const note = state.note.trim();
  if (note) input.note = note;
  if (record && !record.bank_account && (record.totals?.refund_amount ?? 0) > 0) {
    input.bankAccount = toBankAccountInput(bank);
    if (!isSameAccount(bank, record.customer_bank_account) && bankReason.trim()) {
      input.bankOverrideReason = bankReason.trim();
    }
  }
  return input;
}
