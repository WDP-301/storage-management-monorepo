/**
 * Creates the DRAFT contract + handover inspection that deposit confirmation now creates
 * automatically, for bookings confirmed before that existed:
 *   pnpm --filter @storage/api backfill:contracts           # dry run: list only
 *   pnpm --filter @storage/api backfill:contracts --apply   # write
 * Only bookings without any contract at all (soft-deleted ones included) are considered: a booking
 * that already has one went through deposit confirmation, and an item of it without a contract
 * is a rental that ended and was removed, not one still waiting for its contract. Each booking
 * runs in one transaction under its row lock and re-checks that, so a re-run (or a concurrent
 * manual contract) is harmless and a booking is never left half done. One case cannot be told
 * apart: a booking whose ended contracts were purged while another item never had a contract is
 * left with no contract at all. PurgeEndedContracts logs those booking numbers; leave them out.
 * A unit confirmed in several bookings (double booking in old data) or already under a live
 * contract is reported and skipped — that needs a human decision, not two contracts.
 */
import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { persistContract } from '@modules/contracts/initial-contract.util';
import { ContractStatus, StorageUnitStatus } from '@storage/types';
import { AppDataSource } from '../data-source';

interface Candidate {
  booking_id: string;
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
      `SELECT b.id AS booking_id, bi.id AS item_id, su.id AS unit_id, b.booking_no, su.code AS unit_code, su.status AS unit_status
         FROM booking_items bi
         JOIN bookings b ON b.id = bi.booking_id
         JOIN storage_units su ON su.id = bi.storage_unit_id
        WHERE b.status = 'CONFIRMED'
          AND NOT EXISTS (SELECT 1 FROM contracts c
                            JOIN booking_items o ON o.id = c.booking_item_id
                           WHERE o.booking_id = b.id)
        ORDER BY b.created_at`,
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

    const byBooking = new Map<string, Candidate[]>();
    for (const c of candidates.filter((candidate) => !conflict(candidate))) {
      byBooking.set(c.booking_id, [...(byBooking.get(c.booking_id) ?? []), c]);
    }
    for (const [bookingId, items] of byBooking) {
      const contractNos = await AppDataSource.transaction(async (em) => {
        const booking = await em.findOneOrFail(Booking, {
          where: { id: bookingId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          await em.exists(Contract, {
            where: { bookingItem: { bookingId: booking.id } },
            withDeleted: true,
          })
        ) {
          return null;
        }
        const customer = await em.findOneOrFail(AppUser, { where: { id: booking.customerId } });
        const created: string[] = [];
        for (const c of items) {
          const item = await em.findOneOrFail(BookingItem, { where: { id: c.item_id } });
          const contract = await persistContract(em, {
            item,
            customer,
            status: ContractStatus.DRAFT,
            effectiveAt: item.requestedStartAt,
            // The rental began in the past; today's amenities would not prove what the warehouse
            // offered then, so leave the snapshot as "not recorded".
            snapshotAmenities: false,
          });
          await em.update(
            StorageUnit,
            { id: item.storageUnitId, status: StorageUnitStatus.HELD },
            { status: StorageUnitStatus.BOOKED },
          );
          created.push(`${c.unit_code}: ${contract.contractNo}`);
        }
        return created;
      });
      const bookingNo = items[0].booking_no;
      console.log(
        `  ${bookingNo} ${contractNos?.join(', ') ?? 'skipped (booking already has a contract)'}`,
      );
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
