import { snapshotUnitAmenities } from './contract-amenities';

describe('snapshotUnitAmenities', () => {
  it('maps rows, coercing quantity to a number and a missing note to null', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue([
        { amenityId: 'a-1', code: 'CCTV', name: 'Camera', quantity: '6', note: undefined },
        { amenityId: 'a-2', code: 'FIRE', name: 'Fire extinguisher', quantity: 4, note: 'lobby' },
      ]),
    };

    await expect(snapshotUnitAmenities(manager as never, 'unit-1')).resolves.toEqual([
      { amenityId: 'a-1', code: 'CCTV', name: 'Camera', quantity: 6, note: null },
      { amenityId: 'a-2', code: 'FIRE', name: 'Fire extinguisher', quantity: 4, note: 'lobby' },
    ]);
  });

  it('reads with exactly one statement so the list comes from a single MVCC snapshot', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await snapshotUnitAmenities(manager as never, 'unit-1');

    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(expect.any(String), ['unit-1']);
  });

  it('resolves a shelf to its parent warehouse inside the same statement', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await snapshotUnitAmenities(manager as never, 'shelf-1');

    expect(manager.query.mock.calls[0][0]).toContain('COALESCE(u.parent_id, u.id)');
  });

  it('returns [] for a unit without amenities', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await expect(snapshotUnitAmenities(manager as never, 'unit-1')).resolves.toEqual([]);
  });
});
