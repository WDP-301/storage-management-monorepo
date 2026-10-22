import { HttpStatus } from '@nestjs/common';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import type { RefundBankAccount } from '@storage/types';

export interface RefundAccountChoice {
  bankAccount: RefundBankAccount | null;
  overrideBy: string | null;
  overrideReason: string | null;
}

/**
 * Same bank and number. The holder name is not compared: it now always comes from the bank, while
 * accounts saved earlier carry the name the customer typed, and staff confirm identity in person.
 */
function sameAccount(a: RefundBankAccount, b: RefundBankAccount): boolean {
  const bank = (account: RefundBankAccount) =>
    account.bankBin ?? `name:${account.bankName.trim().toLowerCase()}`;
  return bank(a) === bank(b) && a.accountNo.trim() === b.accountNo.trim();
}

/**
 * Where the refund goes. With money to refund the reviewer must name the account explicitly;
 * any account other than the one the customer gave (or when they gave none, as older app
 * versions never ask) needs a reason, and the reviewer is recorded as having chosen it.
 * Without a refund no account is kept. `bankAccount` arrives already verified at the bank.
 */
export function chooseRefundAccount(args: {
  refundAmount: number;
  customerAccount: RefundBankAccount | null;
  bankAccount?: RefundBankAccount;
  overrideReason?: string;
  actorId: string;
}): RefundAccountChoice {
  if (args.refundAmount <= 0) return { bankAccount: null, overrideBy: null, overrideReason: null };
  if (!args.bankAccount) {
    throw new DomainException(
      ErrorCode.REFUND_ACCOUNT_REQUIRED,
      'Có tiền cọc cần hoàn — nhập tài khoản nhận tiền hoàn',
      HttpStatus.CONFLICT,
      { refundAmount: args.refundAmount },
    );
  }
  const account = args.bankAccount;
  if (args.customerAccount && sameAccount(account, args.customerAccount)) {
    return { bankAccount: account, overrideBy: null, overrideReason: null };
  }
  const reason = args.overrideReason?.trim();
  if (!reason) {
    throw fieldValidationError(
      'bankOverrideReason',
      'required',
      args.customerAccount
        ? 'Tài khoản khác tài khoản khách đã cung cấp — nhập lý do'
        : 'Khách chưa cung cấp tài khoản — nhập lý do (ví dụ: khách cung cấp qua kênh khác)',
    );
  }
  return { bankAccount: account, overrideBy: args.actorId, overrideReason: reason };
}
