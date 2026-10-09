import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StorageUnitStatus, UserRole } from '@storage/types';
import { Repository } from 'typeorm';
import type {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  UpdateWarehouseStatusDto,
} from './dto/warehouse.dto';
import { isIdleUnitStatus } from './unit-status';
import type { WarehouseView } from './warehouse.view';
import {
  assertNoNullRequiredFields,
  handleDbError,
  pick,
  resolveAddressCodes,
} from './warehouse-command.helpers';
import {
  assertNoOpenTours,
  changes,
  countOpenTours,
  FROZEN_WHEN_OCCUPIED,
  lockFacility,
  lockUnit,
} from './warehouse-command.locks';
import { WarehouseQueryService } from './warehouse-query.service';

const UNIT_FIELDS = [
  'code',
  'name',
  'addressLine',
  'wardCode',
  'provinceCode',
  'latitude',
  'longitude',
  'monthlyPrice',
  'widthM',
  'lengthM',
  'heightM',
  'depositMonths',
  'notes',
  'status',
  'facilityId',
] as const;

/**
 * Write side of warehouses (storage units). Lock order is facility rows first, then the unit
 * row — the unit lock is the same one the booking flow takes.
 */
@Injectable()
export class WarehouseCommandService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly units: Repository<StorageUnit>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    private readonly query: WarehouseQueryService,
  ) {}

  async create(dto: CreateWarehouseDto): Promise<WarehouseView> {
    const id = await this.units.manager.transaction(async (manager) => {
      const address = await resolveAddressCodes(manager, dto.wardCode, dto.provinceCode);
      await lockFacility(manager, dto.facilityId);
      try {
        const unit = await manager.save(
          manager.create(StorageUnit, {
            ...pick(dto, UNIT_FIELDS),
            ...address,
            depositMonths: dto.depositMonths ?? null,
            status: dto.status ?? StorageUnitStatus.AVAILABLE,
          }),
        );
        return unit.id;
      } catch (err) {
        handleDbError(err);
      }
    });
    return this.query.findOne(id);
  }

  /**
   * Price, deposit, address and notes stay editable — bookings and contracts keep their own
   * snapshots. Code, dimensions, status and facility are frozen while a customer is attached;
   * moving to another facility also requires that no tour is still expected on site.
   */
  async update(id: string, dto: UpdateWarehouseDto): Promise<WarehouseView> {
    assertNoNullRequiredFields(dto);
    await this.units.manager.transaction(async (manager) => {
      if (dto.facilityId) await lockFacility(manager, dto.facilityId);
      const unit = await lockUnit(manager, id);

      if (!isIdleUnitStatus(unit.status)) {
        const frozen = FROZEN_WHEN_OCCUPIED.filter((field) => changes(dto, field, unit));
        if (frozen.length > 0) {
          throw new DomainException(
            ErrorCode.CONFLICT,
            `Cannot change ${frozen.join(', ')} of a ${unit.status} warehouse`,
            HttpStatus.CONFLICT,
            { status: unit.status, fields: [...frozen] },
          );
        }
      }
      if (changes(dto, 'facilityId', unit)) await assertNoOpenTours(manager, unit.id);

      const patch: Partial<StorageUnit> = pick(dto, UNIT_FIELDS);
      if (dto.wardCode !== undefined || dto.provinceCode !== undefined) {
        const wardCode = dto.wardCode !== undefined ? dto.wardCode : unit.wardCode;
        const provinceCode = dto.provinceCode !== undefined ? dto.provinceCode : unit.provinceCode;
        Object.assign(patch, await resolveAddressCodes(manager, wardCode, provinceCode));
      }

      try {
        if (Object.keys(patch).length > 0) await manager.update(StorageUnit, unit.id, patch);
      } catch (err) {
        handleDbError(err);
      }
    });
    return this.query.findOne(id);
  }

  /** In/out of service toggle for the people running the warehouse's facility. */
  async updateStatus(
    id: string,
    dto: UpdateWarehouseStatusDto,
    actor: AuthUser,
  ): Promise<WarehouseView> {
    await this.units.manager.transaction(async (manager) => {
      const unit = await lockUnit(manager, id);
      await this.assertManages(actor, unit.facilityId);
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

  /** Refused while a customer is attached or a tour is still expected on this warehouse. */
  async softDelete(id: string): Promise<void> {
    await this.units.manager.transaction(async (manager) => {
      const unit = await lockUnit(manager, id);
      const openTours = await countOpenTours(manager, unit.id);

      if (!isIdleUnitStatus(unit.status) || openTours > 0) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          'Warehouse is occupied or still has open tour appointments',
          HttpStatus.CONFLICT,
          { status: unit.status, openTours },
        );
      }
      await manager.softDelete(StorageUnit, unit.id);
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
}
