import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import type { Inspection } from '@entities/inspection.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { BanksService } from '@modules/banks/banks.service';
import { managesFacility, withoutRefundAccount } from '@modules/inspection/inspection-access.util';
import { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { DataSource, IsNull } from 'typeorm';
import {
  assertReturnDayInRange,
  currentReturnRules,
  openReturnInspection,
} from './contract-return.util';
import { ManagedReturnRequestDto } from './dto/managed-return-request.dto';

/**
 * Return requests the branch makes for a customer who phoned in or abandoned the unit. Same
 * rules as the customer's own request; the customer can still change or withdraw it while
 * staff have recorded nothing on it.
 */
@Injectable()
export class ManagedReturnService {
  private readonly logger = new Logger(ManagedReturnService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly banks: BanksService,
  ) {}

  /** Facility managers only for the facility of the unit; admin and operations everywhere. */
  async requestOnBehalf(
    contractId: string,
    actor: AuthUser,
    dto: ManagedReturnRequestDto,
  ): Promise<Inspection> {
    const now = new Date();
    const scheduledAt = new Date(dto.scheduledAt);
    assertReturnDayInRange('scheduledAt', scheduledAt, now);
    const rules = await currentReturnRules(this.settings);
    // Looked up before any lock is taken: the bank call can take seconds.
    const refundAccount = dto.refundAccount
      ? await this.banks.verifyAccount(dto.refundAccount)
      : null;

    const created = await this.dataSource.transaction(async (em) => {
      const contract = await em.findOne(Contract, {
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', contractId);
      const item = await em.findOne(BookingItem, {
        where: { id: contract.bookingItemId },
        relations: { storageUnit: true },
      });
      if (!(await managesFacility(em, actor, item?.storageUnit?.facilityId))) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'Bạn không quản lý cơ sở của kho này',
          HttpStatus.FORBIDDEN,
          { contractId },
        );
      }
      return openReturnInspection(em, contract, {
        scheduledAt,
        note: dto.note,
        refundAccount,
        rules,
        requestedBy: actor.id,
        source: dto.source,
        now,
      });
    });
    this.logger.log(
      `Return ${created.id} of contract ${contractId} requested by ${actor.id} (${dto.source})`,
    );
    return withoutRefundAccount(created);
  }
}
