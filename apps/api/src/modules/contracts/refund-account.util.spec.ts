import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { RefundAccountDto } from './dto/refund-account.dto';
import {
  loadSavedRefundAccount,
  rememberRefundAccount,
  toAccountHolderName,
  toRefundBankAccount,
} from './refund-account.util';

const validate = (body: unknown) =>
  createApiValidationPipe().transform(body, { type: 'body', metatype: RefundAccountDto });

const listed = {
  bankBin: '970436',
  bankName: 'whatever the client shows',
  accountNo: '0123456789',
  accountName: 'Nguyễn Văn Ạ',
};

describe('toAccountHolderName', () => {
  it.each([
    ['Nguyễn Văn Ạ', 'NGUYEN VAN A'],
    ['  trần   thị  đào ', 'TRAN THI DAO'],
    ['ĐẶNG Quốc Bảo', 'DANG QUOC BAO'],
    ['NGUYEN VAN A', 'NGUYEN VAN A'],
  ])('writes %j as banks print it', (input, expected) => {
    expect(toAccountHolderName(input)).toBe(expected);
  });
});

describe('toRefundBankAccount', () => {
  it('names a listed bank from VN_BANKS whatever name the client sent', () => {
    expect(toRefundBankAccount(listed)).toEqual({
      bankBin: '970436',
      bankName: 'Vietcombank',
      accountNo: '0123456789',
      accountName: 'NGUYEN VAN A',
    });
  });

  it('keeps the typed name and no BIN for an unlisted bank', () => {
    expect(
      toRefundBankAccount({
        bankName: ' Ngân hàng Hợp tác ',
        accountNo: 'AB1234',
        accountName: 'Lê B',
      }),
    ).toEqual({
      bankBin: null,
      bankName: 'Ngân hàng Hợp tác',
      accountNo: 'AB1234',
      accountName: 'LE B',
    });
  });

  it('refuses a BIN that is not listed', () => {
    expect(() => toRefundBankAccount({ ...listed, bankBin: '000000' })).toThrow(RangeError);
  });
});

describe('RefundAccountDto', () => {
  it('normalises the holder name and accepts a listed bank without a name', async () => {
    const { bankName: _name, ...withoutName } = listed;

    await expect(validate(withoutName)).resolves.toMatchObject({
      bankBin: '970436',
      accountName: 'NGUYEN VAN A',
    });
  });

  it.each([
    ['omitted', {}],
    ['null', { bankBin: null }],
    ['empty', { bankBin: '' }],
  ])('treats a BIN that is %s as another bank', async (_label, bin) => {
    const body = { bankName: 'Ngân hàng X', accountNo: '12345678', accountName: 'Le B', ...bin };

    await expect(validate(body)).resolves.toMatchObject({ bankName: 'Ngân hàng X' });
  });

  it.each([
    ['a BIN outside VN_BANKS', { ...listed, bankBin: '000000' }, 'bankBin'],
    ['no bank name for another bank', { accountNo: '12345678', accountName: 'Le B' }, 'bankName'],
    [
      'a bank name over 100 characters',
      { ...listed, bankBin: null, bankName: 'x'.repeat(101) },
      'bankName',
    ],
    ['an account number with symbols', { ...listed, accountNo: '0123-4567' }, 'accountNo'],
    ['an account number under 4 characters', { ...listed, accountNo: '123' }, 'accountNo'],
    ['an account number over 30 characters', { ...listed, accountNo: '1'.repeat(31) }, 'accountNo'],
    ['a one-letter holder name', { ...listed, accountName: ' Ạ ' }, 'accountName'],
    [
      'a holder name over 100 characters',
      { ...listed, accountName: 'A'.repeat(101) },
      'accountName',
    ],
    ['unknown fields', { ...listed, branch: 'HCM' }, 'branch'],
  ])('rejects %s', async (_label, body, field) => {
    await expect(validate(body)).rejects.toMatchObject({
      status: 400,
      response: {
        details: { fields: expect.arrayContaining([expect.objectContaining({ field })]) },
      },
    });
  });
});

describe('saved refund account', () => {
  const account = toRefundBankAccount(listed);

  it('upserts it on the customer profile, creating the row when missing', async () => {
    const em = { query: jest.fn().mockResolvedValue([]) };

    await rememberRefundAccount(em as never, 'customer-1', account);

    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO customer_profiles (user_id, refund_bank_account)');
    expect(sql).toContain('ON CONFLICT ("user_id") DO UPDATE');
    expect(params).toEqual(['customer-1', JSON.stringify(account)]);
  });

  it('reads it back from a live profile only', async () => {
    const em = { query: jest.fn().mockResolvedValue([{ account }]) };

    await expect(loadSavedRefundAccount(em as never, 'customer-1')).resolves.toEqual(account);
    expect(em.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    expect(em.query.mock.calls[0][1]).toEqual(['customer-1']);
  });

  it.each([
    ['no profile', []],
    ['no saved account', [{ account: null }]],
    ['a malformed saved account', [{ account: { bankName: 'X' } }]],
  ])('pre-fills nothing with %s', async (_label, rows) => {
    const em = { query: jest.fn().mockResolvedValue(rows) };

    await expect(loadSavedRefundAccount(em as never, 'customer-1')).resolves.toBeNull();
  });

  it('reads an unlisted bank back without a BIN', async () => {
    const other = {
      bankBin: null,
      bankName: 'Ngân hàng X',
      accountNo: '1234',
      accountName: 'LE B',
    };
    const em = { query: jest.fn().mockResolvedValue([{ account: other }]) };

    await expect(loadSavedRefundAccount(em as never, 'customer-1')).resolves.toEqual(other);
  });
});
