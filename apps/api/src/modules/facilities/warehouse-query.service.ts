import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { HAS_ALL_AMENITIES_SQL, loadUnitAmenities } from '@modules/amenities/unit-amenities';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { SettingsService } from '@modules/settings/settings.service';
import { UploadService } from '@modules/upload/upload.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { escapeLikePattern } from '@shared/utils/like-pattern.util';
import { FacilityStatus, StorageUnitKind, StorageUnitStatus, UserRole } from '@storage/types';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import type {
  AdminWarehouseListQueryDto,
  WarehouseListQueryDto,
  WarehouseSort,
} from './dto/warehouse.dto';
import { applySort, applyUnitScope, type ListMode, shelfSearchExists } from './shelf-scope.query';
import { loadShelfSummaries } from './shelf-summary.query';
import { toWarehouseView, type WarehouseImageView, type WarehouseView } from './warehouse.view';

/** Long enough for a customer to browse a page of results without the photos going stale. */
const IMAGE_URL_TTL_SECONDS = 6 * 3600;

/** Read side of warehouses: listings, lookups and the flattened view. */
@Injectable()
export class WarehouseQueryService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly units: Repository<StorageUnit>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    private readonly settings: SettingsService,
    private readonly uploads: UploadService,
  ) {}

  /**
   * Customer catalogue: only warehouses that can be rented right now, shelf warehouses via their
   * free shelves — and those only for clients that opt in, since older apps would show them as
   * rentable at 0 đ.
   */
  async listPublic(query: WarehouseListQueryDto) {
    const qb = applyFilters(
      this.availableQuery(query, query.includeShelfWarehouses === true),
      query,
    );
    return this.paginate(qb, query, query.sort ?? 'price_asc', 'catalogue');
  }

  /** Shelves never appear here — they are listed through their shelf warehouse. */
  async listAdmin(query: AdminWarehouseListQueryDto) {
    const qb = applyFilters(this.baseQuery(), query, true);
    applyUnitScope(qb, query, 'admin');
    return this.paginate(qb, query, query.sort ?? 'newest', 'admin');
  }

  /** Warehouses the user staffs or manages through an active facility-scoped assignment. */
  async listAssigned(userId: string, facilityId?: string): Promise<WarehouseView[]> {
    const facilityIds = await this.assignedFacilityIds(userId, [
      UserRole.FACILITY_MANAGER,
      UserRole.FACILITY_STAFF,
    ]);
    // facilityId narrows within the caller's assignments, never beyond them.
    const scope = facilityId ? facilityIds.filter((id) => id === facilityId) : facilityIds;
    if (scope.length === 0) return [];
    const units = await this.baseQuery()
      .andWhere('unit.kind <> :shelfKind', { shelfKind: StorageUnitKind.SHELF })
      .andWhere('unit.facilityId IN (:...scope)', { scope })
      .orderBy('facility.code', 'ASC')
      .addOrderBy('unit.code', 'ASC')
      .getMany();
    return this.toViews(units);
  }

  /** Every rentable warehouse, unpaginated — the nearby search ranks them by distance. */
  async listAvailable(includeShelfWarehouses = false): Promise<WarehouseView[]> {
    return this.toViews(await this.availableQuery({}, includeShelfWarehouses).getMany());
  }

  /**
   * The shelves of a shelf warehouse, by code. Customers never see retired (INACTIVE) shelves,
   * nor a warehouse that is out of service (maintenance or retired) or in a closed facility;
   * back office passes `actor` to see them, and a facility manager only for their own facilities.
   */
  async listShelves(
    parentId: string,
    options: { includeInactive: boolean; actor?: AuthUser },
  ): Promise<WarehouseView[]> {
    const parent = await this.units.findOne({
      where: { id: parentId },
      relations: { facility: true },
    });
    if (!parent || parent.kind !== StorageUnitKind.SHELF_WAREHOUSE)
      notFound('Shelf warehouse', parentId);
    if (options.actor) {
      await this.assertCanSeeFacility(options.actor, parent.facilityId);
    } else if (
      parent.status !== StorageUnitStatus.AVAILABLE ||
      parent.facility?.status !== FacilityStatus.ACTIVE
    ) {
      notFound('Shelf warehouse', parentId);
    }

    const qb = this.baseQuery().andWhere('unit.parentId = :parentId', { parentId });
    if (!options.includeInactive) {
      qb.andWhere('unit.status <> :inactive', { inactive: StorageUnitStatus.INACTIVE });
    }
    return this.toViews(await qb.orderBy('unit.code', 'ASC').getMany());
  }

  async findOne(id: string): Promise<WarehouseView> {
    const unit = await this.baseQuery().andWhere('unit.id = :id', { id }).getOne();
    if (!unit) notFound('Warehouse', id);
    return (await this.toViews([unit]))[0];
  }

  private async assignedFacilityIds(userId: string, roles: UserRole[]): Promise<string[]> {
    return activeFacilityIds(
      await this.roleAssignments.find({ where: { userId, role: In(roles) } }),
    );
  }

  private async assertCanSeeFacility(actor: AuthUser, facilityId: string): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN) || actor.roles.includes(UserRole.OPERATIONS_MANAGER)) {
      return;
    }
    // Staff assignments do not count: these back-office reads are for facility managers only.
    const ids = await this.assignedFacilityIds(actor.id, [UserRole.FACILITY_MANAGER]);
    if (!ids.includes(facilityId)) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage this warehouse',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private baseQuery(): SelectQueryBuilder<StorageUnit> {
    // Inner join: a soft-deleted facility hides its warehouses too. The shelf's building is joined
    // without a lock, only to name it in the view.
    return this.units
      .createQueryBuilder('unit')
      .innerJoinAndSelect('unit.facility', 'facility')
      .leftJoin('unit.parent', 'parent')
      .addSelect(['parent.id', 'parent.code', 'parent.name']);
  }

  private availableQuery(
    query: AdminWarehouseListQueryDto,
    includeShelfWarehouses: boolean,
  ): SelectQueryBuilder<StorageUnit> {
    const qb = this.baseQuery()
      .andWhere('unit.status = :available', { available: StorageUnitStatus.AVAILABLE })
      .andWhere('facility.status = :active', { active: FacilityStatus.ACTIVE });
    applyUnitScope(qb, query, 'catalogue');
    if (!includeShelfWarehouses) {
      qb.andWhere('unit.kind <> :hiddenKind', { hiddenKind: StorageUnitKind.SHELF_WAREHOUSE });
    }
    return qb;
  }

  // offset/limit instead of skip/take: the sort may be a computed column, which skip/take cannot
  // order by. Every join is many-to-one, so rows are not multiplied and the count stays exact.
  private async paginate(
    qb: SelectQueryBuilder<StorageUnit>,
    query: WarehouseListQueryDto,
    sort: WarehouseSort,
    mode: ListMode,
  ) {
    const { page = 1, limit = 20 } = query;
    const total = await qb.getCount();
    applySort(qb, sort, mode, query);
    const units = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();
    return {
      warehouses: await this.toViews(units, query),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /** `filter` narrows the shelf rollup of shelf warehouses to the shelves the listing matched on. */
  private async toViews(
    units: StorageUnit[],
    filter?: WarehouseListQueryDto,
  ): Promise<WarehouseView[]> {
    const parentIds = units
      .filter((unit) => unit.kind === StorageUnitKind.SHELF_WAREHOUSE)
      .map((unit) => unit.id);
    const summaries = await loadShelfSummaries(this.units.manager, parentIds, filter);
    // Shelves show no amenities of their own, so they are not worth a lookup.
    const amenities = await loadUnitAmenities(
      this.units.manager,
      units.filter((unit) => unit.kind !== StorageUnitKind.SHELF).map((unit) => unit.id),
    );
    return Promise.all(
      units.map(async (unit) =>
        toWarehouseView(
          unit,
          await this.settings.getDepositMonthsFor(unit),
          await this.signImages(unit),
          summaries.get(unit.id) ?? null,
          amenities.get(unit.id) ?? [],
        ),
      ),
    );
  }

  /** The bucket is private and the catalogue is public, so photos travel as presigned links. */
  private signImages(unit: StorageUnit): Promise<WarehouseImageView[]> {
    return Promise.all(
      (unit.images ?? []).map(async (image) => ({
        ...image,
        url: await this.uploads.generatePresignedDownloadUrl(image.fileKey, IMAGE_URL_TTL_SECONDS),
      })),
    );
  }
}

function applyFilters(
  qb: SelectQueryBuilder<StorageUnit>,
  query: WarehouseListQueryDto,
  searchShelves = false,
): SelectQueryBuilder<StorageUnit> {
  const term = query.search?.trim();
  if (term) {
    const own =
      'unit.code ILIKE :search OR unit.name ILIKE :search OR unit.addressLine ILIKE :search';
    qb.andWhere(`(${own}${searchShelves ? ` OR ${shelfSearchExists}` : ''})`, {
      search: `%${escapeLikePattern(term)}%`,
    });
  }
  if (query.facilityId)
    qb.andWhere('unit.facilityId = :facilityId', { facilityId: query.facilityId });
  if (query.provinceCode) {
    qb.andWhere('unit.provinceCode = :provinceCode', { provinceCode: query.provinceCode });
  }
  if (query.wardCode) qb.andWhere('unit.wardCode = :wardCode', { wardCode: query.wardCode });
  if (query.amenityIds?.length) {
    qb.andWhere(HAS_ALL_AMENITIES_SQL, {
      amenityIds: query.amenityIds,
      amenityCount: query.amenityIds.length,
    });
  }
  return qb;
}
