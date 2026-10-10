import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { BookingStatus, ContractStatus, InspectionType } from '@storage/types';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { loadContractInspections } from './contract-inspections.util';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { UploadContractEvidenceDto } from './dto/upload-contract-evidence.dto';
import { persistContract } from './initial-contract.util';
import { type CustomerContractRecord, toCustomerContractRecord } from './types/customer-contract';

const CONTRACT_CREATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract) private readonly contracts: Repository<Contract>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateContractDto): Promise<Contract> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(BookingItem, {
        where: { id: dto.bookingItemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) notFound('Booking item', dto.bookingItemId);

      // Keep the booking confirmed until the contract is committed.
      const booking = await manager.findOne(Booking, {
        where: { id: item.bookingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) notFound('Booking', item.bookingId);
      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new DomainException(
          ErrorCode.BOOKING_NOT_CONFIRMED,
          'Only confirmed bookings can be used to create a contract',
          HttpStatus.CONFLICT,
          {
            bookingId: booking.id,
            status: booking.status,
            requiredStatus: BookingStatus.CONFIRMED,
          },
        );
      }

      const expiresAt = new Date(item.createdAt.getTime() + CONTRACT_CREATION_WINDOW_MS);
      if (Date.now() >= expiresAt.getTime()) {
        throw new DomainException(
          ErrorCode.BOOKING_ITEM_CONTRACT_WINDOW_EXPIRED,
          'The 7-day contract creation window for this booking item has expired',
          HttpStatus.CONFLICT,
          {
            bookingItemId: item.id,
            createdAt: item.createdAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        );
      }

      const customer = await manager.findOne(AppUser, { where: { id: booking.customerId } });
      if (!customer) notFound('Customer', booking.customerId);

      const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : item.requestedStartAt;
      const endedAt = dto.endedAt ? new Date(dto.endedAt) : undefined;
      this.validateDates(effectiveAt, endedAt);

      return persistContract(manager, {
        item,
        customer,
        kind: dto.kind,
        effectiveAt,
        endedAt,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        termsSnapshot: dto.termsSnapshot,
        evidence: dto.evidence,
      });
    });
  }

  async findMine(customerId: string): Promise<CustomerContractRecord[]> {
    const contracts = await this.contracts.find({
      where: { customerId, deletedAt: IsNull() },
      relations: { bookingItem: { storageUnit: { facility: true } } },
      order: { effectiveAt: 'DESC' },
    });
    if (contracts.length === 0) return [];
    const byContract = await loadContractInspections(
      this.dataSource,
      contracts.map((c) => c.id),
    );
    return contracts.map((c) => toCustomerContractRecord(c, byContract.get(c.id)));
  }

  async findById(id: string): Promise<Contract> {
    const contract = await this.contracts.findOne({ where: { id, deletedAt: IsNull() } });
    if (!contract) notFound('Contract', id);
    return contract;
  }

  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    // Row lock: a handover finalize stamping signedAt must commit before this read,
    // or the sealed-field check would pass against a stale unsigned copy.
    return this.dataSource.transaction(async (em) => {
      const contract = await em.findOne(Contract, {
        where: { id, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) notFound('Contract', id);

      // signedAt seals the commercial terms — only lifecycle fields (status, endedAt)
      // may change afterwards. There is no SIGNED status; the timestamp is the marker.
      if (contract.signedAt) {
        const sealed = (
          [
            'kind',
            'signedAt',
            'effectiveAt',
            'termsSnapshot',
            'months',
            'monthlyPriceSnapshot',
          ] as const
        ).filter((field) => dto[field] !== undefined);
        if (sealed.length > 0) {
          throw new DomainException(
            ErrorCode.CONFLICT,
            `Contract is signed — these fields can no longer change: ${sealed.join(', ')}`,
            HttpStatus.CONFLICT,
            { contractId: id, sealedFields: sealed },
          );
        }
      }

      const { effectiveAt, signedAt, endedAt, ...fields } = dto;
      const dates = {
        ...(effectiveAt !== undefined ? { effectiveAt: new Date(effectiveAt) } : {}),
        ...(signedAt !== undefined ? { signedAt: new Date(signedAt) } : {}),
        ...(endedAt !== undefined ? { endedAt: new Date(endedAt) } : {}),
      };
      this.validateDates(
        dates.effectiveAt ?? contract.effectiveAt,
        dates.endedAt ?? contract.endedAt,
      );
      const changes = { ...fields, ...dates };
      if (Object.keys(changes).length > 0) {
        await em.update(Contract, { id, deletedAt: IsNull() }, changes);
      }
      // The handover appointment is booked on the effective date; keep an open one in step.
      if (dates.effectiveAt) {
        await em.update(
          Inspection,
          { contractId: id, type: InspectionType.PRE_HANDOVER, finalizedAt: IsNull() },
          { scheduledAt: dates.effectiveAt },
        );
      }
      return em.findOneOrFail(Contract, { where: { id } });
    });
  }

  /**
   * Only contracts that no longer hold a unit may go: deleting a DRAFT/ACTIVE one
   * strands the unit (BOOKED/RENTED) and its open inspections can never finalize —
   * TypeORM excludes soft-deleted rows, so finalize would 404 on the contract.
   */
  async softDelete(id: string): Promise<void> {
    const result = await this.contracts.softDelete({
      id,
      status: In([ContractStatus.ENDED, ContractStatus.CANCELLED]),
      deletedAt: IsNull(),
    });
    if (result.affected) return;
    const contract = await this.contracts.findOne({ where: { id, deletedAt: IsNull() } });
    if (!contract) notFound('Contract', id);
    throw new DomainException(
      ErrorCode.CONFLICT,
      `Cannot delete a ${contract.status} contract — finalize its inspections first`,
      HttpStatus.CONFLICT,
      { contractId: id, status: contract.status },
    );
  }

  /**
   * Sets the contract evidence URL (single link, replaces the previous one).
   * The file itself is uploaded by the client beforehand via
   * POST /uploads/presigned-url + PUT to R2 — this endpoint only stores the link.
   * Allowed even after `signedAt` (evidence is not a sealed commercial term).
   */
  async uploadEvidence(id: string, dto: UploadContractEvidenceDto): Promise<Contract> {
    await this.findById(id);
    const result = await this.contracts.update(
      { id, deletedAt: IsNull() },
      { evidence: dto.evidenceUrl },
    );
    if (!result.affected) notFound('Contract', id);
    return this.findById(id);
  }

  private validateDates(effectiveAt: Date, endedAt?: Date): void {
    if (endedAt && endedAt <= effectiveAt) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'endedAt must be after effectiveAt',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
