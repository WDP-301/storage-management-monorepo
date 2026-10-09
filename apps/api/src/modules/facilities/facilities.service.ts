import { Facility } from '@entities/facility.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds, isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { UserRole, UserStatus } from '@storage/types';
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

export interface FacilityStaffMember {
  id: string;
  fullName: string;
  phone: string | null;
}

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepo: Repository<Facility>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
  ) {}

  /**
   * Active FACILITY_STAFF of a facility — the people a manager can assign inspections to.
   * FACILITY_MANAGER may only list facilities they manage; ADMIN/OPERATIONS_MANAGER any.
   */
  async findStaff(facilityId: string, actor: AuthUser): Promise<FacilityStaffMember[]> {
    const global =
      actor.roles.includes(UserRole.ADMIN) || actor.roles.includes(UserRole.OPERATIONS_MANAGER);
    if (!global) {
      const managed = activeFacilityIds(
        await this.roleAssignments.find({
          where: { userId: actor.id, role: UserRole.FACILITY_MANAGER },
        }),
      );
      if (!managed.includes(facilityId)) {
        throw new DomainException(
          ErrorCode.FORBIDDEN,
          'You do not manage this facility',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    const assignments = await this.roleAssignments.find({
      where: { facilityId, role: UserRole.FACILITY_STAFF, user: { status: UserStatus.ACTIVE } },
      relations: { user: true },
    });
    const staff = new Map<string, FacilityStaffMember>();
    for (const assignment of assignments) {
      if (!isAssignmentActive(assignment) || !assignment.user) continue;
      const { id, fullName, phone } = assignment.user;
      staff.set(id, { id, fullName, phone: phone ?? null });
    }
    return [...staff.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  }

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
