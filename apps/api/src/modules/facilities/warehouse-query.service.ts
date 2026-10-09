import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import { SettingsService } from '@modules/settings/settings.service';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta } from '@shared/models/api-response';
import { escapeLikePattern } from '@shared/utils/like-pattern.util';
import { FacilityStatus, StorageUnitStatus, UserRole } from '@storage/types';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import type {
  AdminWarehouseListQueryDto,
  WarehouseListQueryDto,
  WarehouseSort,
} from './dto/warehouse.dto';
import { toWarehouseView, type WarehouseView } from './warehouse.view';

const SORT_COLUMNS: Record<WarehouseSort, [string, 'ASC' | 'DESC']> = {
  newest: ['facility.createdAt', 'DESC'],
  price_asc: ['unit.monthlyPrice', 'ASC'],
  price_desc: ['unit.monthlyPrice', 'DESC'],
  area_asc: ['unit.areaM2', 'ASC'],
  area_desc: ['unit.areaM2', 'DESC'],
};

/** Read side of warehouses: listings, lookups and the flattened view. */
@Injectable()
export class WarehouseQueryService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly units: Repository<StorageUnit>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    private readonly settings: SettingsService,
  ) {}

  /** Customer catalogue: only warehouses that can be rented right now. */
  async listPublic(query: WarehouseListQueryDto) {
    const qb = this.availableQuery();
    return this.paginate(applyFilters(qb, query), query, query.sort ?? 'price_asc');
  }

  async listAdmin(query: AdminWarehouseListQueryDto) {
    const qb = applyFilters(this.baseQuery(), query);
    if (query.status) qb.andWhere('unit.status = :status', { status: query.status });
    return this.paginate(qb, query, query.sort ?? 'newest');
  }

  /** Warehouses the user staffs or manages through an active facility-scoped assignment. */
  async listAssigned(userId: string): Promise<WarehouseView[]> {
    const facilityIds = activeFacilityIds(
      await this.roleAssignments.find({
        where: { userId, role: In([UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF]) },
      }),
    );
    if (facilityIds.length === 0) return [];
    const units = await this.baseQuery()
      .andWhere('facility.id IN (:...facilityIds)', { facilityIds })
      .orderBy('facility.code', 'ASC')
      .getMany();
    return this.toViews(units);
  }

  /** Every rentable warehouse, unpaginated — the nearby search ranks them by distance. */
  async listAvailable(): Promise<WarehouseView[]> {
    return this.toViews(await this.availableQuery().getMany());
  }

  async findOne(id: string): Promise<WarehouseView> {
    const unit = await this.baseQuery().andWhere('facility.id = :id', { id }).getOne();
    if (!unit) notFound('Warehouse', id);
    return (await this.toViews([unit]))[0];
  }

  private baseQuery(): SelectQueryBuilder<StorageUnit> {
    // Inner join: a soft-deleted facility hides its unit too.
    return this.units.createQueryBuilder('unit').innerJoinAndSelect('unit.facility', 'facility');
  }

  private availableQuery(): SelectQueryBuilder<StorageUnit> {
    return this.baseQuery()
      .andWhere('unit.status = :available', { available: StorageUnitStatus.AVAILABLE })
      .andWhere('facility.status = :active', { active: FacilityStatus.ACTIVE });
  }

  private async paginate(
    qb: SelectQueryBuilder<StorageUnit>,
    query: WarehouseListQueryDto,
    sort: WarehouseSort,
  ) {
    const { page = 1, limit = 20 } = query;
    const [column, direction] = SORT_COLUMNS[sort];
    const [units, total] = await qb
      .orderBy(column, direction)
      .addOrderBy('facility.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { warehouses: await this.toViews(units), meta: buildPaginationMeta(page, limit, total) };
  }

  private async toViews(units: StorageUnit[]): Promise<WarehouseView[]> {
    return Promise.all(
      units.map(async (unit) =>
        toWarehouseView(unit, await this.settings.getDepositMonthsFor(unit)),
      ),
    );
  }
}

function applyFilters(
  qb: SelectQueryBuilder<StorageUnit>,
  query: WarehouseListQueryDto,
): SelectQueryBuilder<StorageUnit> {
  const term = query.search?.trim();
  if (term) {
    qb.andWhere(
      '(facility.code ILIKE :search OR facility.name ILIKE :search OR facility.addressLine ILIKE :search)',
      { search: `%${escapeLikePattern(term)}%` },
    );
  }
  if (query.provinceCode) {
    qb.andWhere('facility.provinceCode = :provinceCode', { provinceCode: query.provinceCode });
  }
  if (query.wardCode) qb.andWhere('facility.wardCode = :wardCode', { wardCode: query.wardCode });

  const ranges: [keyof WarehouseListQueryDto, string, '>=' | '<='][] = [
    ['minArea', 'unit.areaM2', '>='],
    ['maxArea', 'unit.areaM2', '<='],
    ['minVolume', 'unit.volumeM3', '>='],
    ['maxVolume', 'unit.volumeM3', '<='],
    ['minPrice', 'unit.monthlyPrice', '>='],
    ['maxPrice', 'unit.monthlyPrice', '<='],
  ];
  for (const [key, column, operator] of ranges) {
    const value = query[key];
    if (value !== undefined) qb.andWhere(`${column} ${operator} :${key}`, { [key]: value });
  }
  return qb;
}
