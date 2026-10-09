import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { hashPassword, verifyPassword } from '@modules/auth/session.util';
import { FacilityStatus, StorageUnitStatus, UserStatus } from '@storage/types';
import type { EntityManager } from 'typeorm';
import { DEMO_ACCOUNTS, DEMO_FACILITIES, DEMO_WAREHOUSES } from './demo-seed-data';

/** Creates facilities, their warehouses, demo accounts and facility-scoped roles. */
export async function seed(manager: EntityManager, demoPassword: string): Promise<void> {
  const facilityIds = new Map<string, string>();
  for (const demo of DEMO_FACILITIES) {
    const facility = await manager.save(
      manager.create(Facility, {
        code: demo.code,
        name: demo.name,
        provinceCode: demo.provinceCode,
        status: FacilityStatus.ACTIVE,
      }),
    );
    facilityIds.set(demo.code, facility.id);
  }

  const facilityIdOf = (code: string): string => {
    const id = facilityIds.get(code);
    if (!id) throw new Error(`Unknown demo facility code: ${code}`);
    return id;
  };

  for (const warehouse of DEMO_WAREHOUSES) {
    const rows: { province_code: string }[] = await manager.query(
      'SELECT province_code FROM wards WHERE code = $1',
      [warehouse.wardCode],
    );
    if (!rows.length) throw new Error(`Ward ${warehouse.wardCode} (${warehouse.code}) not found`);
    await manager.save(
      manager.create(StorageUnit, {
        facilityId: facilityIdOf(warehouse.facilityCode),
        code: warehouse.code,
        name: warehouse.name,
        addressLine: warehouse.addressLine,
        wardCode: warehouse.wardCode,
        provinceCode: rows[0].province_code,
        latitude: warehouse.latitude,
        longitude: warehouse.longitude,
        widthM: warehouse.widthM,
        lengthM: warehouse.lengthM,
        heightM: warehouse.heightM,
        monthlyPrice: warehouse.monthlyPrice,
        depositMonths: warehouse.depositMonths,
        notes: warehouse.notes,
        status: warehouse.status ?? StorageUnitStatus.AVAILABLE,
      }),
    );
  }

  const passwordHash = await hashPassword(demoPassword);
  for (const account of DEMO_ACCOUNTS) {
    let user = await manager
      .getRepository(AppUser)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email: account.email })
      .getOne();
    if (user && !(user.passwordHash && (await verifyPassword(demoPassword, user.passwordHash)))) {
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

    const scopes = account.facilityCodes ? account.facilityCodes.map(facilityIdOf) : [null];
    for (const facilityId of scopes) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(UserRoleAssignment)
        .values({
          userId: user.id,
          role: account.role,
          facilityId: facilityId ?? undefined,
        })
        .orIgnore()
        .execute();
    }
  }
}
