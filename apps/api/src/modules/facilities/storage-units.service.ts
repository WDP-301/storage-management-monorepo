import { StorageUnit } from '@entities/storage-unit.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { buildPaginationMeta, ErrorCode } from '@shared/models/api-response';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '@shared/utils/pg-error.util';
import { StorageUnitStatus, UserRole } from '@storage/types';
import { In, IsNull, Repository } from 'typeorm';
import {
  CreateStorageUnitDto,
  ManagedUnitsQueryDto,
  QueryStorageUnitsDto,
  UpdateStorageUnitDto,
  UpdateUnitStatusDto,
} from './dto/storage-unit.dto';

/** Postgres error codes */
const PG_FK_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

function handleDbError(err: unknown): never {
  const code = pgErrorCode(err);
  if (code === PG_UNIQUE_VIOLATION) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'Unit code already exists in this facility',
      HttpStatus.CONFLICT,
    );
  }
  if (code === PG_FK_VIOLATION) {
    throw new DomainException(
      ErrorCode.BAD_REQUEST,
      'facilityId or unitTypeId does not exist',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (code === PG_CHECK_VIOLATION) {
    throw new DomainException(
      ErrorCode.VALIDATION_FAILED,
      'posX and posY must both be provided or both be omitted',
      HttpStatus.BAD_REQUEST,
    );
  }
  throw err;
}

@Injectable()
export class StorageUnitsService {
  constructor(
    @InjectRepository(StorageUnit)
    private readonly storageUnitRepo: Repository<StorageUnit>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
  ) {}

  async findAll(query: QueryStorageUnitsDto) {
    const { facilityId, unitTypeId, page = 1, limit = 20 } = query;

    const qb = this.storageUnitRepo
      .createQueryBuilder('unit')
      .leftJoinAndSelect('unit.unitType', 'unitType')
      .leftJoinAndSelect('unit.facility', 'facility')
      .where('unit.deletedAt IS NULL');

    if (facilityId) {
      qb.andWhere('unit.facilityId = :facilityId', { facilityId });
    }

    if (unitTypeId) {
      qb.andWhere('unit.unitTypeId = :unitTypeId', { unitTypeId });
    }

    // #5: Public endpoint always forces AVAILABLE — prevents data leak of RENTED/internal statuses
    qb.andWhere('unit.status = :status', { status: StorageUnitStatus.AVAILABLE });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('unit.code', 'ASC')
      .getManyAndCount();

    return {
      units: data, // named key to avoid double-nesting after HttpResponseInterceptor wraps in { data: ... }
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Unit inventory for staff/managers of a facility — unlike the public findAll,
   * every status is visible. Facility-scoped roles must hold an active
   * assignment on the requested facility; ADMIN / OPERATIONS_MANAGER see any.
   */
  async findManaged(query: ManagedUnitsQueryDto, actor: AuthUser) {
    await this.assertFacilityAccess(actor, query.facilityId, [
      UserRole.FACILITY_MANAGER,
      UserRole.FACILITY_STAFF,
    ]);

    const { facilityId, status, page = 1, limit = 100 } = query;

    const qb = this.storageUnitRepo
      .createQueryBuilder('unit')
      .leftJoinAndSelect('unit.unitType', 'unitType')
      .where('unit.deletedAt IS NULL')
      .andWhere('unit.facilityId = :facilityId', { facilityId });

    if (status) {
      qb.andWhere('unit.status = :status', { status });
    }

    const [data, total] = await qb
      .orderBy('unit.code', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { units: data, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Operational toggle for facility staff: AVAILABLE <-> MAINTENANCE only.
   * Units in business states (HELD/BOOKED/RENTED/...) cannot be touched here.
   */
  async updateStatus(id: string, dto: UpdateUnitStatusDto, actor: AuthUser): Promise<StorageUnit> {
    const unit = await this.findById(id);
    await this.assertFacilityAccess(actor, unit.facilityId, [UserRole.FACILITY_MANAGER]);

    const TOGGLEABLE: StorageUnitStatus[] = [
      StorageUnitStatus.AVAILABLE,
      StorageUnitStatus.MAINTENANCE,
    ];
    if (!TOGGLEABLE.includes(dto.status)) {
      throw new DomainException(
        ErrorCode.VALIDATION_FAILED,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        {
          fields: [
            {
              field: 'status',
              code: 'notAllowed',
              message: 'status can only be AVAILABLE or MAINTENANCE',
            },
          ],
        },
      );
    }
    if (!TOGGLEABLE.includes(unit.status)) {
      throw new DomainException(
        ErrorCode.CONFLICT,
        `Cannot change status of a ${unit.status} unit`,
        HttpStatus.CONFLICT,
      );
    }

    unit.status = dto.status;
    await this.storageUnitRepo.save(unit);
    return this.findById(id);
  }

  /** Global roles pass; facility-scoped roles need an active assignment for the facility. */
  private async assertFacilityAccess(
    actor: AuthUser,
    facilityId: string,
    allowedRoles: UserRole[],
  ): Promise<void> {
    if (actor.roles.includes(UserRole.ADMIN) || actor.roles.includes(UserRole.OPERATIONS_MANAGER)) {
      return;
    }

    const assignments = await this.roleAssignments.find({
      where: { userId: actor.id, facilityId, role: In(allowedRoles) },
    });

    if (!assignments.some((assignment) => isAssignmentActive(assignment))) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You are not assigned to this facility',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async findById(id: string): Promise<StorageUnit> {
    const unit = await this.storageUnitRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['unitType', 'facility'],
    });

    if (!unit) notFound('StorageUnit', id);

    return unit;
  }

  async create(dto: CreateStorageUnitDto): Promise<StorageUnit> {
    const unit = this.storageUnitRepo.create(dto);
    try {
      return await this.storageUnitRepo.save(unit);
    } catch (err) {
      handleDbError(err);
    }
  }

  async update(id: string, dto: UpdateStorageUnitDto): Promise<StorageUnit> {
    await this.findById(id);
    try {
      await this.storageUnitRepo.update(id, dto);
    } catch (err) {
      handleDbError(err);
    }
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    const unit = await this.findById(id);

    const BLOCKED_STATUSES: StorageUnitStatus[] = [
      StorageUnitStatus.HELD,
      StorageUnitStatus.BOOKED,
      StorageUnitStatus.RENTED,
    ];

    if (BLOCKED_STATUSES.includes(unit.status)) {
      throw new DomainException(
        ErrorCode.BAD_REQUEST,
        `Cannot delete storage unit with status '${unit.status}'. Unit must be AVAILABLE, MAINTENANCE, or INACTIVE.`,
        HttpStatus.CONFLICT,
      );
    }

    await this.storageUnitRepo.softDelete(id);
  }
}
