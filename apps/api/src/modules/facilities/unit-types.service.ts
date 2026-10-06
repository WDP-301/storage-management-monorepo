import { UnitType } from '@entities/unit-type.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { IsNull, Repository } from 'typeorm';
import { CreateUnitTypeDto, UpdateUnitTypeDto } from './dto/unit-type.dto';

function handleDbError(err: unknown): never {
  if (isUniqueViolation(err)) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Unit type code already exists',
      HttpStatus.CONFLICT,
    );
  }
  throw err;
}

@Injectable()
export class UnitTypesService {
  constructor(
    @InjectRepository(UnitType)
    private readonly unitTypeRepo: Repository<UnitType>,
  ) {}

  findAll() {
    return this.unitTypeRepo.find({
      where: { deletedAt: IsNull() },
      order: { monthlyPrice: 'ASC' },
    });
  }

  async findById(id: string): Promise<UnitType> {
    const unitType = await this.unitTypeRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!unitType) notFound('UnitType', id);

    return unitType;
  }

  async create(dto: CreateUnitTypeDto): Promise<UnitType> {
    const unitType = this.unitTypeRepo.create(dto);
    try {
      return await this.unitTypeRepo.save(unitType);
    } catch (err) {
      handleDbError(err);
    }
  }

  async update(id: string, dto: UpdateUnitTypeDto): Promise<UnitType> {
    await this.findById(id);
    try {
      await this.unitTypeRepo.update(id, dto);
    } catch (err) {
      handleDbError(err);
    }
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.unitTypeRepo.softDelete(id);
  }
}
