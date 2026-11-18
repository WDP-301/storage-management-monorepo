import { Contract } from '@entities/contract.entity';
import type { Invoice } from '@entities/invoice.entity';
import type { LedgerDeposit } from '@modules/contracts/deposit-ledger.util';
import { issueFeeInvoice } from '@modules/invoices/fee-invoice.util';
import { formatDateStr, formatVndCurrency } from '@modules/invoices/invoice-pdf.service';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import { ChangeRequestStatus, InvoiceItemType, NotificationType } from '@storage/types';
import Decimal from 'decimal.js';
import type { EntityManager } from 'typeorm';

type Notifier = Pick<NotificationsService, 'createForUsers'>;

/** A damage found on the vacated unit, with the fee staff proposed for it. */
export interface MovedUnitDamage {
  description: string;
  fee: number;
}

const invoiceDue = (invoice: Invoice): string =>
  `hóa đơn ${invoice.invoiceNo} — hạn thanh toán ${formatDateStr(invoice.dueAt)}`;

/**
 * Applies the old unit's rent net to the deposit that moves to the new contract: an overpayment is
 * parked in it, a debt is taken from it. Debt the deposit cannot cover is billed on the new
 * contract — never forgiven — and the customer is told what happened to each part.
 */
export async function settleRentNetOnDeposit(
  em: EntityManager,
  input: {
    oldContract: Pick<Contract, 'id' | 'contractNo' | 'customerId'>;
    newContractId: string;
    oldDeposit: Pick<LedgerDeposit, 'id' | 'heldAmount'> | null;
    rentNet: Decimal;
    notifications: Notifier;
    now: Date;
  },
): Promise<Invoice | null> {
  const { oldContract, oldDeposit, rentNet } = input;
  if (rentNet.isZero()) return null;
  const owed = Decimal.max(rentNet.neg(), 0);
  const taken = Decimal.min(owed, oldDeposit?.heldAmount ?? 0);
  const shortfall = owed.minus(taken);
  const depositChange = rentNet.gt(0) ? rentNet : taken.neg();

  if (oldDeposit && !depositChange.isZero()) {
    await em.query(
      `UPDATE "deposits" SET "held_amount" = "held_amount" + $1, "updated_at" = now()
        WHERE "id" = $2`,
      [depositChange.toFixed(2), oldDeposit.id],
    );
  }

  let invoice: Invoice | null = null;
  if (shortfall.gt(0)) {
    const newContract = await em.findOneOrFail(Contract, { where: { id: input.newContractId } });
    invoice = await issueFeeInvoice(em, {
      contract: newContract,
      lines: [
        {
          itemType: InvoiceItemType.ADJUSTMENT,
          description: `Tiền thuê kho cũ còn thiếu (HĐ: ${oldContract.contractNo})`,
          quantity: 1,
          unitAmount: shortfall,
          amount: shortfall,
        },
      ],
      billingInfo: { movedFromContractId: oldContract.id },
      now: input.now,
    });
  }

  const parts: string[] = [];
  if (rentNet.gt(0) && oldDeposit) {
    parts.push(
      `Bạn đã trả dư ${formatVndCurrency(rentNet.toFixed(0))} tiền thuê kho cũ — ` +
        'số tiền này được cộng vào tiền cọc theo hợp đồng mới.',
    );
  }
  if (taken.gt(0)) {
    parts.push(
      `Tiền thuê còn thiếu của kho cũ ${formatVndCurrency(taken.toFixed(0))} ` +
        'đã được trừ vào tiền cọc chuyển sang hợp đồng mới.',
    );
  }
  if (invoice) {
    parts.push(
      `Phần tiền cọc không đủ bù ${formatVndCurrency(shortfall.toFixed(0))} được tính vào ` +
        `${invoiceDue(invoice)}.`,
    );
  }
  if (parts.length > 0) {
    await input.notifications.createForUsers(em, [oldContract.customerId], {
      type: invoice ? NotificationType.INVOICE_ISSUED : NotificationType.UNIT_CHANGE_RENT_SETTLED,
      title: 'Quyết toán tiền thuê kho cũ',
      body: parts.join(' '),
      data: {
        contractId: invoice ? input.newContractId : oldContract.id,
        amount: rentNet.toFixed(2),
        ...(invoice ? { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo } : {}),
      },
    });
  }
  return invoice;
}

/**
 * Damage found at the vacated unit's maintenance check is billed to the customer at once on a
 * separate DAMAGE invoice of the destination contract (their active rental); the deposit is left
 * alone. Null when the old contract was not retired by a unit change or nothing is charged.
 */
export async function billMovedUnitDamage(
  em: EntityManager,
  input: {
    oldContract: Pick<Contract, 'id' | 'contractNo' | 'customerId'>;
    damages: MovedUnitDamage[];
    inspectionId: string;
    notifications: Notifier;
    now: Date;
  },
): Promise<Invoice | null> {
  const charged = input.damages.filter((damage) => damage.fee > 0);
  if (charged.length === 0) return null;
  const [link]: { newContractId: string | null }[] = await em.query(
    `SELECT "new_contract_id" AS "newContractId" FROM "unit_change_requests"
      WHERE "contract_id" = $1 AND "new_contract_id" IS NOT NULL
        AND "status" IN ('${ChangeRequestStatus.AWAITING_FINAL_APPROVAL}', '${ChangeRequestStatus.COMPLETED}')
      ORDER BY "created_at" DESC, "id" DESC LIMIT 1`,
    [input.oldContract.id],
  );
  if (!link?.newContractId) return null;
  const newContract = await em.findOneOrFail(Contract, { where: { id: link.newContractId } });

  const invoice = await issueFeeInvoice(em, {
    contract: newContract,
    lines: charged.map((damage) => ({
      itemType: InvoiceItemType.DAMAGE,
      description: `Hư hỏng kho cũ (HĐ: ${input.oldContract.contractNo}): ${damage.description}`,
      quantity: 1,
      unitAmount: damage.fee,
      amount: damage.fee,
    })),
    billingInfo: { movedFromContractId: input.oldContract.id, inspectionId: input.inspectionId },
    now: input.now,
  });
  await input.notifications.createForUsers(em, [input.oldContract.customerId], {
    type: NotificationType.INVOICE_ISSUED,
    title: 'Phí hư hỏng kho cũ',
    body:
      `Kiểm tra kho cũ phát hiện hư hỏng — phí ${formatVndCurrency(invoice.total)}, ` +
      `${invoiceDue(invoice)}.`,
    data: {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      contractId: newContract.id,
      inspectionId: input.inspectionId,
    },
  });
  return invoice;
}
