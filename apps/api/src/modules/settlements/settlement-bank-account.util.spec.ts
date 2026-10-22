import { chooseRefundAccount } from './settlement-bank-account.util';

const customerAccount = {
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '7862328531',
  accountName: 'Nguyen Anh Tu typed',
};
const verified = { ...customerAccount, accountName: 'NGUYEN ANH TU' };
const base = { refundAmount: 500_000, customerAccount, actorId: 'ops-1' };

describe('chooseRefundAccount', () => {
  it('treats the same bank and number as the customer account whatever the holder name', () => {
    expect(chooseRefundAccount({ ...base, bankAccount: verified })).toEqual({
      bankAccount: verified,
      overrideBy: null,
      overrideReason: null,
    });
  });

  it('needs a reason for another number at the same bank', () => {
    expect(() =>
      chooseRefundAccount({ ...base, bankAccount: { ...verified, accountNo: '1111222233' } }),
    ).toThrow();
  });

  it('needs a reason for the same number at another bank', () => {
    expect(() =>
      chooseRefundAccount({ ...base, bankAccount: { ...verified, bankBin: '970418' } }),
    ).toThrow();
  });

  it('keeps no account when nothing is refunded', () => {
    expect(chooseRefundAccount({ ...base, refundAmount: 0, bankAccount: verified })).toEqual({
      bankAccount: null,
      overrideBy: null,
      overrideReason: null,
    });
  });
});
