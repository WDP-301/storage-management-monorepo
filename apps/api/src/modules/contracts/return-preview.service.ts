import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { SettingsService } from '@modules/settings/settings.service';
import { returnTiming, toReturnTimingRecord } from '@modules/settlements/return-timing';
import { Injectable } from '@nestjs/common';
import { notFound } from '@shared/exceptions/domain.exception';
import { vietnamDate } from '@shared/utils/calendar.util';
import { InspectionType, type ReturnPreviewRecord } from '@storage/types';
import { DataSource, IsNull } from 'typeorm';
import {
  assertContractActive,
  assertReturnDayInRange,
  currentReturnRules,
} from './contract-return.util';
import { resolveContractDeposit } from './deposit-ledger.util';
import { loadSavedRefundAccount } from './refund-account.util';

/** What returning on a given day would cost the customer, before they commit to it. */
@Injectable()
export class ReturnPreviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Previews a new request, or moving the open one. Moving it earlier would restart the notice
   * from now; otherwise the open request keeps its notice anchor and the rules it captured. The
   * return is assumed to happen on the chosen day. Reads only — nothing is recorded.
   */
  async preview(
    contractId: string,
    customerId: string,
    scheduledAtInput: string,
  ): Promise<ReturnPreviewRecord> {
    const now = new Date();
    const scheduledAt = new Date(scheduledAtInput);
    assertReturnDayInRange('scheduledAt', scheduledAt, now);
    const em = this.dataSource.manager;

    const contract = await em.findOne(Contract, { where: { id: contractId, deletedAt: IsNull() } });
    if (!contract || contract.customerId !== customerId) notFound('Contract', contractId);
    assertContractActive(contract);
    const open = await em.findOne(Inspection, {
      where: { contractId, type: InspectionType.RETURN, finalizedAt: IsNull() },
    });

    const movedEarlier =
      open?.scheduledAt != null && vietnamDate(scheduledAt) < vietnamDate(open.scheduledAt);
    // A request made before notice anchors existed counts from when it was made.
    const noticeFrom = !open || movedEarlier ? now : (open.noticeFrom ?? open.createdAt);
    const [rules, goLiveAt, deposit, savedAccount] = await Promise.all([
      open?.returnRules ?? currentReturnRules(this.settings),
      this.settings.getReturnRulesEffectiveAt(),
      resolveContractDeposit(em, contract),
      loadSavedRefundAccount(em, customerId),
    ]);

    const timing = returnTiming({
      effectiveAt: contract.effectiveAt,
      months: contract.months,
      monthlyPrice: contract.monthlyPriceSnapshot,
      noticeFrom,
      scheduledAt,
      rules,
      goLiveAt,
    });
    return {
      ...toReturnTimingRecord(timing),
      deposit_held: deposit ? Number(deposit.heldAmount) : null,
      saved_refund_account: savedAccount,
    };
  }
}
