/**
 * Creates the DRAFT contract + handover inspection that deposit confirmation now creates
 * automatically, for bookings confirmed before that existed:
 *   pnpm --filter @storage/api backfill:contracts           # dry run: list only
 *   pnpm --filter @storage/api backfill:contracts --apply   # write
 * Each item runs in its own transaction under a booking row lock and re-checks that no
 * INITIAL contract exists, so a re-run (or a concurrent manual contract) is harmless.
 * A unit confirmed in several bookings (double booking in old data) or already under a live
 * contract is reported and skipped — that needs a human decision, not two contracts.
 */
import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { persistContract } from '@modules/contracts/initial-contract.util';
import { ContractKind, ContractStatus, StorageUnitStatus } from '@storage/types';
import { AppDataSource } from '../data-source';

interface Candidate {
  item_id: string;
  unit_id: string;
  booking_no: string;
  unit_code: string;
  unit_status: string;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await AppDataSource.initialize();
  try {
    const candidates: Candidate[] = await AppDataSource.query(
      `SELECT bi.id AS item_id, su.id AS unit_id, b.booking_no, su.code AS unit_code, su.status AS unit_status
         FROM booking_items bi
         JOIN bookings b ON b.id = bi.booking_id
         JOIN storage_units su ON su.id = bi.storage_unit_id
        WHERE b.status = 'CONFIRMED'
          AND NOT EXISTS (SELECT 1 FROM contracts c
                           WHERE c.booking_item_id = bi.id AND c.kind = $1 AND c.deleted_at IS NULL)
        ORDER BY b.created_at`,
      [ContractKind.INITIAL],
    );
    const perUnit = new Map<string, number>();
    for (const c of candidates) perUnit.set(c.unit_id, (perUnit.get(c.unit_id) ?? 0) + 1);
    const liveUnits = new Set<string>(
      (
        await AppDataSource.query(
          `SELECT DISTINCT bi.storage_unit_id AS unit_id
             FROM contracts c JOIN booking_items bi ON bi.id = c.booking_item_id
            WHERE c.status IN ($1, $2) AND c.deleted_at IS NULL`,
          [ContractStatus.DRAFT, ContractStatus.ACTIVE],
        )
      ).map((row: { unit_id: string }) => row.unit_id),
    );
    const conflict = (c: Candidate) =>
      (perUnit.get(c.unit_id) ?? 0) > 1 || liveUnits.has(c.unit_id);

    console.log(`${candidates.length} confirmed booking item(s) without a contract:`);
    for (const c of candidates) {
      const note = conflict(c) ? '  ⚠ unit double-booked or already under contract — skip' : '';
      console.log(`  ${c.booking_no}  unit ${c.unit_code} (${c.unit_status})${note}`);
    }
    if (!apply) {
      console.log('Dry run — re-run with --apply to create the contracts.');
      return;
    }

    for (const c of candidates.filter((candidate) => !conflict(candidate))) {
      const contractNo = await AppDataSource.transaction(async (em) => {
        const item = await em.findOneOrFail(BookingItem, { where: { id: c.item_id } });
        const booking = await em.findOneOrFail(Booking, {
          where: { id: item.bookingId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          await em.exists(Contract, {
            where: { bookingItemId: item.id, kind: ContractKind.INITIAL },
          })
        ) {
          return null;
        }
        const customer = await em.findOneOrFail(AppUser, { where: { id: booking.customerId } });
        const contract = await persistContract(em, {
          item,
          customer,
          status: ContractStatus.DRAFT,
          effectiveAt: item.requestedStartAt,
        });
        await em.update(
          StorageUnit,
          { id: item.storageUnitId, status: StorageUnitStatus.HELD },
          { status: StorageUnitStatus.BOOKED },
        );
        return contract.contractNo;
      });
      console.log(`  ${c.booking_no} ${c.unit_code}: ${contractNo ?? 'skipped (already has one)'}`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
