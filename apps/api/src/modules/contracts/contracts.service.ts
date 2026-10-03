import { randomUUID } from 'node:crypto';
import { AppUser } from '@entities/app-user.entity';
import { Booking } from '@entities/booking.entity';
import { BookingItem } from '@entities/booking-item.entity';
import { Contract } from '@entities/contract.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { BookingStatus, ContractKind, ContractStatus } from '@storage/types';
import Decimal from 'decimal.js';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

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
      if (!item) this.notFound('Booking item', dto.bookingItemId);

      // Keep the booking confirmed until the contract is committed.
      const booking = await manager.findOne(Booking, {
        where: { id: item.bookingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) this.notFound('Booking', item.bookingId);
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
      if (!customer) this.notFound('Customer', booking.customerId);

      const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : item.requestedStartAt;
      const endedAt = dto.endedAt ? new Date(dto.endedAt) : undefined;
      this.validateDates(effectiveAt, endedAt);

      // Each item already stores MONTHLY rent. Its total is monthly rent * rentalMonths;
      // dividing that item total by rentalMonths yields this snapshot, without using
      // the whole booking subtotal (which may include other units and rental terms).
      const monthlyPriceSnapshot = new Decimal(item.monthlyPriceSnapshot).toFixed(2);
      const contract = manager.create(Contract, {
        contractNo: `CT-${randomUUID()}`,
        bookingItemId: item.id,
        customerId: booking.customerId,
        kind: dto.kind ?? ContractKind.INITIAL,
        status: dto.status ?? ContractStatus.DRAFT,
        effectiveAt,
        endedAt,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        months: item.rentalMonths,
        monthlyPriceSnapshot: monthlyPriceSnapshot as unknown as number,
        termsSnapshot: dto.termsSnapshot ?? {},
        customerSnapshot: {
          id: customer.id,
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone ?? null,
        },
      });
      return manager.save(Contract, contract);
    });
  }

  findAll(): Promise<Contract[]> {
    return this.contracts.find({ where: { deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Contract> {
    const contract = await this.contracts.findOne({ where: { id, deletedAt: IsNull() } });
    if (!contract) this.notFound('Contract', id);
    return contract;
  }

  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    const contract = await this.findById(id);
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
      const result = await this.contracts.update({ id, deletedAt: IsNull() }, changes);
      if (!result.affected) this.notFound('Contract', id);
    }
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    const result = await this.contracts.softDelete({ id, deletedAt: IsNull() });
    if (!result.affected) this.notFound('Contract', id);
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

  private notFound(resource: string, id: string): never {
    throw new DomainException(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource} ${id} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}
