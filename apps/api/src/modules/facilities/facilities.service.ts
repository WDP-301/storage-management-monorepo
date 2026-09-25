import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { IsNull, Repository } from 'typeorm';
import { CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';
import { Facility } from './entities/facility.entity';

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

    if (!facility) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Facility ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return facility;
  }

  async create(dto: CreateFacilityDto): Promise<Facility> {
    const facility = this.facilityRepo.create(dto);
    return this.facilityRepo.save(facility);
  }

  async update(id: string, dto: UpdateFacilityDto): Promise<Facility> {
    await this.findById(id);
    await this.facilityRepo.update(id, dto);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.facilityRepo.softDelete(id);
  }
}
