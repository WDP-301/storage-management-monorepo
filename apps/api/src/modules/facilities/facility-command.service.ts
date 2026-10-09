import { Facility } from '@entities/facility.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { PG_FK_VIOLATION, PG_UNIQUE_VIOLATION, pgErrorCode } from '@shared/utils/pg-error.util';
import { Repository } from 'typeorm';
import type { CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';

/** Write side of facilities (branches). There is no delete: a branch is deactivated instead. */
@Injectable()
export class FacilityCommandService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilities: Repository<Facility>,
  ) {}

  async create(dto: CreateFacilityDto): Promise<Facility> {
    try {
      return await this.facilities.save(
        this.facilities.create({
          code: dto.code,
          name: dto.name,
          provinceCode: dto.provinceCode,
        }),
      );
    } catch (err) {
      handleDbError(err);
    }
  }

  /** Row-locked so a concurrent warehouse write sees either the old or the new facility state. */
  async update(id: string, dto: UpdateFacilityDto): Promise<Facility> {
    if (dto.code === null || dto.name === null || dto.status === null) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'code, name and status cannot be null',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.facilities.manager.transaction(async (manager) => {
      const facility = await manager.findOne(Facility, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!facility) notFound('Facility', id);
      Object.assign(facility, {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.provinceCode !== undefined && { provinceCode: dto.provinceCode }),
      });
      try {
        return await manager.save(facility);
      } catch (err) {
        handleDbError(err);
      }
    });
  }
}

function handleDbError(err: unknown): never {
  const code = pgErrorCode(err);
  if (code === PG_UNIQUE_VIOLATION) {
    throw new DomainException(
      ErrorCode.CONFLICT,
      'Facility code already exists',
      HttpStatus.CONFLICT,
    );
  }
  if (code === PG_FK_VIOLATION) {
    throw new DomainException(
      ErrorCode.BAD_REQUEST,
      'provinceCode does not exist',
      HttpStatus.BAD_REQUEST,
    );
  }
  throw err;
}
