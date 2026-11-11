import { PickupRequest } from '@entities/pickup-request.entity';
import { findOverdueInvoiceNos } from '@modules/access/overdue-invoices.query';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { addVietnamDays, fromVietnamDate, vietnamToday } from '@shared/utils/calendar.util';
import { PickupRequestStatus, type PickupRequestView } from '@storage/types';
import { DataSource, type EntityManager, QueryFailedError } from 'typeorm';
import { loadPickupRequests } from '../shelf-storage/pickup-request.read';
import { findShelfContracts, loadStock } from '../shelf-storage/shelf-contract.query';
import { PICKUP_REQUEST_MAX_DAYS_AHEAD, pickupRequestBlock } from '../shelf-storage/shelf-rules';
import type { CreatePickupRequestDto } from './dto/pickup-request.dto';
import { notifyFacilityStaff, notifyRequestCancelled } from './pickup-notifications';

const PAST_GRACE_MS = 5 * 60 * 1000;
/** The first instant no request may reach: the whole last allowed Vietnam day is open. */
const lastDayEnd = (now: Date) =>
  fromVietnamDate(addVietnamDays(vietnamToday(now), PICKUP_REQUEST_MAX_DAYS_AHEAD + 1));
const CONTRACT_LIST_LIMIT = 20;
const UNIQUE_VIOLATION = '23505';

export function notAllowed(
  reason: string,
  message: string,
  extra: Record<string, unknown> = {},
): DomainException {
  return new DomainException(ErrorCode.PICKUP_REQUEST_NOT_ALLOWED, message, HttpStatus.CONFLICT, {
    reason,
    ...extra,
  });
}

/** Locks the request row after the contract and returns its status, or 404 if it vanished. */
export async function lockRequestStatus(
  em: EntityManager,
  id: string,
): Promise<PickupRequestStatus> {
  const rows: { status: PickupRequestStatus }[] = await em.query(
    `SELECT "status" FROM "pickup_requests" WHERE "id" = $1 FOR UPDATE`,
    [id],
  );
  if (rows.length === 0) notFound('Pick-up request', id);
  return rows[0].status;
}

/** Customer side of pick-up requests. Foreign contracts and requests answer 404. */
@Injectable()
export class PickupRequestsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async listForContract(contractId: string, actor: AuthUser): Promise<PickupRequestView[]> {
    const em = this.dataSource.manager;
    const [contract] = await findShelfContracts(em, { contractId, customerId: actor.id });
    if (!contract) notFound('Contract', contractId);
    return loadPickupRequests(em, {
      contractIds: [contractId],
      order: 'newest',
      limit: CONTRACT_LIST_LIMIT,
    });
  }

  async create(
    contractId: string,
    dto: CreatePickupRequestDto,
    actor: AuthUser,
  ): Promise<PickupRequestView> {
    const requestedFor = new Date(dto.requestedFor);
    const now = new Date();
    if (
      requestedFor.getTime() < now.getTime() - PAST_GRACE_MS ||
      requestedFor.getTime() >= lastDayEnd(now).getTime()
    ) {
      throw fieldValidationError(
        'requestedFor',
        'outOfRange',
        `requestedFor must be within the next ${PICKUP_REQUEST_MAX_DAYS_AHEAD} days`,
      );
    }
    const seen = new Set<string>();
    dto.lines.forEach((line, index) => {
      if (seen.has(line.itemId)) {
        throw fieldValidationError(`lines[${index}]`, 'duplicateLine', 'Each item may appear once');
      }
      seen.add(line.itemId);
    });

    try {
      return await this.dataSource.transaction((em) =>
        this.createIn(em, contractId, dto, actor, requestedFor, now),
      );
    } catch (error) {
      // The partial unique index is the backstop for two requests racing past the lock.
      if (error instanceof QueryFailedError && error.driverError?.code === UNIQUE_VIOLATION) {
        throw notAllowed(
          'OPEN_REQUEST_EXISTS',
          'This contract already has an open pick-up request',
        );
      }
      throw error;
    }
  }

  private async createIn(
    em: EntityManager,
    contractId: string,
    dto: CreatePickupRequestDto,
    actor: AuthUser,
    requestedFor: Date,
    now: Date,
  ): Promise<PickupRequestView> {
    const [contract] = await findShelfContracts(em, { contractId, lock: true });
    if (!contract || contract.customerId !== actor.id) notFound('Contract', contractId);
    const items = (await loadStock(em, [contract.id])).get(contract.id) ?? [];
    const [open] = await loadPickupRequests(em, {
      contractIds: [contract.id],
      open: true,
      order: 'newest',
      limit: 1,
    });
    const invoiceNos = await findOverdueInvoiceNos(em, actor.id, now);
    const block = pickupRequestBlock({
      status: contract.status,
      stockTotal: items.reduce((sum, item) => sum + item.quantity, 0),
      hasOpenRequest: Boolean(open),
      overdue: invoiceNos.length > 0,
      returnOpen: contract.returnOpen,
    });
    if (block === 'INVOICE_OVERDUE') {
      throw new DomainException(
        ErrorCode.INVOICE_OVERDUE,
        'Settle the overdue invoices before requesting a pick-up',
        HttpStatus.CONFLICT,
        { invoiceNos },
      );
    }
    if (block) {
      throw notAllowed(block, 'A pick-up request cannot be made for this contract', {
        ...(open ? { requestId: open.id } : {}),
      });
    }

    const stock = new Map(items.map((item) => [item.id, item]));
    const unknown = dto.lines.filter((line) => !stock.has(line.itemId)).map((l) => l.itemId);
    if (unknown.length > 0) {
      throw notAllowed('ITEM_NOT_IN_CONTRACT', 'Some items are not stored on this shelf', {
        itemIds: unknown,
      });
    }
    const short = dto.lines
      .filter((line) => line.quantity > (stock.get(line.itemId)?.quantity ?? 0))
      .map((line) => ({
        itemId: line.itemId,
        name: stock.get(line.itemId)?.name,
        requested: line.quantity,
        available: stock.get(line.itemId)?.quantity ?? 0,
      }));
    if (short.length > 0) {
      throw notAllowed('QUANTITY_EXCEEDS_STOCK', 'More requested than is on the shelf', {
        items: short,
      });
    }

    const { identifiers } = await em.insert(PickupRequest, {
      contractId: contract.id,
      customerId: actor.id,
      requestedFor,
      note: dto.note?.trim() || null,
      lines: dto.lines.map((line) => ({
        itemId: line.itemId,
        name: stock.get(line.itemId)?.name ?? '',
        quantity: line.quantity,
      })),
    });
    const [view] = await loadPickupRequests(em, { ids: [identifiers[0].id], order: 'newest' });
    await notifyFacilityStaff(em, this.notifications, view, contract.facility.id);
    return view;
  }

  async cancel(id: string, actor: AuthUser): Promise<PickupRequestView> {
    return this.dataSource.transaction(async (em) => {
      const [view] = await loadPickupRequests(em, { ids: [id], order: 'newest' });
      if (!view || view.customer.id !== actor.id) notFound('Pick-up request', id);
      const [contract] = await findShelfContracts(em, {
        contractId: view.contractId,
        lock: true,
      });
      const status = await lockRequestStatus(em, id);
      if (status !== PickupRequestStatus.PENDING && status !== PickupRequestStatus.READY) {
        throw notAllowed('NOT_OPEN', 'This request is no longer open', { status });
      }
      await em.update(
        PickupRequest,
        { id },
        {
          status: PickupRequestStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: actor.id,
        },
      );
      const [updated] = await loadPickupRequests(em, { ids: [id], order: 'newest' });
      if (contract) {
        await notifyRequestCancelled(em, this.notifications, updated, contract.facility.id);
      }
      return updated;
    });
  }
}
