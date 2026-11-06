import { loadPickupRequests } from './pickup-request.read';
import { findShelfContracts, loadStock } from './shelf-contract.query';
import { loadWarehouseStock } from './warehouse-stock.read';

jest.mock('./pickup-request.read');
jest.mock('./shelf-contract.query');

const contract = (id: string, shelfCode: string, customerId = 'u-1') => ({
  id,
  contractNo: `HD-${id}`,
  status: 'ACTIVE',
  customerId,
  effectiveAt: new Date('2026-11-01T00:00:00Z'),
  shelf: { id: `s-${id}`, code: shelfCode, name: shelfCode },
  warehouse: { id: 'w-1', code: 'W', name: 'Kho' },
  facility: { id: 'f-1', code: 'F', name: 'CN' },
  returnOpen: id === 'c-2',
});

describe('loadWarehouseStock', () => {
  const query = jest.fn();
  const em = { query } as never;

  beforeEach(() => {
    jest.resetAllMocks();
    query.mockResolvedValue([
      { id: 'u-1', fullName: 'An', phone: '0900' },
      { id: 'u-2', fullName: 'Bình', phone: null },
    ]);
  });

  it('is empty for a warehouse without active contracts and reads nothing else', async () => {
    jest.mocked(findShelfContracts).mockResolvedValue([]);
    await expect(loadWarehouseStock(em, 'w-1')).resolves.toEqual([]);
    expect(findShelfContracts).toHaveBeenCalledWith(em, {
      warehouseId: 'w-1',
      statuses: ['ACTIVE'],
    });
    expect(loadStock).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('builds one row per contract: sorted by shelf code, totals, customer, open request', async () => {
    jest
      .mocked(findShelfContracts)
      .mockResolvedValue([
        contract('c-1', 'K-10'),
        contract('c-2', 'K-2', 'u-2'),
        contract('c-3', 'K-3'),
      ] as never);
    jest.mocked(loadStock).mockResolvedValue(
      new Map([
        [
          'c-1',
          [
            { id: 'i-1', name: 'Sách', quantity: 2 },
            { id: 'i-2', name: 'Vali', quantity: 3 },
          ],
        ],
        ['c-2', []],
      ]) as never,
    );
    const request = { id: 'p-1', contractId: 'c-1', status: 'PENDING' };
    jest.mocked(loadPickupRequests).mockResolvedValue([request] as never);

    const rows = await loadWarehouseStock(em, 'w-1');

    expect(rows.map((row) => row.shelf.code)).toEqual(['K-2', 'K-3', 'K-10']);
    expect(loadPickupRequests).toHaveBeenCalledWith(em, {
      contractIds: ['c-1', 'c-2', 'c-3'],
      open: true,
      order: 'requestedFor',
    });
    const [k2, k3, k10] = rows;
    expect(k2).toMatchObject({
      contractId: 'c-2',
      items: [],
      totalQuantity: 0,
      openRequest: null,
      returnOpen: true,
      customer: { id: 'u-2', fullName: 'Bình', phone: null },
    });
    expect(k3.items).toEqual([]);
    expect(k10).toMatchObject({
      totalQuantity: 5,
      openRequest: request,
      customer: { fullName: 'An', phone: '0900' },
    });
  });

  it('asks for each customer once', async () => {
    jest
      .mocked(findShelfContracts)
      .mockResolvedValue([contract('c-1', 'A'), contract('c-3', 'B')] as never);
    jest.mocked(loadStock).mockResolvedValue(new Map());
    jest.mocked(loadPickupRequests).mockResolvedValue([]);
    await loadWarehouseStock(em, 'w-1');
    expect(query.mock.calls[0][1]).toEqual([['u-1']]);
  });
});
