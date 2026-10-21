import type {
  ApproveSettlementInput,
  SettlementDecisionsInput,
  SettlementDetailRecord,
  SettlementLine,
  WaivableLineType,
} from '../../types/settlement';
import {
  type BankFormState,
  isSameAccount,
  toBankAccountInput,
  toBankForm,
  validateBankForm,
} from './refund-account-form';

/** Largest fee the API accepts for one damage, VND. */
export const MAX_DAMAGE_FEE = 1_000_000_000;
export const MAX_REASON_LENGTH = 500;
export const MAX_NOTE_LENGTH = 1000;
/** Older app versions never ask for an account, so it reached the branch some other way. */
export const DEFAULT_OVERRIDE_REASON = 'Khách cung cấp qua kênh khác';
export const WAIVABLE_LINES: readonly WaivableLineType[] = [
  'EARLY_RETURN_SHORT_NOTICE',
  'OVERSTAY',
];

export const WAIVABLE_LABEL: Record<WaivableLineType, string> = {
  EARLY_RETURN_SHORT_NOTICE: 'khoản trừ báo trước không đủ',
  OVERSTAY: 'phí quá hạn',
};

export interface DamageChoice {
  /** null until the reviewer charges or waives it. */
  mode: 'charge' | 'waive' | null;
  amount: string;
}

export interface WaiveChoice {
  on: boolean;
  reason: string;
}

/** What the reviewer entered; every figure shown still comes from the server preview. */
export interface SettlementFormState {
  damages: Record<number, DamageChoice>;
  /** REVIEW_PAYMENT_CREDIT payment id → counted (true) / left out (false) / undecided (null). */
  credits: Record<string, boolean | null>;
  waived: Partial<Record<WaivableLineType, WaiveChoice>>;
  bank: BankFormState;
  bankReason: string;
  note: string;
}

const isWaivable = (type: SettlementLine['type']): type is WaivableLineType =>
  (WAIVABLE_LINES as readonly string[]).includes(type);

const reviewCredits = (record: SettlementDetailRecord) =>
  record.lines.filter(
    (line): line is SettlementLine & { payment_id: string } =>
      line.type === 'REVIEW_PAYMENT_CREDIT' && typeof line.payment_id === 'string',
  );

/** Whole VND from 0 to MAX_DAMAGE_FEE, or null. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,10}$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount <= MAX_DAMAGE_FEE ? amount : null;
}

/**
 * Starting point of the form. A staff-proposed fee only pre-fills the amount (it may be missing
 * on older app versions); the reviewer's decision is always sent explicitly.
 */
export function initSettlementForm(record: SettlementDetailRecord): SettlementFormState {
  const damages: Record<number, DamageChoice> = {};
  for (const damage of record.return.damages) {
    damages[damage.index] =
      damage.proposed_fee == null
        ? { mode: null, amount: '' }
        : { mode: 'charge', amount: String(damage.proposed_fee) };
  }
  const credits: Record<string, boolean | null> = {};
  for (const line of reviewCredits(record)) credits[line.payment_id] = line.included ?? null;
  const waived: SettlementFormState['waived'] = {};
  for (const line of record.lines) {
    if (isWaivable(line.type)) waived[line.type] = { on: false, reason: '' };
  }
  return {
    damages,
    credits,
    waived,
    bank: toBankForm(record.customer_bank_account),
    bankReason: record.customer_bank_account ? '' : DEFAULT_OVERRIDE_REASON,
    note: '',
  };
}

/**
 * The decisions to preview or approve, limited to lines the settlement has now. Incomplete
 * entries (no amount yet, waiver without a reason) are left out so the preview keeps working.
 */
export function buildDecisions(
  form: SettlementFormState,
  record: SettlementDetailRecord,
): SettlementDecisionsInput {
  const damageDecisions: NonNullable<SettlementDecisionsInput['damageDecisions']> = [];
  for (const { index } of record.return.damages) {
    const choice = form.damages[index];
    if (choice?.mode === 'waive') damageDecisions.push({ index, waived: true });
    const amount = choice?.mode === 'charge' ? parseAmount(choice.amount) : null;
    if (amount !== null) damageDecisions.push({ index, amount });
  }
  const creditDecisions = reviewCredits(record).flatMap((line) => {
    const include = form.credits[line.payment_id] ?? null;
    return include === null ? [] : [{ paymentId: line.payment_id, include }];
  });
  const waivedLines = record.lines.flatMap((line) => {
    if (!isWaivable(line.type)) return [];
    const choice = form.waived[line.type];
    const reason = choice?.reason.trim().slice(0, MAX_REASON_LENGTH);
    return choice?.on && reason ? [{ type: line.type, reason }] : [];
  });
  return { damageDecisions, creditDecisions, waivedLines };
}

/** Money is refunded only when the server says so; then an account is required. */
export const needsRefundAccount = (record: SettlementDetailRecord): boolean =>
  (record.totals?.refund_amount ?? 0) > 0;

/** An account other than the customer's own (or when they gave none) needs a reason. */
export const needsOverrideReason = (
  form: SettlementFormState,
  record: SettlementDetailRecord,
): boolean => !isSameAccount(form.bank, record.customer_bank_account);

/** Everything that blocks approval, in Vietnamese; empty when the form can be approved. */
export function approvalProblems(
  form: SettlementFormState,
  record: SettlementDetailRecord,
): string[] {
  const problems: string[] = [];
  if (!record.totals) problems.push('Không xác định được tiền cọc đã nộp — chưa thể duyệt.');
  for (const { index } of record.return.damages) {
    const choice = form.damages[index];
    const label = `Hư hỏng ${index + 1}`;
    if (!choice?.mode) problems.push(`${label}: nhập số tiền hoặc chọn Miễn.`);
    else if (choice.mode === 'charge' && parseAmount(choice.amount) === null)
      problems.push(`${label}: số tiền phải là số nguyên từ 0 đến 1.000.000.000 đ.`);
  }
  for (const line of reviewCredits(record)) {
    if ((form.credits[line.payment_id] ?? null) === null)
      problems.push(`Chọn Tính hoặc Không tính cho "${line.description}".`);
  }
  for (const line of record.lines) {
    const choice = isWaivable(line.type) ? form.waived[line.type] : undefined;
    if (!isWaivable(line.type) || !choice?.on) continue;
    const reason = choice.reason.trim();
    if (!reason) problems.push(`Nhập lý do miễn ${WAIVABLE_LABEL[line.type]}.`);
    else if (reason.length > MAX_REASON_LENGTH)
      problems.push(`Lý do miễn tối đa ${MAX_REASON_LENGTH} ký tự.`);
  }
  if (needsRefundAccount(record)) {
    const bankProblem = validateBankForm(form.bank);
    const reason = form.bankReason.trim();
    if (bankProblem) problems.push(bankProblem);
    else if (needsOverrideReason(form, record) && !reason)
      problems.push('Nhập lý do dùng tài khoản khác tài khoản khách đã cung cấp.');
    else if (reason.length > MAX_REASON_LENGTH)
      problems.push(`Lý do đổi tài khoản tối đa ${MAX_REASON_LENGTH} ký tự.`);
  }
  if (form.note.trim().length > MAX_NOTE_LENGTH)
    problems.push(`Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự.`);
  return problems;
}

/** Approval body for the preview the reviewer is looking at (its version guards the figures). */
export function buildApproveInput(
  form: SettlementFormState,
  preview: SettlementDetailRecord,
): ApproveSettlementInput {
  const input: ApproveSettlementInput = {
    ...buildDecisions(form, preview),
    expectedVersion: preview.version,
  };
  if (needsRefundAccount(preview)) {
    input.bankAccount = toBankAccountInput(form.bank);
    if (needsOverrideReason(form, preview)) input.bankOverrideReason = form.bankReason.trim();
  }
  const note = form.note.trim();
  if (note) input.note = note;
  return input;
}
