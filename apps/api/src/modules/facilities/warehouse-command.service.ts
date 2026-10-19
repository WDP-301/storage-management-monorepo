import { StorageUnit } from '@entities/storage-unit.entity';
import { replaceUnitAmenities } from '@modules/amenities/unit-amenities';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import { Repository } from 'typeorm';
import type {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  UpdateWarehouseStatusDto,
} from './dto/warehouse.dto';
import {
  assertNoParentPricing,
  assertParentClosable,
  assertParentMovable,
  assertParentPatchAllowed,
  assertShelfPatchAllowed,
  cascadeParentLocation,
  softDeleteWithShelves,
} from './shelf-parent-sync';
import { isIdleUnitStatus } from './unit-status';
import type { WarehouseView } from './warehouse.view';
import {
  assertNoNullRequiredFields,
  assertRealLocation,
  handleDbError,
  pick,
  resolveAddressCodes,
  UNIT_FIELDS,
} from './warehouse-command.helpers';
import {
  assertFacilityActive,
  assertManagesFacility,
  assertNoOpenTickets,
  assertNoOpenTours,
  assertNotFrozen,
  changes,
  countOpenTours,
  lockFacility,
  lockUnit,
} from './warehouse-command.locks';
import { WarehouseQueryService } from './warehouse-query.service';

/**
 * Write side of warehouses (storage units). Lock order is facility rows first, then the unit
 * row — the unit lock is the same one the booking flow takes.
 */
@Injectable()
export class WarehouseCommandService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly units: Repository<StorageUnit>,
    private readonly query: WarehouseQueryService,
  ) {}

  async create(dto: CreateWarehouseDto): Promise<WarehouseView> {
    assertRealLocation(dto.latitude, dto.longitude);
    // A shelf warehouse is priced per shelf, so it never carries a rent or deposit of its own.
    const kind = dto.kind ?? StorageUnitKind.SELF_STORAGE;
    const perShelf = kind === StorageUnitKind.SHELF_WAREHOUSE;
    if (perShelf) assertNoParentPricing(dto);
    const id = await this.units.manager.transaction(async (manager) => {
      const address = await resolveAddressCodes(manager, dto.wardCode, dto.provinceCode);
      assertFacilityActive(await lockFacility(manager, dto.facilityId));
      let unitId: string;
      try {
        const unit = await manager.save(
          manager.create(StorageUnit, {
            ...pick(dto, UNIT_FIELDS),
            ...address,
            kind,
            monthlyPrice: perShelf ? 0 : dto.monthlyPrice,
            depositMonths: dto.depositMonths ?? null,
            status: dto.status ?? StorageUnitStatus.AVAILABLE,
          }),
        );
        unitId = unit.id;
      } catch (err) {
        handleDbError(err);
      }
      if (dto.amenities) await replaceUnitAmenities(manager, unitId, dto.amenities);
      return unitId;
    });
    return this.query.findOne(id);
  }

  /**
   * Price, deposit, address, notes, photos and amenities stay editable — bookings and contracts keep their own
   * snapshots. Code, dimensions, status and facility are frozen while a customer is attached;
   * moving to another facility also requires an active target facility and no open tour or service ticket.
   * A shelf warehouse moves with all its shelves (refused while any is occupied); a shelf's own
   * location and photos come from its shelf warehouse and cannot be edited on the shelf.
   */
  async update(id: string, dto: UpdateWarehouseDto): Promise<WarehouseView> {
    await this.units.manager.transaction(async (manager) => {
      const targetFacility = dto.facilityId ? await lockFacility(manager, dto.facilityId) : null;
      const unit = await lockUnit(manager, id);
      assertNoNullRequiredFields(dto, unit.kind);
      if (unit.kind === StorageUnitKind.SHELF) assertShelfPatchAllowed(dto);
      const isParent = unit.kind === StorageUnitKind.SHELF_WAREHOUSE;
      if (isParent) await assertParentPatchAllowed(manager, dto, unit);
      if (dto.latitude !== undefined || dto.longitude !== undefined) {
        assertRealLocation(dto.latitude ?? unit.latitude, dto.longitude ?? unit.longitude);
      }

      assertNotFrozen(dto, unit);
      if (isParent) await assertParentClosable(manager, unit, dto.status);
      if (targetFacility && changes(dto, 'facilityId', unit)) {
        assertFacilityActive(targetFacility);
        if (isParent) {
          await assertParentMovable(manager, unit);
        } else {
          await assertNoOpenTours(manager, unit.id);
          await assertNoOpenTickets(manager, unit.id);
        }
      }

      const patch: Partial<StorageUnit> = pick(dto, UNIT_FIELDS);
      if (dto.wardCode !== undefined || dto.provinceCode !== undefined) {
        const wardCode = dto.wardCode !== undefined ? dto.wardCode : unit.wardCode;
        const provinceCode = dto.provinceCode !== undefined ? dto.provinceCode : unit.provinceCode;
        Object.assign(patch, await resolveAddressCodes(manager, wardCode, provinceCode));
      }

      try {
        if (Object.keys(patch).length > 0) {
          await manager.update(StorageUnit, unit.id, patch);
          if (isParent) await cascadeParentLocation(manager, unit.id, patch);
        }
      } catch (err) {
        handleDbError(err);
      }
      // Outside the try: amenity problems are field errors, not database conflicts. The unit lock
      // taken above serialises concurrent edits of this warehouse.
      if (dto.amenities !== undefined) await replaceUnitAmenities(manager, unit.id, dto.amenities);
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
      await assertManagesFacility(manager, actor, unit.facilityId);
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
      if (unit.kind === StorageUnitKind.SHELF_WAREHOUSE) {
        await assertParentClosable(manager, unit, dto.status);
      }
      await manager.update(StorageUnit, unit.id, { status: dto.status });
    });
    return this.query.findOne(id);
  }

  /**
   * Refused while a customer is attached or a tour is still expected on this warehouse. A shelf
   * warehouse is retired with its shelves, and only when none of them is occupied.
   */
  async softDelete(id: string): Promise<void> {
    await this.units.manager.transaction(async (manager) => {
      const unit = await lockUnit(manager, id);
      if (unit.kind === StorageUnitKind.SHELF_WAREHOUSE) {
        return softDeleteWithShelves(manager, unit);
      }
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
}
