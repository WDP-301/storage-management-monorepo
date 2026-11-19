/**
 * A non-destructive "seed" for demoing the empty state: clears every rental so no customer holds
 * a contract, and empties the inspections that belong to them, while leaving all other data —
 * warehouses, facilities, users, bookings, payments, invoices, settings — as it is.
 *   pnpm --filter @storage/api db:clear-rentals --yes                       # local database
 *   pnpm --filter @storage/api db:clear-rentals --yes --allow-remote=<db>   # any other host
 * A contract cannot be deleted while rows point at it, so the tables that reference one without a
 * cascade (inspections, unit-change requests, shelf receipts/items, pick-up/drop-off requests,
 * deposits and their settlements) go first, in dependency order. Deleting a contract also cascades
 * to what only exists because of it (access passes, handover assets). Invoices, documents and
 * feedback keep their rows, with `contract_id` set to NULL by the foreign key.
 */
import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../data-source';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** Child and blocking tables first; `contracts` last, its own children cascade. */
const STEPS = [
  'inspections',
  'unit_change_requests',
  'shelf_receipt_lines',
  'shelf_receipts',
  'shelf_items',
  'pickup_requests',
  'drop_off_requests',
  'contract_settlements',
  'deposits',
  'contracts',
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('db:clear-rentals is disabled in production');
  const target = `${process.env.DB_HOST}/${process.env.DB_DATABASE}`;
  if (!process.argv.includes('--yes')) {
    throw new Error(`This deletes every contract and inspection in ${target}. Re-run with --yes.`);
  }
  if (!process.env.DB_DATABASE) throw new Error('DB_DATABASE is not set');
  const isLocal = LOCAL_HOSTS.includes(process.env.DB_HOST ?? '');
  if (!isLocal && !process.argv.includes(`--allow-remote=${process.env.DB_DATABASE}`)) {
    throw new Error(
      `${target} is not a local database. Re-run with --allow-remote=${process.env.DB_DATABASE} to clear it.`,
    );
  }

  await AppDataSource.initialize();
  try {
    const removed = await AppDataSource.transaction(async (manager) => {
      const counts: Record<string, number> = {};
      for (const table of STEPS) counts[table] = await clear(manager, table);
      return counts;
    });
    console.log(
      `db:clear-rentals: removed ${removed.contracts} contract(s) and ${removed.inspections} inspection(s) ` +
        `in ${target}; warehouses, facilities, users and the rest are untouched.`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

/** Counts then deletes, so the log reports what changed; skips a table an older schema lacks. */
async function clear(manager: EntityManager, table: string): Promise<number> {
  const [{ exists }] = await manager.query('SELECT to_regclass($1) IS NOT NULL AS "exists"', [
    `public.${table}`,
  ]);
  if (!exists) return 0;
  const [{ n }] = await manager.query(`SELECT count(*)::int AS n FROM "${table}"`);
  await manager.query(`DELETE FROM "${table}"`);
  return n;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
