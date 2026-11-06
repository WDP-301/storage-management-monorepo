import { resolveReceiptLink } from './ticket-receipt-link';

const RECEIPT = {
  id: 'r-1',
  customer_id: 'cust-1',
  facility_id: 'f-1',
  storage_unit_id: 's-1',
  status: 'ACTIVE',
};
const dto = { shelfReceiptId: 'r-1', facilityId: 'f-1' };

const setup = (receipt: unknown, open: unknown = undefined) => {
  const query = jest.fn(async (sql: string, _params?: unknown[]) =>
    sql.includes('FROM "shelf_receipts"') ? (receipt ? [receipt] : []) : open ? [open] : [],
  );
  return { em: { query } as never, query };
};

describe('resolveReceiptLink', () => {
  it('does nothing without a receipt id', async () => {
    const { em, query } = setup(RECEIPT);
    await expect(resolveReceiptLink(em, 'cust-1', { facilityId: 'f-1' })).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown receipt and for another customer's receipt", async () => {
    await expect(resolveReceiptLink(setup(null).em, 'cust-1', dto)).rejects.toMatchObject({
      status: 404,
    });
    await expect(resolveReceiptLink(setup(RECEIPT).em, 'cust-2', dto)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses a storage unit in the request, before the facility check', async () => {
    await expect(
      resolveReceiptLink(setup(RECEIPT).em, 'cust-1', {
        ...dto,
        storageUnitId: 's-9',
        facilityId: 'other',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        details: {
          fields: [expect.objectContaining({ field: 'storageUnitId', code: 'notAllowed' })],
        },
      },
    });
  });

  it('refuses a facility other than the receipt one', async () => {
    await expect(
      resolveReceiptLink(setup(RECEIPT).em, 'cust-1', { ...dto, facilityId: 'other' }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        details: {
          fields: [expect.objectContaining({ field: 'facilityId', code: 'notReceiptFacility' })],
        },
      },
    });
  });

  it('refuses a voided receipt', async () => {
    await expect(
      resolveReceiptLink(setup({ ...RECEIPT, status: 'VOIDED' }).em, 'cust-1', dto),
    ).rejects.toMatchObject({
      status: 409,
      response: { details: { reason: 'RECEIPT_VOIDED' } },
    });
  });

  it('refuses a second open report and names the first', async () => {
    const { em, query } = setup(RECEIPT, { id: 't-1', ticket_no: 'ST-1' });
    await expect(resolveReceiptLink(em, 'cust-1', dto)).rejects.toMatchObject({
      status: 409,
      response: { details: { reason: 'OPEN_DISPUTE_EXISTS', ticketId: 't-1', ticketNo: 'ST-1' } },
    });
    expect(query.mock.calls[1][1]).toEqual(['r-1', ['OPEN', 'ASSIGNED', 'IN_PROGRESS']]);
  });

  it('returns the receipt and its shelf when every check passes', async () => {
    await expect(resolveReceiptLink(setup(RECEIPT).em, 'cust-1', dto)).resolves.toEqual({
      receiptId: 'r-1',
      storageUnitId: 's-1',
    });
  });

  it('locks the receipt row only when asked to', async () => {
    const plain = setup(RECEIPT);
    await resolveReceiptLink(plain.em, 'cust-1', dto);
    expect(plain.query.mock.calls[0][0]).not.toContain('FOR UPDATE');

    const locked = setup(RECEIPT);
    await resolveReceiptLink(locked.em, 'cust-1', dto, { lock: true });
    expect(locked.query.mock.calls[0][0]).toContain('FOR UPDATE');
  });
});
