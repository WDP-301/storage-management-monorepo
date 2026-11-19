import { readNumberSetting } from '@modules/settings/setting-read.util';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';

export interface InvoiceAmounts {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/** VAT at `percent` on top of `subtotal`, rounded to whole dong. */
export function withVat(subtotal: Decimal.Value, percent: number): InvoiceAmounts {
  const base = new Decimal(subtotal);
  const tax = base.mul(percent).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return { subtotal: base.toNumber(), taxAmount: tax.toNumber(), total: base.plus(tax).toNumber() };
}

/**
 * Amounts of a rent invoice at the VAT rate in force when it is issued. Only rent is taxed:
 * deposits and fee invoices (damage, shortfalls) stay at tax 0.
 */
export async function rentInvoiceAmounts(
  em: EntityManager,
  rent: Decimal.Value,
): Promise<InvoiceAmounts> {
  return withVat(rent, await readNumberSetting(em, 'billing.vat_tax_rate_percent'));
}
