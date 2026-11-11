import type { EntityManager } from 'typeorm';

/** Users holding an active FACILITY_STAFF or FACILITY_MANAGER assignment at the facility. */
export async function findFacilityStaffIds(
  em: EntityManager,
  facilityId: string,
): Promise<string[]> {
  const rows: { userId: string }[] = await em.query(
    `SELECT DISTINCT "user_id" AS "userId" FROM "user_role_assignments"
      WHERE "role" IN ('FACILITY_STAFF', 'FACILITY_MANAGER') AND "facility_id" = $1
        AND "starts_at" <= now() AND ("ends_at" IS NULL OR "ends_at" > now())`,
    [facilityId],
  );
  return rows.map((row) => row.userId);
}
