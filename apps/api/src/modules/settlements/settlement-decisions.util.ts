import { fieldValidationError } from '@shared/exceptions/domain.exception';
import type { SettlementDecisionsInput, SettlementLineType } from '@storage/types';

export interface DecisionContext {
  damageIndexes: number[];
  /** Payments flagged for review: staff must include or exclude each. */
  reviewPaymentIds: string[];
  /** Payments credited automatically: they cannot be excluded. */
  creditPaymentIds: string[];
  /** Line types present on this settlement that may be waived. */
  waivableTypes: SettlementLineType[];
}

export interface IndexedDecisions {
  damages: Map<number, { amount?: number; waived: boolean }>;
  credits: Map<string, boolean>;
  waived: Map<SettlementLineType, string>;
}

/**
 * The reviewer's decisions keyed for the calculation. Rejects (400) a decision about something
 * the settlement does not have, one given twice, a damage both waived and priced, and any attempt
 * to drop money that is not under review (confirming it is a no-op).
 */
export function indexDecisions(
  decisions: SettlementDecisionsInput,
  context: DecisionContext,
): IndexedDecisions {
  const damages = new Map<number, { amount?: number; waived: boolean }>();
  for (const d of decisions.damageDecisions ?? []) {
    if (!context.damageIndexes.includes(d.index)) {
      throw fieldValidationError('damageDecisions', 'unknown', `Không có hư hỏng số ${d.index}`);
    }
    if (damages.has(d.index)) {
      throw fieldValidationError('damageDecisions', 'duplicate', `Hư hỏng ${d.index} bị lặp`);
    }
    if (d.waived && d.amount !== undefined) {
      throw fieldValidationError(
        'damageDecisions',
        'conflict',
        `Hư hỏng ${d.index}: chọn miễn phí hoặc nhập số tiền, không cả hai`,
      );
    }
    // Neither waived nor priced is no decision at all.
    if (d.waived || d.amount !== undefined) {
      damages.set(d.index, { amount: d.amount, waived: Boolean(d.waived) });
    }
  }

  const credits = new Map<string, boolean>();
  for (const c of decisions.creditDecisions ?? []) {
    if (context.creditPaymentIds.includes(c.paymentId)) {
      // Confirming an automatic credit changes nothing; dropping it is refused.
      if (c.include) continue;
      throw fieldValidationError(
        'creditDecisions',
        'notReviewable',
        'Khoản hoàn tiền thuê kỳ không dùng luôn được cộng, không thể loại',
      );
    }
    if (!context.reviewPaymentIds.includes(c.paymentId)) {
      throw fieldValidationError(
        'creditDecisions',
        'unknown',
        'Không có khoản tiền cần kiểm tra này',
      );
    }
    if (credits.has(c.paymentId)) {
      throw fieldValidationError('creditDecisions', 'duplicate', 'Khoản tiền bị lặp');
    }
    credits.set(c.paymentId, c.include);
  }

  const waived = new Map<SettlementLineType, string>();
  for (const w of decisions.waivedLines ?? []) {
    if (!context.waivableTypes.includes(w.type)) {
      throw fieldValidationError('waivedLines', 'notApplicable', 'Quyết toán không có khoản này');
    }
    const reason = w.reason?.trim();
    if (!reason) {
      throw fieldValidationError('waivedLines', 'reasonRequired', 'Nhập lý do miễn khoản này');
    }
    if (waived.has(w.type)) {
      throw fieldValidationError('waivedLines', 'duplicate', 'Khoản miễn bị lặp');
    }
    waived.set(w.type, reason);
  }
  return { damages, credits, waived };
}
