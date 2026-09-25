import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StorageUnitStatus } from '@storage/types';
import { IsNull, Repository } from 'typeorm';
import {
  CreateStorageUnitDto,
  QueryStorageUnitsDto,
  UpdateStorageUnitDto,
} from './dto/storage-unit.dto';
import { StorageUnit } from './entities/storage-unit.entity';

@Injectable()
export class StorageUnitsService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly storageUnitRepo: Repository<StorageUnit>,
  ) {}

  async findAll(query: QueryStorageUnitsDto) {
    const { facilityId, unitTypeId, status, page = 1, limit = 20 } = query;

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

    // Default to AVAILABLE for public browsing
    qb.andWhere('unit.status = :status', {
      status: status ?? StorageUnitStatus.AVAILABLE,
    });

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
    return this.storageUnitRepo.save(unit);
  }

  async update(id: string, dto: UpdateStorageUnitDto): Promise<StorageUnit> {
    await this.findById(id);
    await this.storageUnitRepo.update(id, dto);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.storageUnitRepo.softDelete(id);
  }
}
