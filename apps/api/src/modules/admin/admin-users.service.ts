import { Facility } from '@modules/facilities/entities/facility.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { UserRoleAssignment } from '@modules/users/entities/user-role-assignment.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole, UserStatus } from '@storage/types';
import { In, IsNull, Repository } from 'typeorm';
import { AssignRoleDto } from './dto/assign-role.dto';
import { DEFAULT_PAGE_SIZE, ListUsersQueryDto } from './dto/list-users-query.dto';
import type {
  AdminUser,
  AdminUserListResponse,
  AdminUserResponse,
  RevokeRoleResponse,
} from './types/admin-user';

/** Roles that the schema requires to be scoped to a single facility (`CK_ura_role_scope`). */
const FACILITY_SCOPED_ROLES: readonly UserRole[] = [
  UserRole.FACILITY_STAFF,
  UserRole.FACILITY_MANAGER,
];

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    @InjectRepository(Facility)
    private readonly facilities: Repository<Facility>,
  ) {}

  async listUsers(query: ListUsersQueryDto): Promise<AdminUserListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const builder = this.users.createQueryBuilder('user');
    const search = query.search?.trim();

    if (search) {
      builder.andWhere(
        `(lower("user"."email") LIKE :search
          OR lower("user"."full_name") LIKE :search
          OR "user"."phone" LIKE :search)`,
        { search: `%${escapeLikePattern(search.toLowerCase())}%` },
      );
    }

    if (query.status) {
      builder.andWhere('"user"."status" = :status', { status: query.status });
    }

    if (query.role) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM "user_role_assignments" "ura"
          WHERE "ura"."user_id" = "user"."id" AND "ura"."role" = :role)`,
        { role: query.role },
      );
    }

    const [rows, total] = await builder
      .orderBy('"user"."created_at"', 'DESC')
      .addOrderBy('"user"."id"', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const assignments = await this.loadAssignments(rows.map((user) => user.id));

    return {
      users: rows.map((user) => this.toAdminUser(user, assignments.get(user.id) ?? [])),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUser(id: string): Promise<AdminUserResponse> {
    const user = await this.findUserOrFail(id);

    return { user: this.toAdminUser(user, await this.loadAssignmentsFor(id)) };
  }

  async updateStatus(id: string, status: UserStatus): Promise<AdminUserResponse> {
    const user = await this.findUserOrFail(id);
    user.status = status;

    const saved = await this.users.save(user);

    return { user: this.toAdminUser(saved, await this.loadAssignmentsFor(id)) };
  }

  async assignRole(id: string, dto: AssignRoleDto, assignedBy: string): Promise<AdminUserResponse> {
    const user = await this.findUserOrFail(id);
    const facilityId = dto.facilityId ?? null;

    this.assertRoleScope(dto.role, facilityId);

    if (facilityId && !(await this.facilities.findOne({ where: { id: facilityId } }))) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Facility not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        {
          fields: [{ field: 'endsAt', code: 'isAfter', message: 'endsAt must be after startsAt' }],
        },
      );
    }

    const existing = await this.roleAssignments.findOne({
      where: { userId: id, role: dto.role, facilityId: facilityId ?? IsNull() },
    });

    if (existing) {
      throw new DomainException(
        ErrorCode.ROLE_ALREADY_ASSIGNED,
        'Role is already assigned to this user',
        HttpStatus.CONFLICT,
      );
    }

    await this.roleAssignments.save(
      this.roleAssignments.create({
        userId: id,
        role: dto.role,
        facilityId: facilityId ?? undefined,
        assignedBy,
        startsAt,
        endsAt: endsAt ?? undefined,
      }),
    );

    return { user: this.toAdminUser(user, await this.loadAssignmentsFor(id)) };
  }

  /** Idempotent: revoking an unknown assignment still succeeds, matching the logout/delete policy. */
  async revokeRole(id: string, assignmentId: string): Promise<RevokeRoleResponse> {
    await this.findUserOrFail(id);

    await this.roleAssignments.delete({ id: assignmentId, userId: id });

    return { revoked: true };
  }

  private async findUserOrFail(id: string): Promise<AppUser> {
    const user = await this.users.findOne({ where: { id } });

    if (!user) {
      throw new DomainException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  private assertRoleScope(role: UserRole, facilityId: string | null): void {
    const requiresFacility = FACILITY_SCOPED_ROLES.includes(role);

    if (requiresFacility && !facilityId) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        {
          fields: [
            {
              field: 'facilityId',
              code: 'isNotEmpty',
              message: `facilityId is required for ${role}`,
            },
          ],
        },
      );
    }

    if (!requiresFacility && facilityId) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        {
          fields: [
            {
              field: 'facilityId',
              code: 'isNull',
              message: `facilityId must be omitted for ${role}`,
            },
          ],
        },
      );
    }
  }

  private async loadAssignmentsFor(userId: string): Promise<UserRoleAssignment[]> {
    return this.roleAssignments.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  private async loadAssignments(userIds: string[]): Promise<Map<string, UserRoleAssignment[]>> {
    const byUser = new Map<string, UserRoleAssignment[]>();

    if (userIds.length === 0) {
      return byUser;
    }

    const assignments = await this.roleAssignments.find({
      where: { userId: In(userIds) },
      order: { createdAt: 'ASC' },
    });

    for (const assignment of assignments) {
      const list = byUser.get(assignment.userId) ?? [];
      list.push(assignment);
      byUser.set(assignment.userId, list);
    }

    return byUser;
  }

  private toAdminUser(user: AppUser, assignments: UserRoleAssignment[]): AdminUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? null,
      fullName: user.fullName,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      roles: assignments.map((assignment) => ({
        id: assignment.id,
        role: assignment.role,
        facilityId: assignment.facilityId ?? null,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt ?? null,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

/** Neutralises LIKE wildcards so a literal `%` or `_` in a search term is matched as text. */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
