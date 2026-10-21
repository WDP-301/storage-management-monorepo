import { AccessEvent } from '@entities/access-event.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  isGlobalManager,
  loadManagedFacilityIds,
} from '@modules/inspection/inspection-access.util';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { buildPaginationMeta } from '@shared/models/api-response';
import { escapeLikePattern } from '@shared/utils/like-pattern.util';
import type { PaginationMeta } from '@storage/types';
import { DataSource, Repository } from 'typeorm';
import { type CheckInHistoryView, toCheckInView } from './check-in.view';
import type { ListCheckInsQueryDto } from './dto/access.dto';

@Injectable()
export class CheckInHistoryService {
  constructor(
    @InjectRepository(AccessEvent) private readonly events: Repository<AccessEvent>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Actual entries (used passes), newest first. Facility managers see only their facilities. */
  async list(
    actor: AuthUser,
    query: ListCheckInsQueryDto,
  ): Promise<{ checkIns: CheckInHistoryView[]; meta: PaginationMeta }> {
    const { page = 1, limit = 20 } = query;
    const scope = await this.facilityScope(actor, query.facilityId);
    if (scope?.length === 0) return { checkIns: [], meta: buildPaginationMeta(page, limit, 0) };

    // withDeleted: an entry stays in the audit trail after its warehouse is soft-deleted.
    const qb = this.events
      .createQueryBuilder('pass')
      .withDeleted()
      .innerJoinAndSelect('pass.customer', 'customer')
      .leftJoinAndSelect('pass.warehouse', 'warehouse')
      .innerJoinAndSelect('pass.facility', 'facility')
      .leftJoinAndSelect('pass.verifier', 'verifier')
      .where('pass.usedAt IS NOT NULL');

    if (scope) qb.andWhere('pass.facilityId IN (:...scope)', { scope });
    if (query.from) qb.andWhere('pass.usedAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('pass.usedAt <= :to', { to: new Date(query.to) });
    const term = query.search?.trim();
    if (term) {
      qb.andWhere(
        `(customer.fullName ILIKE :search OR customer.phone ILIKE :search
          OR warehouse.code ILIKE :search OR warehouse.name ILIKE :search)`,
        { search: `%${escapeLikePattern(term)}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('pass.usedAt', 'DESC')
      .addOrderBy('pass.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { checkIns: rows.map(toCheckInView), meta: buildPaginationMeta(page, limit, total) };
  }

  /** Facility ids the actor may read; undefined means every facility. */
  private async facilityScope(actor: AuthUser, facilityId?: string): Promise<string[] | undefined> {
    if (isGlobalManager(actor)) return facilityId ? [facilityId] : undefined;
    const managed = await loadManagedFacilityIds(this.dataSource.manager, actor.id);
    // facilityId narrows within the managed facilities, never beyond them.
    return facilityId ? managed.filter((id) => id === facilityId) : managed;
  }
}
