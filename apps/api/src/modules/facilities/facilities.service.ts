import { Facility } from '@entities/facility.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds, isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { escapeLikePattern } from '@shared/utils/like-pattern.util';
import { UserRole, UserStatus } from '@storage/types';
import { In, IsNull, Repository } from 'typeorm';
import { AdminFacilitiesQueryDto } from './dto/facility.dto';

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

  /** Back-office listing: every status, searchable by code or name. */
  async findForAdmin(query: AdminFacilitiesQueryDto) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.facilityRepo.createQueryBuilder('facility');

    if (status) {
      qb.andWhere('facility.status = :status', { status });
    }
    const term = query.search?.trim();
    if (term) {
      qb.andWhere('(facility.code ILIKE :search OR facility.name ILIKE :search)', {
        search: `%${escapeLikePattern(term)}%`,
      });
    }

    const [facilities, total] = await qb
      .orderBy('facility.createdAt', 'DESC')
      .addOrderBy('facility.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { facilities, meta: buildPaginationMeta(page, limit, total) };
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
}
