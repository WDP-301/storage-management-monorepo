import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StorageUnitStatus } from '@storage/types';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import {
  CreateStorageUnitDto,
  QueryStorageUnitsDto,
  UpdateStorageUnitDto,
} from './dto/storage-unit.dto';
import { StorageUnit } from './entities/storage-unit.entity';

/** Postgres error codes */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

function handleDbError(err: unknown): never {
  if (err instanceof QueryFailedError) {
    const pg = (err as any).driverError as { code?: string; detail?: string };
    if (pg?.code === PG_UNIQUE_VIOLATION) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Unit code already exists in this facility',
        HttpStatus.CONFLICT,
      );
    }
    if (pg?.code === PG_FK_VIOLATION) {
      throw new DomainException(
        ErrorCode.BAD_REQUEST,
        'facilityId or unitTypeId does not exist',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (pg?.code === PG_CHECK_VIOLATION) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'posX and posY must both be provided or both be omitted',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  throw err;
}

@Injectable()
export class StorageUnitsService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly storageUnitRepo: Repository<StorageUnit>,
  ) {}

  async findAll(query: QueryStorageUnitsDto) {
    const { facilityId, unitTypeId, page = 1, limit = 20 } = query;

    const qb = this.storageUnitRepo
      .createQueryBuilder('unit')
      .leftJoinAndSelect('unit.unitType', 'unitType')
      .leftJoinAndSelect('unit.facility', 'facility')
      .where('unit.deletedAt IS NULL');

    if (facilityId) {
      qb.andWhere('unit.facilityId = :facilityId', { facilityId });
    }

    if (unitTypeId) {
      qb.andWhere('unit.unitTypeId = :unitTypeId', { unitTypeId });
    }

    // #5: Public endpoint always forces AVAILABLE — prevents data leak of RENTED/internal statuses
    qb.andWhere('unit.status = :status', { status: StorageUnitStatus.AVAILABLE });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('unit.code', 'ASC')
      .getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<StorageUnit> {
    const unit = await this.storageUnitRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['unitType', 'facility'],
    });

    if (!unit) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `StorageUnit ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return unit;
  }

  async create(dto: CreateStorageUnitDto): Promise<StorageUnit> {
    const unit = this.storageUnitRepo.create(dto);
    try {
      return await this.storageUnitRepo.save(unit);
    } catch (err) {
      handleDbError(err);
    }
  }

  async update(id: string, dto: UpdateStorageUnitDto): Promise<StorageUnit> {
    await this.findById(id);
    try {
      await this.storageUnitRepo.update(id, dto);
    } catch (err) {
      handleDbError(err);
    }
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.storageUnitRepo.softDelete(id);
  }
}
