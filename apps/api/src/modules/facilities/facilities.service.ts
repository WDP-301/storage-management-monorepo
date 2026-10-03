import { Facility } from '@entities/facility.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { IsNull, Repository } from 'typeorm';
import { CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';

function handleDbError(err: unknown): never {
  if (isUniqueViolation(err)) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Facility code already exists',
      HttpStatus.CONFLICT,
    );
  }
  throw err;
}

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepo: Repository<Facility>,
  ) {}

  findAll() {
    return this.facilityRepo.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Facility> {
    const facility = await this.facilityRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!facility) notFound('Facility', id);

    return facility;
  }

  async create(dto: CreateFacilityDto): Promise<Facility> {
    const facility = this.facilityRepo.create(dto);
    try {
      return await this.facilityRepo.save(facility);
    } catch (err) {
      handleDbError(err);
    }
  }

  async update(id: string, dto: UpdateFacilityDto): Promise<Facility> {
    await this.findById(id);
    try {
      await this.facilityRepo.update(id, dto);
    } catch (err) {
      handleDbError(err);
    }
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.facilityRepo.softDelete(id);
  }
}
