import { assertShelfEmpty, cancelOpenPickupRequests } from './shelf-empty-guard.util';

const emReturning = (rows: unknown[]) => ({ query: jest.fn().mockResolvedValue(rows) });

describe('assertShelfEmpty', () => {
  const stock = [
    { id: 'a', name: 'Chăn', quantity: 1 },
    { id: 'b', name: 'Sách', quantity: 4 },
  ];

  it('throws with the stock and the return wording', async () => {
    const em = emReturning(stock);
    await expect(assertShelfEmpty(em as never, 'c-1', 'RETURN')).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'SHELF_NOT_EMPTY',
        message: 'Kệ còn 5 món đồ của khách — ghi phiếu lấy đồ trước khi chốt trả kệ',
        details: {
          reason: 'RETURN',
          contractId: 'c-1',
          totalQuantity: 5,
          items: [
            { itemId: 'a', name: 'Chăn', quantity: 1 },
            { itemId: 'b', name: 'Sách', quantity: 4 },
          ],
        },
      },
    });
    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('"quantity" > 0'), ['c-1']);
  });

  it('uses the unit change wording', async () => {
    await expect(
      assertShelfEmpty(emReturning(stock) as never, 'c-1', 'UNIT_CHANGE'),
    ).rejects.toMatchObject({
      response: {
        message: 'Kệ còn 5 món đồ của khách — trả hết đồ trước khi chuyển sang kho thường',
        details: { reason: 'UNIT_CHANGE' },
      },
    });
  });

  it('passes an empty shelf', async () => {
    await expect(
      assertShelfEmpty(emReturning([]) as never, 'c-1', 'RETURN'),
    ).resolves.toBeUndefined();
  });
});

describe('cancelOpenPickupRequests', () => {
  it('closes PENDING and READY requests of the contract without a canceller', async () => {
    const em = emReturning([]);
    await cancelOpenPickupRequests(em as never, 'c-1');
    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toContain(`"status" IN ('PENDING', 'READY')`);
    expect(sql).not.toContain('cancelled_by');
    expect(params).toEqual(['c-1']);
  });
});
