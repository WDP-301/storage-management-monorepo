jest.mock('./settlement-input.loader', () => ({
  ...jest.requireActual('./settlement-input.loader'),
  loadEndedContract: jest.fn(),
  loadSettlementInput: jest.fn(),
}));

import { ContractStatus, DepositStatus, InvoiceStatus, SettlementStatus } from '@storage/types';
import type { ReturnTiming } from './return-timing';
import { loadEndedContract, loadSettlementInput } from './settlement-input.loader';
import { SettlementQueryService } from './settlement-query.service';

const ACCOUNT = {
  bankBin: '970436',
  bankName: 'VCB',
  accountNo: '0123456789',
  accountName: 'TRAN B',
};
const contract = {
  id: 'contract-1',
  contractNo: 'CT-1',
  customerId: 'customer-1',
  status: ContractStatus.ENDED,
  monthlyPriceSnapshot: '1000000.00',
  customerSnapshot: { fullName: 'Nguyễn Văn A', phone: '0900', email: 'a@x.vn' },
  bookingItem: {
    storageUnit: {
      id: 'u-1',
      code: 'A1',
      name: 'Kho A1',
      facility: { id: 'f', code: 'HCM', name: 'CN' },
    },
  },
};
const input = (over: Record<string, unknown> = {}) => ({
  inspection: {
    id: 'return-1',
    createdAt: new Date('2027-03-01'),
    evidence: [],
    requester: { fullName: 'Hotline' },
  },
  returnedOn: '2027-04-01',
  rules: { noticeDays: 30, penaltyPercent: 100 },
  timing: {
    effectiveReturnDay: '2027-04-01',
    termEndAt: new Date('2027-04-01'),
    shortNotice: false,
    overstayDays: 0,
  } as ReturnTiming,
  depositRecord: {
    id: null,
    paymentId: null,
    amount: '2000000',
    heldAmount: '2000000',
    status: DepositStatus.HELD,
  },
  deposit: { amount: '2000000', paymentId: null },
  customerBankAccount: ACCOUNT,
  invoices: [],
  payments: [],
  damages: [],
  ...over,
});

describe('SettlementQueryService', () => {
  let settlement: Record<string, unknown> | null;
  let em: Record<string, jest.Mock>;
  let service: SettlementQueryService;

  beforeEach(() => {
    settlement = null;
    (loadEndedContract as jest.Mock).mockResolvedValue(contract);
    (loadSettlementInput as jest.Mock).mockResolvedValue(input());
    em = {
      findOne: jest.fn(async () => settlement),
      exists: jest.fn(async () => settlement !== null),
      getRepository: jest.fn(() => ({ sum: jest.fn(async () => 100000) })),
    };
    service = new SettlementQueryService({ manager: em } as never, {} as never);
  });

  it('previews a pending settlement and warns when the account holder is someone else', async () => {
    const record = await service.detail('contract-1');
    expect(record).toMatchObject({
      status: 'PENDING',
      deposit: { id: null, amount: 2000000, status: DepositStatus.HELD },
      totals: { refund_amount: 2000000 },
      customer_bank_account: ACCOUNT,
      bank_account: null,
      transfer_content: 'HOAN COC CT-1',
      refund_qr_url: null,
      contract: { customer: { full_name: 'Nguyễn Văn A', phone: '0900' }, unit: { code: 'A1' } },
      return: { requested_by_name: 'Hotline', returned_on: '2027-04-01' },
    });
    expect(record.version).toMatch(/^[0-9a-f]{64}$/);
    expect(record.warnings.map((w) => w.code)).toEqual(['ACCOUNT_NAME_MISMATCH']);
  });

  it('flags an unknown deposit and gives no totals', async () => {
    (loadSettlementInput as jest.Mock).mockResolvedValue(
      input({ depositRecord: null, deposit: null, customerBankAccount: null }),
    );
    const record = await service.detail('contract-1');
    expect(record.totals).toBeNull();
    expect(record.warnings.map((w) => w.code)).toEqual(['DEPOSIT_MISSING']);
  });

  it('shows an approved settlement frozen, with the refund QR and what the fee invoice still owes', async () => {
    settlement = {
      id: 's-1',
      status: SettlementStatus.AWAITING_REFUND,
      depositId: 'dep-1',
      deposit: { status: DepositStatus.HELD, paymentId: null },
      lines: [],
      depositAmount: '2000000.00',
      creditsTotal: '0',
      deductionsTotal: '500000',
      refundAmount: '1500000.00',
      shortfallAmount: '0',
      bankAccount: { ...ACCOUNT, accountName: 'NGUYEN VAN A' },
      customerBankAccount: null,
      bankOverrideReason: 'Khách cung cấp qua kênh khác',
      bankOverrider: { fullName: 'Ops' },
      approver: { fullName: 'Ops' },
      approvedAt: new Date('2027-04-02'),
      evidence: [],
      feeInvoice: {
        id: 'fee-1',
        invoiceNo: 'INV-F',
        status: InvoiceStatus.PARTIALLY_PAID,
        total: '300000',
      },
    };
    const record = await service.detail('contract-1');
    expect(record).toMatchObject({
      status: SettlementStatus.AWAITING_REFUND,
      deposit: { id: 'dep-1', amount: 2000000 },
      totals: { refund_amount: 1500000 },
      customer_bank_account: null,
      bank_override: { by_name: 'Ops', reason: 'Khách cung cấp qua kênh khác' },
      fee_invoice: { id: 'fee-1', total: 300000, amount_due: 200000 },
      approved_by_name: 'Ops',
      warnings: [],
    });
    expect(record.refund_qr_url).toContain('970436-0123456789');
    expect(record.refund_qr_url).toContain('amount=1500000');
    expect(record.refund_qr_url).toContain('HOAN+COC+CT-1');
  });

  it('refuses to preview decisions once approved', async () => {
    settlement = { id: 's-1' };
    await expect(service.preview('contract-1', {})).rejects.toMatchObject({
      status: 409,
      response: { code: 'SETTLEMENT_ALREADY_APPROVED' },
    });
  });
});
