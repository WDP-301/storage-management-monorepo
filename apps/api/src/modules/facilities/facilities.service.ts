import { Facility } from '@entities/facility.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { UserRole } from '@storage/types';
import { In, IsNull, Repository } from 'typeorm';
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
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
  ) {}

  findAll() {
    return this.facilityRepo.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Facilities the user can act on: any active facility-scoped assignment
   * (FACILITY_MANAGER / FACILITY_STAFF), one row per facility, so a manager of
   * several facilities gets all of them.
   */
  async findAssigned(userId: string): Promise<Facility[]> {
    const assignments = await this.roleAssignments.find({
      where: {
        userId,
        role: In([UserRole.FACILITY_MANAGER, UserRole.FACILITY_STAFF]),
      },
    });

    const facilityIds = activeFacilityIds(assignments);

    if (facilityIds.length === 0) {
      return [];
    }

    return this.facilityRepo.find({
      where: { id: In(facilityIds), deletedAt: IsNull() },
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
