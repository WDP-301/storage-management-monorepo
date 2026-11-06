import { validateReceiptShape, validateRecoveryShape } from './receipt-input.util';

const mine = (n = 1) =>
  Array.from({ length: n }, (_, i) => ({
    fileKey: `uploads/staff-1-${i}-a.jpg`,
    name: 'a.jpg',
    mimeType: 'image/jpeg',
  }));
const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    const body = (error as { response: { details: { fields: unknown[] } } }).response;
    return body.details.fields[0];
  }
  return undefined;
};

describe('validateReceiptShape', () => {
  it('normalizes a mixed drop-off', () => {
    const lines = validateReceiptShape(
      {
        type: 'DROP_OFF',
        photos: mine(),
        lines: [
          { itemId: id1, quantity: 2 },
          { name: '  Thùng   sách ', quantity: 1 },
        ],
      },
      'staff-1',
    );
    expect(lines).toEqual([
      { itemId: id1, quantity: 2 },
      { name: 'Thùng sách', quantity: 1 },
    ]);
  });

  it('allows a pick-up without photos', () => {
    expect(
      validateReceiptShape({ type: 'PICK_UP', lines: [{ itemId: id1, quantity: 1 }] }, 'staff-1'),
    ).toEqual([{ itemId: id1, quantity: 1 }]);
  });

  it('requires a photo on a drop-off', () => {
    expect(
      codeOf(() =>
        validateReceiptShape({ type: 'DROP_OFF', lines: [{ name: 'A', quantity: 1 }] }, 'staff-1'),
      ),
    ).toMatchObject({ field: 'photos', code: 'required' });
  });

  it.each([
    ['both id and name', { itemId: id1, name: 'A', quantity: 1 }],
    ['neither id nor name', { quantity: 1 }],
    ['zero quantity', { name: 'A', quantity: 0 }],
    ['fractional quantity', { name: 'A', quantity: 1.5 }],
    ['quantity above the cap', { name: 'A', quantity: 10001 }],
    ['blank name', { name: '   ', quantity: 1 }],
    ['name over 120 characters', { name: 'x'.repeat(121), quantity: 1 }],
  ])('rejects a drop-off line with %s as lineShape', (_label, line) => {
    expect(
      codeOf(() =>
        validateReceiptShape({ type: 'DROP_OFF', photos: mine(), lines: [line] }, 'staff-1'),
      ),
    ).toMatchObject({ field: 'lines[0]', code: 'lineShape' });
  });

  it.each([
    ['a name', { name: 'A', quantity: 1 }],
    ['no item', { quantity: 1 }],
  ])('rejects a pick-up line with %s', (_label, line) => {
    expect(
      codeOf(() => validateReceiptShape({ type: 'PICK_UP', lines: [line] }, 'staff-1')),
    ).toMatchObject({ field: 'lines[0]', code: 'lineShape' });
  });

  it('rejects duplicates by item id and by case-insensitive name', () => {
    expect(
      codeOf(() =>
        validateReceiptShape(
          {
            type: 'PICK_UP',
            lines: [
              { itemId: id1, quantity: 1 },
              { itemId: id2, quantity: 1 },
              { itemId: id1, quantity: 1 },
            ],
          },
          'staff-1',
        ),
      ),
    ).toMatchObject({ field: 'lines[2]', code: 'duplicateLine' });
    expect(
      codeOf(() =>
        validateReceiptShape(
          {
            type: 'DROP_OFF',
            photos: mine(),
            lines: [
              { name: 'Sách', quantity: 1 },
              { name: ' sách ', quantity: 1 },
            ],
          },
          'staff-1',
        ),
      ),
    ).toMatchObject({ field: 'lines[1]', code: 'duplicateLine' });
  });

  it('rejects photos that are not the actor own uploads', () => {
    expect(
      codeOf(() =>
        validateReceiptShape(
          { type: 'DROP_OFF', photos: mine(), lines: [{ name: 'A', quantity: 1 }] },
          'staff-2',
        ),
      ),
    ).toMatchObject({ field: 'photos', code: 'notOwnUpload' });
  });

  it('rejects a pick-up request id on a drop-off', () => {
    expect(
      codeOf(() =>
        validateReceiptShape(
          {
            type: 'DROP_OFF',
            photos: mine(),
            pickupRequestId: id1,
            lines: [{ name: 'A', quantity: 1 }],
          },
          'staff-1',
        ),
      ),
    ).toMatchObject({ field: 'pickupRequestId', code: 'notAllowed' });
  });
});

describe('validateRecoveryShape', () => {
  it('accepts item lines with a photo', () => {
    expect(
      validateRecoveryShape({ photos: mine(), lines: [{ itemId: id1, quantity: 3 }] }, 'staff-1'),
    ).toEqual([{ itemId: id1, quantity: 3 }]);
  });

  it('requires a photo', () => {
    expect(
      codeOf(() =>
        validateRecoveryShape({ photos: [], lines: [{ itemId: id1, quantity: 3 }] }, 'staff-1'),
      ),
    ).toMatchObject({ field: 'photos', code: 'required' });
  });

  it('rejects name lines and foreign photos', () => {
    expect(
      codeOf(() =>
        validateRecoveryShape(
          { photos: mine(), lines: [{ name: 'A', quantity: 1 } as never] },
          'staff-1',
        ),
      ),
    ).toMatchObject({ code: 'lineShape' });
    expect(
      codeOf(() =>
        validateRecoveryShape({ photos: mine(), lines: [{ itemId: id1, quantity: 1 }] }, 'x'),
      ),
    ).toMatchObject({ code: 'notOwnUpload' });
  });
});
