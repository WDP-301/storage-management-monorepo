import { Amenity } from '@entities/amenity.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { Repository } from 'typeorm';
import type { CreateAmenityDto, UpdateAmenityDto } from './dto/amenity.dto';

/** Admin-managed amenity catalog. Amenities are retired, never deleted. */
@Injectable()
export class AmenitiesService {
  constructor(
    @InjectRepository(Amenity)
    private readonly amenities: Repository<Amenity>,
  ) {}

  /** What pickers and filters offer: retired amenities are left out. */
  listActive(): Promise<Amenity[]> {
    return this.amenities.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /** Admin view: active ones first, then the retired. */
  listAll(): Promise<Amenity[]> {
    return this.amenities.find({
      order: { isActive: 'DESC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(dto: CreateAmenityDto): Promise<Amenity> {
    try {
      return await this.amenities.save(
        this.amenities.create({
          code: dto.code,
          name: dto.name.trim(),
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? 0,
        }),
      );
    } catch (err) {
      // The unique index is the arbiter, so two concurrent creates cannot both pass a pre-check.
      if (isUniqueViolation(err)) {
        throw new DomainException(
          ErrorCode.CONFLICT,
          `Amenity code ${dto.code} already exists`,
          HttpStatus.CONFLICT,
          { fields: ['code'] },
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateAmenityDto): Promise<Amenity> {
    const amenity = await this.amenities.findOne({ where: { id } });
    if (!amenity) return notFound('Amenity', id);
    if (dto.name !== undefined) amenity.name = dto.name.trim();
    if (dto.description !== undefined) amenity.description = dto.description;
    if (dto.sortOrder !== undefined) amenity.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) amenity.isActive = dto.isActive;
    return this.amenities.save(amenity);
  }
}
