import { ContractRenewal } from '@entities/contract-renewal.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import {
  isGlobalManager,
  loadManagedFacilityIds,
} from '@modules/inspection/inspection-access.util';
import { Injectable } from '@nestjs/common';
import type { ContractRenewalListResponse, ContractRenewalView } from '@storage/types';
import { DataSource, type FindOptionsWhere, In } from 'typeorm';
import type { ListContractRenewalsQueryDto } from './dto/contract-renewal.dto';
import { RENEWAL_VIEW_RELATIONS, toRenewalView } from './renewal-view';

/** Read side of renewals: the customer's own requests, and the branch worklist. */
@Injectable()
export class ContractRenewalQueryService {
  constructor(private readonly dataSource: DataSource) {}

  async listMine(customerId: string): Promise<ContractRenewalView[]> {
    const rows = await this.dataSource.getRepository(ContractRenewal).find({
      where: { customerId },
      relations: RENEWAL_VIEW_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    return rows.map(toRenewalView);
  }

  /** Newest first; a facility manager only sees the facilities they manage. */
  async list(
    actor: AuthUser,
    query: ListContractRenewalsQueryDto,
  ): Promise<ContractRenewalListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: FindOptionsWhere<ContractRenewal> = query.status ? { status: query.status } : {};
    if (!isGlobalManager(actor)) {
      const facilityIds = await loadManagedFacilityIds(this.dataSource.manager, actor.id);
      if (facilityIds.length === 0) {
        return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      where.contract = { bookingItem: { storageUnit: { facilityId: In(facilityIds) } } };
    }
    const [rows, total] = await this.dataSource.getRepository(ContractRenewal).findAndCount({
      where,
      relations: RENEWAL_VIEW_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: rows.map(toRenewalView),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
