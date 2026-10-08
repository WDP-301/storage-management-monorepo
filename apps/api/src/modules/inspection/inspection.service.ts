import { AppUser } from '@entities/app-user.entity';
import { Inspection } from '@entities/inspection.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { UserRole, UserStatus } from '@storage/types';
import { Repository } from 'typeorm';
import { AssignInspectionDto } from './dto/assign-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { UploadInspectionEvidenceDto } from './dto/upload-inspection-evidence.dto';
import { assertInspectorOrManager, assertNotFinalized } from './inspection-access.util';

@Injectable()
export class InspectionService {
  constructor(
    @InjectRepository(Inspection)
    private readonly inspections: Repository<Inspection>,
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
  ) {}

  /** Unscoped list — the controller restricts it to managers/admin. */
  findAll(): Promise<Inspection[]> {
    return this.inspections.find({
      relations: { contract: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Customer view: every inspection whose contract belongs to the caller.
   * Chain: inspection → contract → customer.
   */
  findMyInspections(actor: AuthUser): Promise<Inspection[]> {
    return this.inspections.find({
      where: { contract: { customerId: actor.id } },
      relations: { contract: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Staff view: every inspection assigned to the caller (`inspected_by = me`). */
  findStaffInspections(actor: AuthUser): Promise<Inspection[]> {
    return this.inspections.find({
      where: { inspectedBy: actor.id },
      relations: { contract: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Returns an inspection when the actor is privileged (ADMIN /
   * OPERATIONS_MANAGER / FACILITY_MANAGER) or belongs to it (contract
   * owner or assigned inspector); anything else is 403.
   * Ownership chain: inspection → contract → customer.
   */
  async findById(id: string, actor: AuthUser): Promise<Inspection> {
    const inspection = await this.inspections.findOne({
      where: { id },
      relations: { contract: true },
    });
    if (!inspection) notFound('Inspection', id);
    if (!this.isPrivileged(actor) && !this.belongsTo(inspection, actor)) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have access to this inspection',
        HttpStatus.FORBIDDEN,
      );
    }
    return inspection;
  }

  /** inspection → contract → customer, or the assigned inspector. */
  private belongsTo(inspection: Inspection, actor: AuthUser): boolean {
    return inspection.contract?.customerId === actor.id || inspection.inspectedBy === actor.id;
  }

  private isPrivileged(actor: AuthUser): boolean {
    return (
      actor.roles.includes(UserRole.ADMIN) ||
      actor.roles.includes(UserRole.OPERATIONS_MANAGER) ||
      actor.roles.includes(UserRole.FACILITY_MANAGER)
    );
  }

  /**
   * Assigns a staff member as the inspector. The assignee must be an ACTIVE
   * user holding an active FACILITY_STAFF role; arbitrary users are rejected.
   */
  async assignStaff(id: string, dto: AssignInspectionDto): Promise<Inspection> {
    const inspection = await this.inspections.findOne({ where: { id } });
    if (!inspection) notFound('Inspection', id);
    assertNotFinalized(inspection);

    const assignee = await this.users.findOne({
      where: { id: dto.inspectedBy, status: UserStatus.ACTIVE },
    });
    if (!assignee) {
      throw fieldValidationError('inspectedBy', 'notFound', 'Staff user does not exist');
    }

    const staffAssignments = await this.roleAssignments.find({
      where: { userId: dto.inspectedBy, role: UserRole.FACILITY_STAFF },
    });
    if (!staffAssignments.some((assignment) => isAssignmentActive(assignment))) {
      throw fieldValidationError(
        'inspectedBy',
        'notStaff',
        'User is not an active facility staff member',
      );
    }

    inspection.inspectedBy = dto.inspectedBy;
    return this.inspections.save(inspection);
  }

  /**
   * Updates inspection fields. Allowed for the assigned inspector
   * (`inspected_by = actor.id`) and for FACILITY_MANAGER /
   * OPERATIONS_MANAGER; any other staff member gets 403. `inspected_by`
   * itself can only change through the assign endpoint, and `finalized_at`
   * only through the finalize endpoint.
   */
  async update(id: string, dto: UpdateInspectionDto, actor: AuthUser): Promise<Inspection> {
    const inspection = await this.inspections.findOne({ where: { id } });
    if (!inspection) notFound('Inspection', id);

    assertInspectorOrManager(
      inspection,
      actor,
      'Only the assigned inspector or a manager can update this inspection',
    );
    assertNotFinalized(inspection);

    if (dto.conditionNotes !== undefined) {
      inspection.conditionNotes = dto.conditionNotes as string | undefined;
    }
    if (dto.evidence !== undefined) inspection.evidence = dto.evidence as any[];
    if (dto.damages !== undefined) inspection.damages = dto.damages as any[];

    return this.inspections.save(inspection);
  }

  /**
   * Appends an R2 public URL to the inspection evidence array (plain strings).
   * The file itself is uploaded by the client beforehand via
   * POST /uploads/presigned-url + PUT to R2 — this endpoint only stores the link.
   * Allowed for the assigned inspector (`inspected_by = actor.id`) and for
   * FACILITY_MANAGER / OPERATIONS_MANAGER; anything else gets 403.
   */
  async uploadEvidence(
    id: string,
    dto: UploadInspectionEvidenceDto,
    actor: AuthUser,
  ): Promise<Inspection> {
    const inspection = await this.inspections.findOne({ where: { id } });
    if (!inspection) notFound('Inspection', id);

    assertInspectorOrManager(
      inspection,
      actor,
      'Only the assigned inspector or a manager can upload evidence for this inspection',
    );
    assertNotFinalized(inspection);

    const evidence = Array.isArray(inspection.evidence) ? inspection.evidence : [];
    if (!evidence.includes(dto.evidenceUrl)) {
      if (evidence.length >= 20) {
        throw fieldValidationError(
          'evidenceUrl',
          'maxItems',
          'Inspection evidence cannot exceed 20 items',
        );
      }
      evidence.push(dto.evidenceUrl);
    }
    inspection.evidence = evidence;

    return this.inspections.save(inspection);
  }
}
