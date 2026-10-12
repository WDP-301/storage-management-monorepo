import { Contract } from '@entities/contract.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  isGlobalManager,
  loadManagedFacilityIds,
} from '@modules/inspection/inspection-access.util';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { escapeLikePattern } from '@shared/utils/like-pattern.util';
import type { PaginationMeta } from '@storage/types';
import { DataSource, Repository, type SelectQueryBuilder } from 'typeorm';
import { resolveContractAccess } from './contract-access.util';
import { loadContractInspections } from './contract-inspections.util';
import type { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { loadFirstRentSummaries, withPaymentQr } from './first-rent.util';
import {
  type BackOfficeContractRecord,
  type StaffContractRecord,
  toBackOfficeContractRecord,
  toStaffContractRecord,
} from './types/back-office-contract';

/**
 * Back-office read side of contracts. ADMIN and OPERATIONS_MANAGER see every facility;
 * a FACILITY_MANAGER only the facilities they manage, since contracts carry customer PII.
 */
@Injectable()
export class ContractQueryService {
  constructor(
    @InjectRepository(Contract) private readonly contracts: Repository<Contract>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async list(
    actor: AuthUser,
    query: ListContractsQueryDto,
  ): Promise<{ contracts: BackOfficeContractRecord[]; meta: PaginationMeta }> {
    const { page = 1, limit = 20 } = query;
    const scope = await this.facilityScope(actor, query.facilityId);
    if (scope?.length === 0) return { contracts: [], meta: buildPaginationMeta(page, limit, 0) };

    const qb = this.baseQuery();
    if (scope) qb.andWhere('unit.facilityId IN (:...scope)', { scope });
    if (query.status) qb.andWhere('contract.status = :status', { status: query.status });
    const term = query.search?.trim();
    if (term) {
      qb.andWhere(
        `(contract.contractNo ILIKE :search OR unit.code ILIKE :search
          OR contract.customerSnapshot ->> 'fullName' ILIKE :search
          OR contract.customerSnapshot ->> 'phone' ILIKE :search
          OR contract.customerSnapshot ->> 'email' ILIKE :search)`,
        { search: `%${escapeLikePattern(term)}%` },
      );
    }
    const [contracts, total] = await qb
      .orderBy('contract.createdAt', 'DESC')
      .addOrderBy('contract.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const ids = contracts.map((c) => c.id);
    const [inspections, firstRents] = await Promise.all([
      loadContractInspections(this.dataSource, ids),
      loadFirstRentSummaries(this.dataSource, ids),
    ]);
    return {
      contracts: contracts.map((c) =>
        toBackOfficeContractRecord(c, inspections.get(c.id), firstRents.get(c.id) ?? null),
      ),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async detail(id: string, actor: AuthUser): Promise<BackOfficeContractRecord> {
    const contract = await this.baseQuery().andWhere('contract.id = :id', { id }).getOne();
    if (!contract) notFound('Contract', id);
    const facilityId = contract.bookingItem?.storageUnit?.facilityId;
    const scope = await this.facilityScope(actor);
    if (scope && !(facilityId && scope.includes(facilityId))) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not manage the facility this contract belongs to',
        HttpStatus.FORBIDDEN,
      );
    }
    const [inspections, firstRents] = await Promise.all([
      loadContractInspections(this.dataSource, [contract.id]),
      loadFirstRentSummaries(this.dataSource, [contract.id]),
    ]);
    return toBackOfficeContractRecord(
      contract,
      inspections.get(contract.id),
      firstRents.get(contract.id) ?? null,
    );
  }

  /**
   * Contract file record for facility staff: the assigned inspector of the handover or latest
   * return, managers of the unit's facility, and global managers.
   */
  async staffView(id: string, actor: AuthUser): Promise<StaffContractRecord> {
    const contract = await this.baseQuery().andWhere('contract.id = :id', { id }).getOne();
    if (!contract) notFound('Contract', id);
    const access = await resolveContractAccess(this.dataSource.manager, contract, actor);
    if (!access.canView) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You are not assigned to this contract',
        HttpStatus.FORBIDDEN,
      );
    }
    // Staff get the transfer QR too: they show it to the customer at check-in.
    const firstRent = (await loadFirstRentSummaries(this.dataSource, [contract.id])).get(
      contract.id,
    );
    return toStaffContractRecord(
      contract,
      access.inspections,
      access.permissions,
      firstRent ? withPaymentQr(firstRent, this.config) : null,
    );
  }

  /** Facility ids the actor may read; undefined means every facility. */
  private async facilityScope(actor: AuthUser, facilityId?: string): Promise<string[] | undefined> {
    if (isGlobalManager(actor)) return facilityId ? [facilityId] : undefined;
    const managed = await loadManagedFacilityIds(this.dataSource.manager, actor.id);
    // facilityId narrows within the managed facilities, never beyond them.
    return facilityId ? managed.filter((id) => id === facilityId) : managed;
  }

  private baseQuery(): SelectQueryBuilder<Contract> {
    // Soft-deleted contracts are excluded by TypeORM's default deletedAt filter.
    return this.contracts
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.bookingItem', 'item')
      .leftJoinAndSelect('item.storageUnit', 'unit')
      .leftJoinAndSelect('unit.facility', 'facility');
  }
}
