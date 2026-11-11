import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import { assertWorksAtFacility, worksAtFacility } from '@modules/access/staff-facility.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { UserRole } from '@storage/types';
import { loadDropOffRequests } from './drop-off-request.read';
import { loadPickupRequests } from './pickup-request.read';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { loadReceipts } from './shelf-receipt.read';
import { ShelfStorageReadsService } from './shelf-storage-reads.service';
import { loadWarehouseStock } from './warehouse-stock.read';

jest.mock('@modules/access/overdue-invoices.query');
jest.mock('@modules/access/staff-facility.util');
jest.mock('./drop-off-request.read');
jest.mock('./pickup-request.read');
jest.mock('./shelf-contract.query');
jest.mock('./shelf-receipt.read');
jest.mock('./warehouse-stock.read');

const customer = { id: 'cust-1', roles: [UserRole.CUSTOMER] } as AuthUser;
const staff = { id: 'staff-1', roles: [UserRole.FACILITY_STAFF] } as AuthUser;
const admin = { id: 'admin-1', roles: [UserRole.ADMIN] } as AuthUser;

describe('ShelfStorageReadsService', () => {
  let contract: Record<string, unknown>;
  let receipt: Record<string, unknown>;
  let items: { id: string; name: string; quantity: number }[];
  let em: { findOne: jest.Mock };
  let service: ShelfStorageReadsService;

  beforeEach(() => {
    contract = {
      id: 'c-1',
      contractNo: 'HD-1',
      status: 'ACTIVE',
      customerId: 'cust-1',
      returnOpen: false,
      shelf: { id: 's-1' },
      warehouse: { id: 'w-1' },
      facility: { id: 'f-1' },
    };
    receipt = { id: 'r-1', contractId: 'c-1', customer: { id: 'cust-1' }, facility: { id: 'f-1' } };
    items = [{ id: 'i-1', name: 'Sách', quantity: 2 }];
    em = { findOne: jest.fn(async () => ({ id: 'w-1', facilityId: 'f-1' })) };
    jest
      .mocked(findShelfContracts)
      .mockImplementation(async () => (contract ? [contract as never] : []));
    jest.mocked(loadStock).mockImplementation(async () => new Map([['c-1', items as never]]));
    jest.mocked(loadPickupRequests).mockResolvedValue([]);
    jest.mocked(loadDropOffRequests).mockResolvedValue([]);
    jest.mocked(findOverdueInvoiceNos).mockResolvedValue([]);
    jest.mocked(worksAtFacility).mockResolvedValue(true);
    jest.mocked(assertWorksAtFacility).mockResolvedValue(undefined);
    jest.mocked(loadReceipts).mockImplementation(async () => ({
      receipts: receipt ? [receipt as never] : [],
      total: 41,
    }));
    service = new ShelfStorageReadsService({ manager: em } as never);
  });

  describe('getReceipt', () => {
    it('shows a customer their own receipt', async () => {
      await expect(service.getReceipt(customer, 'r-1')).resolves.toBe(receipt);
    });

    it("answers 404 for another customer's receipt", async () => {
      await expect(service.getReceipt({ ...customer, id: 'cust-2' }, 'r-1')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('answers 404 for an unknown receipt', async () => {
      receipt = undefined as never;
      await expect(service.getReceipt(staff, 'r-1')).rejects.toMatchObject({ status: 404 });
    });

    it('lets staff read their own receipt even at a facility they do not work at', async () => {
      receipt.customer = { id: staff.id };
      jest.mocked(worksAtFacility).mockResolvedValue(false);
      await expect(service.getReceipt(staff, 'r-1')).resolves.toBe(receipt);
    });

    it('answers 403 to staff of another facility, and lets a global manager through', async () => {
      jest.mocked(worksAtFacility).mockResolvedValueOnce(false);
      await expect(service.getReceipt(staff, 'r-1')).rejects.toMatchObject({ status: 403 });
      await expect(service.getReceipt(admin, 'r-1')).resolves.toBe(receipt);
    });
  });

  describe('getContract', () => {
    it('returns stock and lets the customer ask for a pick-up', async () => {
      await expect(service.getContract(customer, 'c-1')).resolves.toMatchObject({
        contractId: 'c-1',
        contractStatus: 'ACTIVE',
        items,
        openRequest: null,
        pickupRequestBlock: null,
        openDropOffRequest: null,
        dropOffRequestBlock: null,
      });
    });

    it('wires the block reasons: no stock, open request, overdue, not active', async () => {
      items = [];
      expect((await service.getContract(customer, 'c-1')).pickupRequestBlock).toBe('NO_STOCK');

      items = [{ id: 'i-1', name: 'Sách', quantity: 2 }];
      jest.mocked(loadPickupRequests).mockResolvedValueOnce([{ id: 'q-1' } as never]);
      expect((await service.getContract(customer, 'c-1')).pickupRequestBlock).toBe(
        'OPEN_REQUEST_EXISTS',
      );

      jest.mocked(findOverdueInvoiceNos).mockResolvedValueOnce(['INV-1']);
      expect((await service.getContract(customer, 'c-1')).pickupRequestBlock).toBe(
        'INVOICE_OVERDUE',
      );

      jest.mocked(findOverdueInvoiceNos).mockResolvedValueOnce(['INV-1']);
      contract.returnOpen = true;
      expect((await service.getContract(customer, 'c-1')).pickupRequestBlock).toBeNull();

      contract.status = 'ENDED';
      expect((await service.getContract(customer, 'c-1')).pickupRequestBlock).toBe(
        'CONTRACT_NOT_ACTIVE',
      );
    });

    it("answers 404 for another customer's contract and 403 for foreign staff", async () => {
      await expect(service.getContract({ ...customer, id: 'cust-2' }, 'c-1')).rejects.toMatchObject(
        { status: 404 },
      );
      jest.mocked(worksAtFacility).mockResolvedValueOnce(false);
      await expect(service.getContract(staff, 'c-1')).rejects.toMatchObject({ status: 403 });
    });

    it('answers 404 for an unknown contract', async () => {
      contract = undefined as never;
      await expect(service.getContract(customer, 'c-1')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('listContractReceipts', () => {
    it('pages the contract receipts with meta', async () => {
      const page = await service.listContractReceipts(customer, 'c-1', { page: 2, limit: 20 });
      expect(loadReceipts).toHaveBeenCalledWith(em, { contractIds: ['c-1'], page: 2, limit: 20 });
      expect(page.meta).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 });
    });
  });

  describe('listWarehouseReceipts', () => {
    it('404s an unknown warehouse', async () => {
      em.findOne.mockResolvedValueOnce(null);
      await expect(service.listWarehouseReceipts(staff, 'w-1', {})).rejects.toMatchObject({
        status: 404,
      });
    });

    it('checks the facility scope and filters by warehouse and search', async () => {
      await service.listWarehouseReceipts(staff, 'w-1', { search: 'An' });
      expect(assertWorksAtFacility).toHaveBeenCalledWith(em, staff, 'f-1');
      expect(loadReceipts).toHaveBeenCalledWith(
        em,
        expect.objectContaining({ warehouseId: 'w-1', search: 'An', page: 1, limit: 20 }),
      );
    });

    it('passes the filters through', async () => {
      await service.listWarehouseReceipts(staff, 'w-1', {
        type: 'PICK_UP' as never,
        status: 'ACTIVE' as never,
        from: '2026-11-01',
        to: '2026-11-07',
        disputed: true,
      });
      expect(loadReceipts).toHaveBeenCalledWith(
        em,
        expect.objectContaining({
          type: 'PICK_UP',
          status: 'ACTIVE',
          from: '2026-11-01',
          to: '2026-11-07',
          disputed: true,
        }),
      );
    });
  });

  describe('listWarehouseStock', () => {
    it('404s a warehouse that is not a shelf warehouse', async () => {
      em.findOne.mockResolvedValueOnce(null);
      await expect(service.listWarehouseStock(staff, 'w-1')).rejects.toMatchObject({ status: 404 });
      expect(loadWarehouseStock).not.toHaveBeenCalled();
    });

    it('403s staff of another facility before reading any stock', async () => {
      jest.mocked(assertWorksAtFacility).mockRejectedValueOnce(new Error('forbidden'));
      await expect(service.listWarehouseStock(staff, 'w-1')).rejects.toThrow('forbidden');
      expect(loadWarehouseStock).not.toHaveBeenCalled();
    });

    it('returns the stock of the warehouse after the facility check', async () => {
      const rows = [{ contractId: 'c-1' }];
      jest.mocked(loadWarehouseStock).mockResolvedValueOnce(rows as never);
      await expect(service.listWarehouseStock(staff, 'w-1')).resolves.toBe(rows);
      expect(assertWorksAtFacility).toHaveBeenCalledWith(em, staff, 'f-1');
      expect(loadWarehouseStock).toHaveBeenCalledWith(em, 'w-1');
    });
  });
});
