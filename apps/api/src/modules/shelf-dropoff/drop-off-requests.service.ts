import { DropOffRequest, type DropOffRequestLine } from '@entities/drop-off-request.entity';
import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { SettingsService } from '@modules/settings/settings.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { startOfVietnamDay } from '@shared/utils/calendar.util';
import {
  DropOffRequestStatus,
  type DropOffRequestView,
  MAX_OPEN_DROP_OFF_REQUESTS,
  type ShelfItemUnit,
  ShelfReceiptType,
} from '@storage/types';
import { DataSource, type EntityManager } from 'typeorm';
import { loadDropOffRequests } from '../shelf-storage/drop-off-request.read';
import { type NormalizedLine, normalizeLines } from '../shelf-storage/receipt-input.util';
import { assertUnits } from '../shelf-storage/receipt-stock.util';
import { findShelfContracts, loadStock } from '../shelf-storage/shelf-contract.query';
import { assignShelfRequestSafely } from '../shelf-storage/shelf-request-assignment';
import {
  assertRequestedForInRange,
  dropOffRequestBlock,
  itemNameKey,
} from '../shelf-storage/shelf-rules';
import { notifyDropOffCancelled, notifyDropOffCreated } from './drop-off-notifications';
import type { CreateDropOffRequestDto } from './dto/drop-off-request.dto';

const CONTRACT_LIST_LIMIT = 20;
const OPEN_STATUSES: readonly DropOffRequestStatus[] = [
  DropOffRequestStatus.PENDING,
  DropOffRequestStatus.CONFIRMED,
];

export function notAllowed(
  reason: string,
  message: string,
  extra: Record<string, unknown> = {},
): DomainException {
  return new DomainException(ErrorCode.DROP_OFF_REQUEST_NOT_ALLOWED, message, HttpStatus.CONFLICT, {
    reason,
    ...extra,
  });
}

/** Literal statuses, matching IDX_drop_off_requests_open_contract's predicate so the index serves it. */
async function countOpenDropOffRequests(em: EntityManager, contractId: string): Promise<number> {
  const rows: { count: string }[] = await em.query(
    `SELECT COUNT(*) AS "count" FROM "drop_off_requests"
      WHERE "contract_id" = $1 AND "status" IN ('PENDING','CONFIRMED')`,
    [contractId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Locks the request row after the contract and returns its status, or 404 if it vanished. */
export async function lockDropOffStatus(
  em: EntityManager,
  id: string,
): Promise<DropOffRequestStatus> {
  const rows: { status: DropOffRequestStatus }[] = await em.query(
    `SELECT "status" FROM "drop_off_requests" WHERE "id" = $1 FOR UPDATE`,
    [id],
  );
  if (rows.length === 0) notFound('Drop-off request', id);
  return rows[0].status;
}

/** Customer side of drop-off requests. Foreign contracts and requests answer 404. */
@Injectable()
export class DropOffRequestsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  async listForContract(contractId: string, actor: AuthUser): Promise<DropOffRequestView[]> {
    const em = this.dataSource.manager;
    const [contract] = await findShelfContracts(em, { contractId, customerId: actor.id });
    if (!contract) notFound('Contract', contractId);
    return loadDropOffRequests(em, {
      contractIds: [contractId],
      order: 'newest',
      limit: CONTRACT_LIST_LIMIT,
    });
  }

  async create(
    contractId: string,
    dto: CreateDropOffRequestDto,
    actor: AuthUser,
  ): Promise<DropOffRequestView> {
    const requestedFor = new Date(dto.requestedFor);
    const now = new Date();
    assertRequestedForInRange(requestedFor, now, await this.settings.getShelfRequestMaxDaysAhead());
    // Same line rules as a drop-off receipt: an existing item or a name, no repeats.
    const lines = normalizeLines(dto.lines, ShelfReceiptType.DROP_OFF);

    return this.dataSource.transaction((em) =>
      this.createIn(em, contractId, lines, dto.note, actor, requestedFor, now),
    );
  }

  private async createIn(
    em: EntityManager,
    contractId: string,
    lines: NormalizedLine[],
    note: string | undefined,
    actor: AuthUser,
    requestedFor: Date,
    now: Date,
  ): Promise<DropOffRequestView> {
    // The contract row lock serialises creates, so the open count cannot race past the cap.
    const [contract] = await findShelfContracts(em, { contractId, lock: true });
    if (!contract || contract.customerId !== actor.id) notFound('Contract', contractId);
    const openRequestCount = await countOpenDropOffRequests(em, contract.id);
    const invoiceNos = await findOverdueInvoiceNos(em, actor.id, now);
    const block = dropOffRequestBlock({
      status: contract.status,
      openRequestCount,
      overdue: invoiceNos.length > 0,
    });
    if (block === 'INVOICE_OVERDUE') {
      throw new DomainException(
        ErrorCode.INVOICE_OVERDUE,
        'Settle the overdue invoices before requesting a drop-off',
        HttpStatus.CONFLICT,
        { invoiceNos },
      );
    }
    if (block) {
      throw notAllowed(block, 'A drop-off request cannot be made for this contract', {
        ...(block === 'TOO_MANY_OPEN_REQUESTS' ? { max: MAX_OPEN_DROP_OFF_REQUESTS } : {}),
      });
    }
    // Goods are only received from 00:00 Vietnam time on the start day.
    if (requestedFor.getTime() < startOfVietnamDay(contract.effectiveAt).getTime()) {
      throw notAllowed('BEFORE_CONTRACT_START', 'The contract has not started at that time', {
        effectiveAt: contract.effectiveAt,
      });
    }

    // Empty items count too: the customer may bring back something taken out earlier.
    const items =
      (await loadStock(em, [contract.id], { includeEmpty: true })).get(contract.id) ?? [];
    const byId = new Map(items.map((item) => [item.id, item]));
    const byName = new Map(items.map((item) => [itemNameKey(item.name), item]));
    const unknown = lines
      .filter((line) => line.itemId !== undefined && !byId.has(line.itemId))
      .map((line) => line.itemId);
    if (unknown.length > 0) {
      throw notAllowed('ITEM_NOT_IN_CONTRACT', 'Some items are not stored on this shelf', {
        itemIds: unknown,
      });
    }
    // A typed name that matches an existing item becomes that item, so the receipt tops it up.
    const targets = lines.map((line) =>
      line.itemId ? byId.get(line.itemId) : byName.get(itemNameKey(line.name ?? '')),
    );
    assertUnits(lines, targets, (items) =>
      notAllowed('UNIT_MISMATCH', 'A line is not in the unit its item is counted in', { items }),
    );
    const stored: DropOffRequestLine[] = lines.map((line, index) => {
      const item = targets[index];
      return {
        itemId: item?.id ?? null,
        name: item?.name ?? (line.name as string),
        quantity: line.quantity,
        unit: item?.unit ?? (line.unit as ShelfItemUnit),
      };
    });
    const ids = stored.map((line) => line.itemId).filter((id): id is string => id !== null);
    if (new Set(ids).size !== ids.length) {
      throw fieldValidationError('lines', 'duplicateLine', 'Món này đã có ở dòng trước');
    }

    const { identifiers } = await em.insert(DropOffRequest, {
      contractId: contract.id,
      customerId: actor.id,
      requestedFor,
      note: note?.trim() || null,
      lines: stored,
    });
    await assignShelfRequestSafely(em, 'DROP_OFF', identifiers[0].id, this.notifications);
    const [view] = await loadDropOffRequests(em, { ids: [identifiers[0].id], order: 'newest' });
    await notifyDropOffCreated(em, this.notifications, view, contract.facility.id);
    return view;
  }

  async cancel(id: string, actor: AuthUser): Promise<DropOffRequestView> {
    return this.dataSource.transaction(async (em) => {
      const [view] = await loadDropOffRequests(em, { ids: [id], order: 'newest' });
      if (!view || view.customer.id !== actor.id) notFound('Drop-off request', id);
      const [contract] = await findShelfContracts(em, {
        contractId: view.contractId,
        lock: true,
      });
      const status = await lockDropOffStatus(em, id);
      if (!OPEN_STATUSES.includes(status)) {
        throw notAllowed('NOT_OPEN', 'This request is no longer open', { status });
      }
      await em.update(
        DropOffRequest,
        { id },
        {
          status: DropOffRequestStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: actor.id,
        },
      );
      const [updated] = await loadDropOffRequests(em, { ids: [id], order: 'newest' });
      if (contract) {
        await notifyDropOffCancelled(em, this.notifications, updated, contract.facility.id);
      }
      return updated;
    });
  }
}
