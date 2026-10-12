import { ShelfLayout } from '@entities/shelf-layout.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { StorageUnitKind } from '@storage/types';
import { type EntityManager, IsNull, type Repository } from 'typeorm';
import { assertManagesFacility, lockShelfParent } from '../warehouse-command.locks';
import { WarehouseQueryService } from '../warehouse-query.service';
import type { SaveLayoutDto } from './layout.dto';
import { type LayoutView, toLayoutView } from './layout.view';
import { draftLayout } from './layout-draft';
import { type LayoutDocument, validateLayout } from './layout-rules';

/** A draft is a layout nobody saved yet, plus the version the editor must send back on save. */
export interface LayoutDraft extends LayoutDocument {
  basedOnVersion: number;
}

const SHELF_WAREHOUSE = 'Shelf warehouse';

function versionMismatch(currentVersion: number): DomainException {
  return new DomainException(
    ErrorCode.CONFLICT,
    'The layout was changed by someone else, reload it',
    HttpStatus.CONFLICT,
    { reason: 'LAYOUT_VERSION_MISMATCH', currentVersion },
  );
}

/**
 * The floor plan of a shelf warehouse. Writes lock facility, then the warehouse, then the layout
 * row — the same order as shelf commands — so an editor never waits on a lock held the other way.
 */
@Injectable()
export class LayoutService {
  constructor(
    @InjectRepository(ShelfLayout)
    private readonly layouts: Repository<ShelfLayout>,
    @InjectRepository(StorageUnit)
    private readonly units: Repository<StorageUnit>,
    private readonly query: WarehouseQueryService,
  ) {}

  /** Public without `actor`; with one, back-office extras and facility scope apply. */
  async getLayout(warehouseId: string, actor?: AuthUser): Promise<LayoutView> {
    // Checks the warehouse (404 unless a live shelf warehouse) and the actor's facility scope.
    const shelves = await this.query.listShelves(warehouseId, { includeInactive: true, actor });
    const layout = await this.layouts.findOne({ where: { warehouseId } });
    return toLayoutView(warehouseId, layout, shelves, { backOffice: actor !== undefined });
  }

  async save(warehouseId: string, dto: SaveLayoutDto, actor: AuthUser): Promise<LayoutView> {
    try {
      await this.units.manager.transaction(async (manager) => {
        const current = await this.lockForWrite(manager, warehouseId, dto.version, actor);

        const shelves = await manager.find(StorageUnit, {
          select: { id: true, code: true },
          where: { parentId: warehouseId, deletedAt: IsNull() },
        });
        const problems = validateLayout(
          dto,
          new Map(shelves.map((shelf) => [shelf.id, { code: shelf.code }])),
        );
        if (problems.length > 0) {
          throw new DomainException(
            ErrorCode.VALIDATION_FAILED,
            'Validation failed',
            HttpStatus.BAD_REQUEST,
            { fields: problems },
          );
        }

        const document = {
          rows: dto.rows,
          cols: dto.cols,
          elements: dto.elements.map(({ text, ...rest }) =>
            text === undefined ? rest : { ...rest, text: text.trim() },
          ),
          placements: dto.placements.map((placement) => ({ ...placement })),
          updatedBy: actor.id,
        };
        if (current) {
          await manager.update(
            ShelfLayout,
            { warehouseId },
            { ...document, version: dto.version + 1 },
          );
        } else {
          await manager.insert(ShelfLayout, { ...document, warehouseId, version: 1 });
        }
      });
    } catch (err) {
      // Two first saves racing: the loser hits the primary key instead of the row lock.
      if (isUniqueViolation(err)) throw await this.currentMismatch(warehouseId);
      throw err;
    }
    return this.getLayout(warehouseId, actor);
  }

  async remove(warehouseId: string, version: number, actor: AuthUser): Promise<void> {
    await this.units.manager.transaction(async (manager) => {
      const current = await this.lockForWrite(manager, warehouseId, version, actor);
      if (!current) notFound('Layout', warehouseId);
      await manager.delete(ShelfLayout, { warehouseId });
    });
  }

  /** Proposes a plan from the shelf codes; nothing is stored. */
  async draft(warehouseId: string, actor: AuthUser): Promise<LayoutDraft> {
    const manager = this.units.manager;
    const parent = await manager.findOne(StorageUnit, {
      where: { id: warehouseId, deletedAt: IsNull() },
    });
    if (!parent || parent.kind !== StorageUnitKind.SHELF_WAREHOUSE)
      notFound(SHELF_WAREHOUSE, warehouseId);
    await assertManagesFacility(manager, actor, parent.facilityId);

    const shelves = await manager.find(StorageUnit, {
      select: { id: true, code: true },
      where: { parentId: warehouseId, deletedAt: IsNull() },
    });
    const draft = draftLayout(parent.code, shelves);
    if (!draft) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        'Too many shelves for an automatic draft',
        HttpStatus.CONFLICT,
      );
    }
    const current = await this.layouts.findOne({ where: { warehouseId } });
    return { ...draft, basedOnVersion: current?.version ?? 0 };
  }

  /**
   * Locks facility, warehouse and layout row, checks scope and that the editor saw the latest
   * version (no row counts as version 0), and returns the locked layout if there is one.
   */
  private async lockForWrite(
    manager: EntityManager,
    warehouseId: string,
    version: number,
    actor: AuthUser,
  ): Promise<ShelfLayout | null> {
    const { parent } = await lockShelfParent(manager, warehouseId);
    if (parent.kind !== StorageUnitKind.SHELF_WAREHOUSE) notFound(SHELF_WAREHOUSE, warehouseId);
    await assertManagesFacility(manager, actor, parent.facilityId);
    // No relations here: Postgres cannot lock the nullable side of an outer join.
    const current = await manager.findOne(ShelfLayout, {
      where: { warehouseId },
      lock: { mode: 'pessimistic_write' },
    });
    if ((current?.version ?? 0) !== version) throw versionMismatch(current?.version ?? 0);
    return current;
  }

  private async currentMismatch(warehouseId: string): Promise<DomainException> {
    const current = await this.layouts.findOne({ where: { warehouseId } });
    return versionMismatch(current?.version ?? 0);
  }
}
