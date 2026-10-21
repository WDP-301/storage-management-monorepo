import { findVnBank, VN_BANKS } from '@storage/types';

describe('VN_BANKS', () => {
  it('lists the 76 banks of the VietQR directory', () => {
    expect(VN_BANKS).toHaveLength(76);
  });

  it('identifies every bank by a unique 6-digit BIN', () => {
    const bins = VN_BANKS.map((bank) => bank.bin);
    expect(new Set(bins).size).toBe(bins.length);
    for (const bin of bins) expect(bin).toMatch(/^\d{6}$/);
  });

  it('gives every bank a trimmed short name and legal name', () => {
    for (const bank of VN_BANKS) {
      expect(bank.shortName).toBe(bank.shortName.trim());
      expect(bank.name).toBe(bank.name.trim());
      expect(bank.shortName.length).toBeGreaterThan(0);
      expect(bank.name.length).toBeGreaterThan(0);
    }
  });

  it('finds a bank by BIN and nothing for an unlisted one', () => {
    expect(findVnBank('970436')).toMatchObject({ shortName: 'Vietcombank' });
    expect(findVnBank('000000')).toBeUndefined();
  });
});
