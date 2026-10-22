jest.mock('./settlement-input.loader', () => ({
  ...jest.requireActual('./settlement-input.loader'),
  loadEndedContract: jest.fn(),
  loadSettlementInput: jest.fn(),
}));
jest.mock('./unstarted-invoices.util', () => ({ voidUnstartedInvoices: jest.fn(async () => []) }));

import { ContractSettlement } from '@entities/contract-settlement.entity';
import { Deposit } from '@entities/deposit.entity';
import { Invoice } from '@entities/invoice.entity';
import { Payment } from '@entities/payment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  ContractStatus,
  DamageSeverity,
  DepositStatus,
  InvoiceKind,
  InvoiceStatus,
  NotificationType,
  PaymentMethod,
  PaymentType,
  type SettlementDecisionsInput,
  SettlementStatus,
  UserRole,
} from '@storage/types';
import type { ReturnTiming } from './return-timing';
import { SettlementApproveService } from './settlement-approve.service';
import type { CalcInvoice } from './settlement-calc';
import {
  loadEndedContract,
  loadSettlementInput,
  type SettlementInput,
} from './settlement-input.loader';
import { evaluateSettlement } from './settlement-query.service';
import { voidUnstartedInvoices } from './unstarted-invoices.util';

const E = '2027-04-01';
const OPS = { id: 'ops-1', roles: [UserRole.OPERATIONS_MANAGER] } as unknown as AuthUser;
const ACCOUNT = {
  bankBin: '970436',
  bankName: 'Vietcombank',
  accountNo: '0123456789',
  accountName: 'NGUYEN VAN A',
};
const TIMING = {
  effectiveReturnDay: E,
  shortNotice: false,
  overstayDays: 0,
  termEndAt: new Date('2027-04-01T00:00:00+07:00'),
} as ReturnTiming;
const contract = {
  id: 'contract-1',
  contractNo: 'CT-1',
  customerId: 'customer-1',
  status: ContractStatus.ENDED,
  monthlyPriceSnapshot: '1000000.00',
};
const rent = (id: string, total: number, dueAt: string, over: Partial<CalcInvoice> = {}) => ({
  id,
  invoiceNo: `INV-${id}`,
  kind: InvoiceKind.INITIAL,
  status: InvoiceStatus.ISSUED,
  startAt: new Date(dueAt),
  dueAt: new Date(dueAt),
  total,
  ...over,
});

describe('SettlementApproveService', () => {
  let input: SettlementInput;
  let em: Record<string, jest.Mock>;
  let saved: { entity: unknown; data: Record<string, any> }[];
  let notifications: { createForUsers: jest.Mock };
  let query: { detail: jest.Mock };
  let banks: { verifyAccount: jest.Mock };
  let service: SettlementApproveService;

  const build = (over: Partial<SettlementInput> = {}): SettlementInput =>
    ({
      inspection: { id: 'return-1' },
      returnedOn: E,
      rules: { noticeDays: 30, penaltyPercent: 100 },
      timing: TIMING,
      depositRecord: {
        id: 'dep-1',
        contractId: 'contract-1',
        paymentId: 'pay-dep',
        amount: '2000000.00',
        heldAmount: '2000000.00',
        status: DepositStatus.HELD,
      },
      deposit: { amount: '2000000.00', paymentId: 'pay-dep' },
      customerBankAccount: ACCOUNT,
      invoices: [],
      payments: [],
      damages: [],
      ...over,
    }) as SettlementInput;
  const versionOf = (decisions: SettlementDecisionsInput = {}) =>
    evaluateSettlement(input, decisions).version;
  const payments = () => saved.filter((s) => s.entity === Payment).map((s) => s.data);
  const inserted = () => em.insert.mock.calls[0]?.[1];

  beforeEach(() => {
    input = build();
    saved = [];
    (loadEndedContract as jest.Mock).mockResolvedValue(contract);
    (loadSettlementInput as jest.Mock).mockImplementation(async () => input);
    (voidUnstartedInvoices as jest.Mock).mockClear();
    em = {
      exists: jest.fn(async () => false),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (entity, data) => {
        if (Array.isArray(data)) return data;
        saved.push({ entity, data });
        return entity === Invoice ? { id: 'fee-inv', ...data } : data;
      }),
      update: jest.fn(async () => ({ affected: 1 })),
      insert: jest.fn(async () => ({})),
      query: jest.fn(async () => [[], 0]),
      getRepository: jest.fn(() => ({
        sum: jest.fn(async (_field, where) =>
          payments()
            .filter((p) => p.invoiceId === where.invoiceId)
            .reduce((sum, p) => sum + p.amount, 0),
        ),
      })),
    };
    notifications = { createForUsers: jest.fn(async () => 1) };
    // The bank answers with its own bank name and holder name.
    banks = {
      verifyAccount: jest.fn(async (input: { bankBin: string; accountNo: string }) => ({
        bankBin: input.bankBin,
        bankName: 'Vietcombank',
        accountNo: input.accountNo,
        accountName: 'NGUYEN VAN A',
      })),
    };
    query = { detail: jest.fn(async () => ({ status: 'detail' })) };
    service = new SettlementApproveService(
      { transaction: jest.fn((cb) => cb(em)) } as never,
      {} as never,
      notifications as never,
      query as never,
      banks as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('offsets debts oldest first, settles the fees from the deposit and awaits the refund', async () => {
    input = build({
      invoices: [
        rent('a', 500000, '2027-03-05T00:00:00+07:00'),
        rent('b', 300000, '2027-02-01T00:00:00+07:00'),
        rent('void', 1000000, '2027-04-01T00:00:00+07:00', { status: InvoiceStatus.VOID }),
      ],
      payments: [
        {
          id: 'pay-credit',
          invoiceId: 'void',
          method: PaymentMethod.BANK_TRANSFER,
          amount: 1000000,
          metadata: {},
        },
      ],
      damages: [
        {
          index: 0,
          description: 'Móp cửa',
          severity: DamageSeverity.MAJOR,
          proposedFee: 400000,
          evidence: [],
        },
      ],
    });
    const decisions = { damageDecisions: [{ index: 0, amount: 400000 }] };
    // Approved late in the evening (Vietnam): due 7 Vietnam days later, at 00:00.
    jest.useFakeTimers({ now: new Date('2027-04-01T23:30:00+07:00') });

    const result = await service.approve(
      'contract-1',
      { ...decisions, expectedVersion: versionOf(decisions), bankAccount: ACCOUNT, note: ' ok ' },
      OPS,
    );

    expect(result).toEqual({ status: 'detail' });
    expect(voidUnstartedInvoices).toHaveBeenCalledWith(em, 'contract-1', E);
    expect(payments().map((p) => [p.invoiceId, p.amount, p.type, p.method])).toEqual([
      ['b', 300000, PaymentType.RENT, PaymentMethod.DEPOSIT],
      ['a', 500000, PaymentType.RENT, PaymentMethod.DEPOSIT],
      ['fee-inv', 400000, PaymentType.FEE, PaymentMethod.DEPOSIT],
    ]);
    const fee = saved.find((s) => s.entity === Invoice)?.data;
    expect(fee).toMatchObject({
      kind: InvoiceKind.SETTLEMENT,
      periodNo: 1,
      taxAmount: 0,
      total: 400000,
      status: InvoiceStatus.ISSUED,
      dueAt: new Date('2027-04-08T00:00:00+07:00'),
    });
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'fee-inv' },
      { status: InvoiceStatus.PAID },
    );
    expect(em.update).toHaveBeenCalledWith(Invoice, { id: 'b' }, { status: InvoiceStatus.PAID });
    const settlementId = inserted().id;
    expect(payments().every((p) => p.metadata.settlementId === settlementId)).toBe(true);
    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE payments'), [
      settlementId,
      ['pay-credit'],
    ]);
    expect(em.insert).toHaveBeenCalledWith(
      ContractSettlement,
      expect.objectContaining({
        status: SettlementStatus.AWAITING_REFUND,
        depositId: 'dep-1',
        refundAmount: 1800000,
        shortfallAmount: 0,
        feeInvoiceId: 'fee-inv',
        bankAccount: ACCOUNT,
        bankOverrideBy: null,
        approvedBy: 'ops-1',
        completedAt: null,
        note: 'ok',
      }),
    );
    // The deposit stays held until the transfer is confirmed.
    expect(em.update).not.toHaveBeenCalledWith(Deposit, expect.anything(), expect.anything());
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      em,
      ['customer-1'],
      expect.objectContaining({ type: NotificationType.SETTLEMENT_APPROVED }),
    );
  });

  it('bills the shortfall and completes at once when nothing is left to refund', async () => {
    input = build({
      depositRecord: {
        ...build().depositRecord,
        amount: '1000000',
        heldAmount: '1000000',
      } as never,
      deposit: { amount: '1000000', paymentId: null },
      invoices: [rent('a', 800000, '2027-03-01T00:00:00+07:00')],
      damages: [
        {
          index: 0,
          description: 'Vỡ kính',
          severity: DamageSeverity.MINOR,
          proposedFee: null,
          evidence: [],
        },
      ],
    });
    const decisions = { damageDecisions: [{ index: 0, amount: 700000 }] };

    await service.approve(
      'contract-1',
      { ...decisions, expectedVersion: versionOf(decisions) },
      OPS,
    );

    expect(payments().map((p) => [p.invoiceId, p.amount])).toEqual([
      ['a', 800000],
      ['fee-inv', 200000],
    ]);
    expect(em.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'fee-inv' },
      { status: InvoiceStatus.PARTIALLY_PAID },
    );
    expect(em.update).toHaveBeenCalledWith(
      Deposit,
      { id: 'dep-1' },
      { heldAmount: 0, status: DepositStatus.FORFEITED },
    );
    expect(notifications.createForUsers.mock.calls[0][2].data).toMatchObject({
      invoiceIds: ['fee-inv'],
      openInvoices: [{ invoiceId: 'fee-inv', amountDue: 500000 }],
    });
    expect(inserted()).toMatchObject({
      status: SettlementStatus.COMPLETED,
      shortfallAmount: 500000,
      bankAccount: null,
      completedBy: 'ops-1',
      completedAt: expect.any(Date),
    });
  });

  describe('telling the customer what is still owed', () => {
    const shortDeposit = (over: Partial<SettlementInput>) =>
      build({
        depositRecord: {
          ...build().depositRecord,
          amount: '1000000',
          heldAmount: '1000000',
        } as never,
        deposit: { amount: '1000000', paymentId: null },
        ...over,
      });
    const notified = () => notifications.createForUsers.mock.calls[0][2];

    it('lists the rent left on its own invoice and the fees on the settlement invoice', async () => {
      input = shortDeposit({
        invoices: [rent('a', 1500000, '2027-03-01T00:00:00+07:00')],
        damages: [
          {
            index: 0,
            description: 'Móp',
            severity: DamageSeverity.MINOR,
            proposedFee: null,
            evidence: [],
          },
        ],
      });
      const decisions = { damageDecisions: [{ index: 0, amount: 300000 }] };
      jest.useFakeTimers({ now: new Date('2027-04-01T10:00:00+07:00') });

      await service.approve(
        'contract-1',
        { ...decisions, expectedVersion: versionOf(decisions) },
        OPS,
      );

      // The deposit pays 1.000.000 of the rent; nothing is left for the fee invoice.
      expect(payments().map((p) => [p.invoiceId, p.amount])).toEqual([['a', 1000000]]);
      expect(inserted()).toMatchObject({ shortfallAmount: 800000, feeInvoiceId: 'fee-inv' });
      const feeNo = saved.find((x) => x.entity === Invoice)?.data.invoiceNo;
      const payload = notified();
      expect(payload.body).toContain('hoá đơn INV-a còn 500.000 VND (hạn 01/03/2027)');
      expect(payload.body).toContain(`hoá đơn ${feeNo} còn 300.000 VND (hạn 08/04/2027)`);
      expect(payload.body).not.toContain('800.000');
      expect(payload.data).toMatchObject({
        shortfallAmount: 800000,
        feeInvoiceId: 'fee-inv',
        invoiceIds: ['a', 'fee-inv'],
        openInvoices: [
          { invoiceId: 'a', invoiceNo: 'INV-a', amountDue: 500000 },
          { invoiceId: 'fee-inv', invoiceNo: feeNo, amountDue: 300000 },
        ],
      });
    });

    it('names the unpaid rent invoice when there are no fees', async () => {
      input = shortDeposit({ invoices: [rent('a', 1500000, '2027-03-01T00:00:00+07:00')] });

      await service.approve('contract-1', { expectedVersion: versionOf() }, OPS);

      expect(saved.some((x) => x.entity === Invoice)).toBe(false);
      const payload = notified();
      expect(payload.body).toContain('hoá đơn INV-a còn 500.000 VND');
      expect(payload.body).not.toContain('Tiền cọc đã được cấn trừ hết');
      expect(payload.data).toMatchObject({
        feeInvoiceId: null,
        invoiceIds: ['a'],
        openInvoices: [{ invoiceId: 'a', amountDue: 500000 }],
      });
    });

    it('says the deposit covered everything when nothing is left to pay', async () => {
      input = shortDeposit({ invoices: [rent('a', 1000000, '2027-03-01T00:00:00+07:00')] });

      await service.approve('contract-1', { expectedVersion: versionOf() }, OPS);

      expect(notified().body).toContain('Tiền cọc đã được cấn trừ hết.');
      expect(notified().data).toMatchObject({ invoiceIds: [], openInvoices: [] });
    });
  });

  it('approves for a customer on the old app: account and fee entered by operations', async () => {
    input = build({
      customerBankAccount: null,
      damages: [
        {
          index: 0,
          description: 'Trầy',
          severity: DamageSeverity.MINOR,
          proposedFee: null,
          evidence: [],
        },
      ],
    });
    const decisions = { damageDecisions: [{ index: 0, amount: 150000 }] };
    const dto = {
      ...decisions,
      expectedVersion: versionOf(decisions),
      bankAccount: { bankBin: '970418', accountNo: '999988887777' },
    };

    await expect(service.approve('contract-1', dto, OPS)).rejects.toMatchObject({
      status: 400,
      response: { details: { fields: [{ field: 'bankOverrideReason' }] } },
    });

    await service.approve(
      'contract-1',
      { ...dto, bankOverrideReason: 'Khách cung cấp qua kênh khác' },
      OPS,
    );
    expect(inserted()).toMatchObject({
      refundAmount: 1850000,
      customerBankAccount: null,
      bankAccount: { bankBin: '970418', accountNo: '999988887777', accountName: 'NGUYEN VAN A' },
      bankOverrideBy: 'ops-1',
      bankOverrideReason: 'Khách cung cấp qua kênh khác',
    });
  });

  it('stores the account as the bank reports it, looked up before any lock', async () => {
    const dto = {
      expectedVersion: versionOf(),
      bankAccount: { ...ACCOUNT, accountName: 'typed by hand' },
    };
    await service.approve('contract-1', dto, OPS);

    expect(banks.verifyAccount).toHaveBeenCalledWith(dto.bankAccount);
    expect(banks.verifyAccount.mock.invocationCallOrder[0]).toBeLessThan(
      (em.exists as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(inserted()).toMatchObject({ bankAccount: ACCOUNT, bankOverrideBy: null });
  });

  it('approves nothing when the bank rejects the account', async () => {
    banks.verifyAccount.mockRejectedValueOnce(Object.assign(new Error('invalid'), { status: 400 }));
    await expect(
      service.approve('contract-1', { expectedVersion: versionOf(), bankAccount: ACCOUNT }, OPS),
    ).rejects.toMatchObject({ status: 400 });
    expect(em.insert).not.toHaveBeenCalled();
  });

  it('needs a reason to send the refund elsewhere than the customer asked', async () => {
    const other = { ...ACCOUNT, accountNo: '5555666677' };
    const dto = { expectedVersion: versionOf(), bankAccount: other };
    await expect(service.approve('contract-1', dto, OPS)).rejects.toMatchObject({ status: 400 });
    await service.approve('contract-1', { ...dto, bankOverrideReason: 'Khách đổi TK' }, OPS);
    expect(inserted()).toMatchObject({ bankAccount: other, bankOverrideBy: 'ops-1' });
  });

  it('requires an explicit account when there is money to refund', async () => {
    await expect(
      service.approve('contract-1', { expectedVersion: versionOf() }, OPS),
    ).rejects.toMatchObject({ status: 409, response: { code: 'REFUND_ACCOUNT_REQUIRED' } });
  });

  it('refuses a second approval', async () => {
    em.exists.mockResolvedValue(true);
    await expect(
      service.approve('contract-1', { expectedVersion: versionOf() }, OPS),
    ).rejects.toMatchObject({ status: 409, response: { code: 'SETTLEMENT_ALREADY_APPROVED' } });
    expect(loadSettlementInput).not.toHaveBeenCalledWith(em, expect.anything(), expect.anything(), {
      lock: true,
    });
  });

  it('maps a concurrent approval caught by the unique contract to the same 409', async () => {
    em.insert.mockRejectedValue({ code: '23505', constraint: 'UQ_contract_settlements_contract' });
    await expect(
      service.approve('contract-1', { expectedVersion: versionOf(), bankAccount: ACCOUNT }, OPS),
    ).rejects.toMatchObject({ status: 409, response: { code: 'SETTLEMENT_ALREADY_APPROVED' } });
  });

  it('refuses figures that changed since the reviewer loaded them', async () => {
    const expectedVersion = versionOf();
    input = build({ invoices: [rent('a', 100000, '2027-03-01T00:00:00+07:00')] });
    await expect(
      service.approve('contract-1', { expectedVersion, bankAccount: ACCOUNT }, OPS),
    ).rejects.toMatchObject({ status: 409, response: { code: 'SETTLEMENT_CHANGED' } });
    expect(em.save).not.toHaveBeenCalled();
  });

  it('requires a decision for every damage and reviewed payment', async () => {
    input = build({
      invoices: [rent('void', 500000, '2027-04-01T00:00:00+07:00', { status: InvoiceStatus.VOID })],
      payments: [
        {
          id: 'pay-review',
          invoiceId: 'void',
          method: PaymentMethod.BANK_TRANSFER,
          amount: 500000,
          metadata: { needsReview: 'invoice VOID' },
        },
      ],
      damages: [
        {
          index: 0,
          description: 'Móp',
          severity: DamageSeverity.MINOR,
          proposedFee: 1,
          evidence: [],
        },
      ],
    });
    await expect(
      service.approve('contract-1', { expectedVersion: versionOf(), bankAccount: ACCOUNT }, OPS),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'DECISION_REQUIRED',
        details: { damageIndexes: [0], paymentIds: ['pay-review'] },
      },
    });
  });

  it('refuses while the deposit paid cannot be determined', async () => {
    input = build({ depositRecord: null, deposit: null });
    await expect(
      service.approve('contract-1', { expectedVersion: versionOf() }, OPS),
    ).rejects.toMatchObject({ status: 409, response: { code: 'DEPOSIT_MISSING' } });
    expect(em.save).not.toHaveBeenCalled();
  });
});
