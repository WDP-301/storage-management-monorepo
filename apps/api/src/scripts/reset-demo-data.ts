/**
 * Wipes all business data (warehouses, bookings, contracts, payments, tickets, tours…),
 * applies pending migrations and seeds standalone demo warehouses plus demo accounts:
 *   pnpm --filter @storage/api db:reset-demo --yes                       # local database
 *   pnpm --filter @storage/api db:reset-demo --yes --allow-remote=<db>   # any other host
 * Users, sessions, customer profiles, settings, provinces/wards and ticket types survive.
 * Roles are only granted to demo accounts the script created or that still use DEMO_PASSWORD,
 * so an account someone registered under a demo email never gains privileges.
 */
import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { hashPassword, verifyPassword } from '@modules/auth/session.util';
import { FacilityStatus, StorageUnitStatus, UserStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../data-source';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_WAREHOUSES } from './demo-seed-data';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** Child tables first, so every DELETE runs after the rows that reference it are gone. */
const WIPE_STATEMENTS = [
  'DELETE FROM "refunds"',
  'DELETE FROM "deposits"',
  'DELETE FROM "payments"',
  'DELETE FROM "damage_fees"',
  'DELETE FROM "invoice_items"',
  'DELETE FROM "invoices"',
  'DELETE FROM "access_events"',
  'DELETE FROM "handover_assets"',
  'DELETE FROM "inspections"',
  'DELETE FROM "unit_change_requests"',
  'DELETE FROM "documents" WHERE "contract_id" IS NOT NULL OR "facility_id" IS NOT NULL',
  'DELETE FROM "feedback"',
  'DELETE FROM "contracts"',
  'DELETE FROM "unit_holds"',
  'DELETE FROM "booking_items"',
  'DELETE FROM "waitlist_entries"',
  'DELETE FROM "bookings"',
  'DELETE FROM "idempotency_keys"',
  'DELETE FROM "notifications"',
  'DELETE FROM "service_tickets"',
  'DELETE FROM "tour_appointments"',
  'DELETE FROM "favorites"',
  'UPDATE "audit_logs" SET "facility_id" = NULL WHERE "facility_id" IS NOT NULL',
  'DELETE FROM "user_role_assignments" WHERE "facility_id" IS NOT NULL',
  'DELETE FROM "storage_units"',
  'DELETE FROM "facilities"',
];

async function wipe(manager: EntityManager): Promise<void> {
  for (const statement of WIPE_STATEMENTS) await manager.query(statement);
  // Only present before the standalone-warehouse migration ran.
  const [{ exists }] = await manager.query(
    `SELECT to_regclass('public.unit_types') IS NOT NULL AS "exists"`,
  );
  if (exists) await manager.query('DELETE FROM "unit_types"');
}

async function seed(manager: EntityManager): Promise<void> {
  const facilityIds: string[] = [];
  for (const warehouse of DEMO_WAREHOUSES) {
    const [{ province_code: provinceCode }] = await manager.query(
      'SELECT province_code FROM wards WHERE code = $1',
      [warehouse.wardCode],
    );
    const facility = await manager.save(
      manager.create(Facility, {
        code: warehouse.code,
        name: warehouse.name,
        addressLine: warehouse.addressLine,
        wardCode: warehouse.wardCode,
        provinceCode,
        latitude: warehouse.latitude,
        longitude: warehouse.longitude,
        status: FacilityStatus.ACTIVE,
      }),
    );
    await manager.save(
      manager.create(StorageUnit, {
        facilityId: facility.id,
        code: warehouse.code,
        widthM: warehouse.widthM,
        lengthM: warehouse.lengthM,
        heightM: warehouse.heightM,
        monthlyPrice: warehouse.monthlyPrice,
        depositMonths: warehouse.depositMonths,
        notes: warehouse.notes,
        status: warehouse.status ?? StorageUnitStatus.AVAILABLE,
      }),
    );
    facilityIds.push(facility.id);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const account of DEMO_ACCOUNTS) {
    let user = await manager
      .getRepository(AppUser)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email: account.email })
      .getOne();
    if (user && !(user.passwordHash && (await verifyPassword(DEMO_PASSWORD, user.passwordHash)))) {
      console.warn(
        `db:reset-demo: ${account.email} exists with another password — no role granted`,
      );
      continue;
    }
    user ??= await manager.save(
      manager.create(AppUser, {
        email: account.email,
        fullName: account.fullName,
        phone: account.phone,
        passwordHash,
        status: UserStatus.ACTIVE,
      }),
    );

    const scopes = account.scopedToWarehouses ? facilityIds : [null];
    for (const facilityId of scopes) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(UserRoleAssignment)
        .values({ userId: user.id, role: account.role, facilityId: facilityId ?? undefined })
        .orIgnore()
        .execute();
    }
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('db:reset-demo is disabled in production');
  const target = `${process.env.DB_HOST}/${process.env.DB_DATABASE}`;
  if (!process.argv.includes('--yes')) {
    throw new Error(
      `This deletes every warehouse, booking, contract and payment in ${target}. Re-run with --yes.`,
    );
  }
  // apps/api/.env usually points at a shared database; wiping it must be asked for by name.
  const isLocal = LOCAL_HOSTS.includes(process.env.DB_HOST ?? '');
  if (!isLocal && !process.argv.includes(`--allow-remote=${process.env.DB_DATABASE}`)) {
    throw new Error(
      `${target} is not a local database. Re-run with --allow-remote=${process.env.DB_DATABASE} to wipe it.`,
    );
  }

  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(wipe);
    const applied = await AppDataSource.runMigrations({ transaction: 'each' });
    await AppDataSource.transaction(seed);
    console.log(
      `db:reset-demo: wiped business data, applied ${applied.length} migration(s), seeded ` +
        `${DEMO_WAREHOUSES.length} warehouses and ${DEMO_ACCOUNTS.length} demo accounts ` +
        `(password ${DEMO_PASSWORD} for new accounts).`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
