/**
 * Values the migrations seed for the settings that helpers read on the caller's transaction
 * (`readNumberSetting`). Unit specs that run those helpers against a mocked EntityManager swap
 * the reader for `readSeededSetting`:
 *
 *   jest.mock('@modules/settings/setting-read.util', () =>
 *     jest.requireActual('../../../test/seeded-settings').seededSettingReader,
 *   );
 */
export const SEEDED_SETTINGS: Readonly<Record<string, number>> = {
  'billing.fee_invoice_due_days': 7,
  'billing.rent_grace_days': 0,
  'billing.vat_tax_rate_percent': 0,
  'shelf.counter_session_minutes': 30,
};

export async function readSeededSetting(_em: unknown, key: string): Promise<number> {
  const value = SEEDED_SETTINGS[key];
  if (value === undefined) throw new Error(`System setting '${key}' is not seeded for tests`);
  return value;
}

export const seededSettingReader = { readNumberSetting: jest.fn(readSeededSetting) };
