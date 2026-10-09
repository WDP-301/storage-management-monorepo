import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointment } from '@entities/tour-appointment.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import {
  PG_CHECK_VIOLATION,
  PG_FK_VIOLATION,
  PG_NUMERIC_OVERFLOW,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from '@shared/utils/pg-error.util';
import { FacilityStatus, StorageUnitStatus, TourAppointmentStatus, UserRole } from '@storage/types';
import { type EntityManager, In, IsNull, Repository } from 'typeorm';
import type {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  UpdateWarehouseStatusDto,
} from './dto/warehouse.dto';
import { isIdleUnitStatus } from './unit-status';
import type { WarehouseView } from './warehouse.view';
import { WarehouseQueryService } from './warehouse-query.service';

/** Tour appointments that still expect someone at the warehouse. */
const OPEN_TOUR_STATUSES = [
  TourAppointmentStatus.PENDING,
  TourAppointmentStatus.CONFIRMED,
  TourAppointmentStatus.ASSIGNED,
];

const FACILITY_FIELDS = [
  'code',
  'name',
  'addressLine',
  'wardCode',
  'provinceCode',
  'latitude',
  'longitude',
] as const;

/** Physical identity of a warehouse — frozen while a customer is attached. */
const FROZEN_WHEN_OCCUPIED = ['code', 'widthM', 'lengthM', 'heightM', 'status'] as const;

/**
 * Write side of warehouses. A warehouse is a facility plus its single unit; both rows are
 * written together under row locks shared with the booking flow (unit) and with tour
 * creation (facility).
 */
@Injectable()
export class WarehouseCommandService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilities: Repository<Facility>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    private readonly query: WarehouseQueryService,
  ) {}

  async create(dto: CreateWarehouseDto): Promise<WarehouseView> {
    const address = await this.resolveAddressCodes(dto.wardCode, dto.provinceCode);
    const facilityId = await this.facilities.manager.transaction(async (manager) => {
      try {
        const facility = await manager.save(
          manager.create(Facility, {
            ...pick(dto, FACILITY_FIELDS),
            ...address,
            status: FacilityStatus.ACTIVE,
          }),
        );
        await manager.save(
          manager.create(StorageUnit, {
            facilityId: facility.id,
            code: dto.code,
            monthlyPrice: dto.monthlyPrice,
            widthM: dto.widthM,
            lengthM: dto.lengthM,
            heightM: dto.heightM,
            depositMonths: dto.depositMonths ?? null,
            notes: dto.notes,
            status: dto.status ?? StorageUnitStatus.AVAILABLE,
          }),
        );
        return facility.id;
      } catch (err) {
        handleDbError(err);
      }
    });
    return this.query.findOne(facilityId);
  }

  /**
   * Price, deposit, address and notes stay editable — bookings and contracts keep their own
   * snapshots. Code, dimensions and status are frozen while a customer is attached.
   */
  async update(id: string, dto: UpdateWarehouseDto): Promise<WarehouseView> {
    assertNoNullRequiredFields(dto);
    await this.facilities.manager.transaction(async (manager) => {
      const { facility, unit } = await lockWarehouse(manager, id);

      if (!isIdleUnitStatus(unit.status)) {
        const frozen = FROZEN_WHEN_OCCUPIED.filter((field) => changes(dto, field, facility, unit));
        if (frozen.length > 0) {
          throw new DomainException(
            ErrorCode.CONFLICT,
            `Cannot change ${frozen.join(', ')} of a ${unit.status} warehouse`,
            HttpStatus.CONFLICT,
            { status: unit.status, fields: [...frozen] },
          );
        }
      }

      const facilityPatch: Partial<Facility> = pick(dto, FACILITY_FIELDS);
      if (dto.wardCode !== undefined || dto.provinceCode !== undefined) {
        const wardCode = dto.wardCode !== undefined ? dto.wardCode : facility.wardCode;
        const provinceCode =
          dto.provinceCode !== undefined ? dto.provinceCode : facility.provinceCode;
        Object.assign(facilityPatch, await this.resolveAddressCodes(wardCode, provinceCode));
      }
      const unitPatch: Partial<StorageUnit> = pick(dto, [
        'code',
        'monthlyPrice',
        'widthM',
        'lengthM',
        'heightM',
        'depositMonths',
        'notes',
        'status',
      ]);

      try {
        if (Object.keys(facilityPatch).length > 0) {
          await manager.update(Facility, facility.id, facilityPatch);
        }
        if (Object.keys(unitPatch).length > 0)
          await manager.update(StorageUnit, unit.id, unitPatch);
      } catch (err) {
        handleDbError(err);
      }
    });
    return this.query.findOne(id);
  }

  /** In/out of service toggle for the people running the warehouse. */
  async updateStatus(
    id: string,
    dto: UpdateWarehouseStatusDto,
    actor: AuthUser,
  ): Promise<WarehouseView> {
    await this.assertManages(actor, id);
    await this.facilities.manager.transaction(async (manager) => {
      const { unit } = await lockWarehouse(manager, id);
      const toggleable: StorageUnitStatus[] = [
        StorageUnitStatus.AVAILABLE,
        StorageUnitStatus.MAINTENANCE,
      ];
      if (!toggleable.includes(unit.status)) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Cannot change status of a ${unit.status} warehouse`,
          HttpStatus.CONFLICT,
        );
      }
      await manager.update(StorageUnit, unit.id, { status: dto.status });
    });
    return this.query.findOne(id);
  }

  /** Refused while a customer is attached or a tour is still expected on site. */
  async softDelete(id: string): Promise<void> {
    await this.facilities.manager.transaction(async (manager) => {
      const { facility, unit } = await lockWarehouse(manager, id);
      const openTours = await manager.count(TourAppointment, {
        where: { facilityId: facility.id, status: In(OPEN_TOUR_STATUSES) },
      });

      if (!isIdleUnitStatus(unit.status) || openTours > 0) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Warehouse is occupied or still has open tour appointments',
          HttpStatus.CONFLICT,
          { status: unit.status, openTours },
        );
      }

      await manager.softDelete(StorageUnit, unit.id);
      await manager.softDelete(Facility, facility.id);
    });
  }

  private async assertManages(actor: AuthUser, facilityId: string): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN) || actor.roles.includes(UserRole.OPERATIONS_MANAGER)) {
      return;
    }
    const assignments = await this.roleAssignments.find({
      where: { userId: actor.id, facilityId, role: UserRole.FACILITY_MANAGER },
    });
    if (!assignments.some((assignment) => isAssignmentActive(assignment))) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage this warehouse',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * A ward must belong to the warehouse's province; when only the ward is given the province
   * is derived from it, so the two codes can never disagree.
   */
  private async resolveAddressCodes(
    wardCode: string | null | undefined,
    provinceCode: string | null | undefined,
  ): Promise<{ wardCode?: string; provinceCode?: string }> {
    if (!wardCode) return {};

    const rows: { province_code: string }[] = await this.facilities.manager.query(
      'SELECT province_code FROM wards WHERE code = $1',
      [wardCode],
    );
    const wardProvince = rows[0]?.province_code;
    if (!wardProvince) {
      throw new DomainException(
        ErrorCode.BAD_REQUEST,
        `Ward ${wardCode} does not exist`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (provinceCode && provinceCode !== wardProvince) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        `Ward ${wardCode} does not belong to province ${provinceCode}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return { wardCode, provinceCode: wardProvince };
  }
}

/** Facility first, then its unit — the same unit lock the booking flow takes. */
async function lockWarehouse(
  manager: EntityManager,
  id: string,
): Promise<{ facility: Facility; unit: StorageUnit }> {
  const facility = await manager.findOne(Facility, {
    where: { id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!facility) notFound('Warehouse', id);
  const unit = await manager.findOne(StorageUnit, {
    where: { facilityId: id, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (!unit) notFound('Warehouse', id);
  return { facility, unit };
}

function changes(
  dto: UpdateWarehouseDto,
  field: (typeof FROZEN_WHEN_OCCUPIED)[number],
  facility: Facility,
  unit: StorageUnit,
): boolean {
  const next = dto[field];
  if (next === undefined) return false;
  if (field === 'code') return next !== facility.code;
  if (field === 'status') return next !== unit.status;
  // decimal columns come back from pg as strings
  const current = unit[field];
  return current === null ? next !== null : Number(next) !== Number(current);
}

function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** Fields a client may clear with `null`; every other field must be omitted or given a value. */
const CLEARABLE_FIELDS = new Set(['depositMonths', 'notes', 'wardCode']);

// `@IsOptional` lets `null` through validation, which would otherwise reach a NOT NULL column.
function assertNoNullRequiredFields(dto: UpdateWarehouseDto): void {
  const fields = Object.entries(dto)
    .filter(([key, value]) => value === null && !CLEARABLE_FIELDS.has(key))
    .map(([field]) => ({ field, code: 'isNotEmpty', message: `${field} cannot be null` }));
  if (fields.length > 0) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      {
        fields,
      },
    );
  }
}

function handleDbError(err: unknown): never {
  const code = pgErrorCode(err);
  if (code === PG_UNIQUE_VIOLATION) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Warehouse code already exists',
      HttpStatus.CONFLICT,
    );
  }
  if (code === PG_FK_VIOLATION) {
    throw new DomainException(
      ErrorCode.BAD_REQUEST,
      'provinceCode or wardCode does not exist',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (code === PG_CHECK_VIOLATION || code === PG_NUMERIC_OVERFLOW) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Warehouse values are out of range',
      HttpStatus.BAD_REQUEST,
    );
  }
  throw err;
}
