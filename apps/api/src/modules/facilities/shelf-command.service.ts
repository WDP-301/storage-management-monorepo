import { StorageUnit } from '@entities/storage-unit.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, fieldValidationError } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StorageUnitKind, StorageUnitStatus } from '@storage/types';
import type { Repository } from 'typeorm';
import type { BulkCreateShelvesDto, CreateShelfDto } from './dto/shelf.dto';
import { MAX_BULK_SHELVES, MAX_UNIT_CODE_LENGTH, type ShelfSpecDto } from './dto/shelf.dto';
import type { WarehouseView } from './warehouse.view';
import { handleDbError } from './warehouse-command.helpers';
import { assertFacilityActive, lockShelfParent } from './warehouse-command.locks';
import { WarehouseQueryService } from './warehouse-query.service';

const MAX_NAME_LENGTH = 150;

interface ShelfDraft {
  code: string;
  name?: string;
  notes?: string;
  status?: StorageUnitStatus;
}

/** "KK1-A-03" under building "KK1" reads "A-03" in the shelf's name. */
function defaultShelfName(parent: StorageUnit, code: string): string {
  const own = code.startsWith(`${parent.code}-`) ? code.slice(parent.code.length + 1) : code;
  return `${parent.name} · Kệ ${own}`.slice(0, MAX_NAME_LENGTH);
}

/** Codes `<building>-<prefix>-<number>` for from..to, numbers zero-padded to `pad`. */
export function bulkShelfDrafts(parent: StorageUnit, dto: BulkCreateShelvesDto): ShelfDraft[] {
  const { prefix, from, to, pad = 2 } = dto;
  if (to < from) {
    throw fieldValidationError('to', 'isGreaterOrEqualToFrom', 'to must not be below from');
  }
  const count = to - from + 1;
  if (count > MAX_BULK_SHELVES) {
    throw fieldValidationError('to', 'maxShelves', `At most ${MAX_BULK_SHELVES} shelves per call`);
  }
  return Array.from({ length: count }, (_, index) => {
    const code = `${parent.code}-${prefix}-${String(from + index).padStart(pad, '0')}`;
    if (code.length > MAX_UNIT_CODE_LENGTH) {
      throw fieldValidationError(
        'prefix',
        'maxLength',
        `Code ${code} exceeds ${MAX_UNIT_CODE_LENGTH} characters`,
      );
    }
    return { code };
  });
}

/**
 * Creates shelves under a shelf warehouse. Lock order matches the rest of the module: facility,
 * then the building, with the building held FOR SHARE so a concurrent location update (which takes
 * it FOR UPDATE) waits for the insert — the location copied onto the shelves is never stale.
 */
@Injectable()
export class ShelfCommandService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly units: Repository<StorageUnit>,
    private readonly query: WarehouseQueryService,
  ) {}

  async createShelf(parentId: string, dto: CreateShelfDto): Promise<WarehouseView> {
    const [shelf] = await this.insertShelves(parentId, dto, () => [dto]);
    return this.query.findOne(shelf.id);
  }

  /** All-or-nothing: one clashing code rejects the whole batch. */
  async bulkCreate(
    parentId: string,
    dto: BulkCreateShelvesDto,
  ): Promise<{ created: number; codes: string[] }> {
    const shelves = await this.insertShelves(parentId, dto, (parent) =>
      bulkShelfDrafts(parent, dto),
    );
    return { created: shelves.length, codes: shelves.map((shelf) => shelf.code) };
  }

  private insertShelves(
    parentId: string,
    spec: ShelfSpecDto,
    draftsFor: (parent: StorageUnit) => ShelfDraft[],
  ): Promise<StorageUnit[]> {
    return this.units.manager.transaction(async (manager) => {
      const { parent, facility } = await lockShelfParent(manager, parentId);
      if (parent.kind !== StorageUnitKind.SHELF_WAREHOUSE) {
        throw new DomainException(
          ErrorCode.BAD_REQUEST,
          'Shelves can only be added to a shelf warehouse',
          HttpStatus.BAD_REQUEST,
        );
      }
      assertFacilityActive(facility);
      const rows = draftsFor(parent).map((draft) =>
        manager.create(StorageUnit, {
          kind: StorageUnitKind.SHELF,
          parentId: parent.id,
          facilityId: parent.facilityId,
          addressLine: parent.addressLine,
          wardCode: parent.wardCode,
          provinceCode: parent.provinceCode,
          latitude: parent.latitude,
          longitude: parent.longitude,
          code: draft.code,
          name: draft.name ?? defaultShelfName(parent, draft.code),
          widthM: spec.widthM,
          lengthM: spec.lengthM,
          heightM: spec.heightM ?? null,
          monthlyPrice: spec.monthlyPrice,
          depositMonths: spec.depositMonths ?? null,
          notes: draft.notes,
          status: draft.status ?? StorageUnitStatus.AVAILABLE,
        }),
      );
      try {
        return await manager.save(rows);
      } catch (err) {
        handleDbError(err);
      }
    });
  }
}
