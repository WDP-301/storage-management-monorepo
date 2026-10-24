import { chooseRefundAccount, loadCustomerRefundAccount } from './settlement-bank-account.util';

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

describe('loadCustomerRefundAccount', () => {
  const GIVEN = { bankBin: '970436', bankName: 'Vietcombank', accountNo: '1111', accountName: 'A' };
  const SAVED = { bankBin: '970415', bankName: 'VietinBank', accountNo: '2222', accountName: 'B' };
  const emWith = (saved: unknown) => ({ query: jest.fn(async () => [{ account: saved }]) });

  it('uses the account given with the return request, without reading the saved one', async () => {
    const em = emWith(SAVED);

    await expect(
      loadCustomerRefundAccount(em as never, { refundAccount: GIVEN }, 'customer-1'),
    ).resolves.toEqual({ account: GIVEN, source: 'RETURN_REQUEST' });
    expect(em.query).not.toHaveBeenCalled();
  });

  it('falls back to the account the customer saved with an earlier request', async () => {
    const em = emWith(SAVED);

    await expect(
      loadCustomerRefundAccount(em as never, { refundAccount: null }, 'customer-1'),
    ).resolves.toEqual({ account: SAVED, source: 'SAVED' });
    expect(em.query).toHaveBeenCalledWith(expect.any(String), ['customer-1']);
  });

  it('has no account when the customer never gave one', async () => {
    await expect(
      loadCustomerRefundAccount(emWith(null) as never, { refundAccount: null }, 'customer-1'),
    ).resolves.toEqual({ account: null, source: null });
  });
});
