import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { CreateUnitTypeDto, UpdateUnitTypeDto } from './dto/unit-type.dto';
import { UnitType } from './entities/unit-type.entity';

const PG_UNIQUE_VIOLATION = '23505';

function handleDbError(err: unknown): never {
  if (err instanceof QueryFailedError) {
    const pg = (err as any).driverError as { code?: string };
    if (pg?.code === PG_UNIQUE_VIOLATION) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Unit type code already exists',
        HttpStatus.CONFLICT,
      );
    }
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

    if (!unitType) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `UnitType ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

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
