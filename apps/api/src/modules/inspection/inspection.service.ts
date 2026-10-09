import { AppUser } from '@entities/app-user.entity';
import type { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { ContractStatus, UserRole, UserStatus } from '@storage/types';
import { DataSource, type FindOptionsWhere, In, IsNull, Not } from 'typeorm';
import { AssignInspectionDto } from './dto/assign-inspection.dto';
import { ListInspectionsQueryDto } from './dto/list-inspections-query.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import {
  assertInspectorOrManager,
  assertManagesInspection,
  assertNotFinalized,
  INSPECTION_RELATIONS,
  isGlobalManager,
  loadInspectionFacilityId,
  loadManagedFacilityIds,
  managesInspectionFacility,
  withPublicInspector,
} from './inspection-access.util';

@Injectable()
export class InspectionService {
  constructor(private readonly dataSource: DataSource) {}

  private get em() {
    return this.dataSource.manager;
  }

  /** Manager view; FACILITY_MANAGER only sees the facilities they manage. */
  async findAll(actor: AuthUser, query: ListInspectionsQueryDto = {}): Promise<Inspection[]> {
    let facilityIds: string[] | undefined = query.facilityId ? [query.facilityId] : undefined;
    if (!isGlobalManager(actor)) {
      const managed = await loadManagedFacilityIds(this.em, actor.id);
      facilityIds = facilityIds ? facilityIds.filter((id) => managed.includes(id)) : managed;
      if (facilityIds.length === 0) return [];
    }
    return this.list({
      ...this.filters(query),
      ...(facilityIds
        ? { contract: { bookingItem: { storageUnit: { facilityId: In(facilityIds) } } } }
        : {}),
    });
  }

  /** Customer view: every inspection whose contract belongs to the caller. */
  findMyInspections(actor: AuthUser): Promise<Inspection[]> {
    return this.list({ contract: { customerId: actor.id } });
  }

  /** Staff view: every inspection assigned to the caller (`inspected_by = me`). */
  findStaffInspections(
    actor: AuthUser,
    query: ListInspectionsQueryDto = {},
  ): Promise<Inspection[]> {
    return this.list({ ...this.filters(query), inspectedBy: actor.id });
  }

  /** Readable by the contract owner, the assigned inspector and managers of the facility. */
  async findById(id: string, actor: AuthUser): Promise<Inspection> {
    const inspection = await this.em.findOne(Inspection, {
      where: { id },
      relations: INSPECTION_RELATIONS,
    });
    if (!inspection) notFound('Inspection', id);
    const ownsOrInspects =
      inspection.contract?.customerId === actor.id || inspection.inspectedBy === actor.id;
    if (!ownsOrInspects && !(await managesInspectionFacility(this.em, inspection, actor))) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have access to this inspection',
        HttpStatus.FORBIDDEN,
      );
    }
    return withPublicInspector(inspection);
  }

  /** Assigns an ACTIVE user holding an active FACILITY_STAFF role at the unit's facility. */
  async assignStaff(id: string, dto: AssignInspectionDto, actor: AuthUser): Promise<Inspection> {
    return this.dataSource.transaction(async (em) => {
      const inspection = await em.findOne(Inspection, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!inspection) notFound('Inspection', id);
      await assertManagesInspection(em, inspection, actor);
      assertNotFinalized(inspection);

      const assignee = await em.findOne(AppUser, {
        where: { id: dto.inspectedBy, status: UserStatus.ACTIVE },
      });
      if (!assignee) {
        throw fieldValidationError('inspectedBy', 'notFound', 'Staff user does not exist');
      }

      const staffAssignments = await em.find(UserRoleAssignment, {
        where: { userId: dto.inspectedBy, role: UserRole.FACILITY_STAFF },
      });
      const facilityId = await loadInspectionFacilityId(em, inspection);
      if (!facilityId || !activeFacilityIds(staffAssignments).includes(facilityId)) {
        throw fieldValidationError(
          'inspectedBy',
          'notStaff',
          'User is not an active staff member of this facility',
        );
      }

      inspection.inspectedBy = dto.inspectedBy;
      return em.save(Inspection, inspection);
    });
  }

  /**
   * Updates inspection fields (assigned inspector or a manager of the facility).
   * `inspected_by` only changes through assign, `finalized_at` only through finalize.
   */
  async update(id: string, dto: UpdateInspectionDto, actor: AuthUser): Promise<Inspection> {
    // Row lock: a save racing a finalize must see the committed finalizedAt (409),
    // not write its stale copy back and clear it.
    return this.dataSource.transaction(async (em) => {
      const inspection = await em.findOne(Inspection, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!inspection) notFound('Inspection', id);
      await assertInspectorOrManager(
        em,
        inspection,
        actor,
        'Only the assigned inspector or a manager can update this inspection',
      );
      assertNotFinalized(inspection);

      if (dto.conditionNotes !== undefined) {
        inspection.conditionNotes = dto.conditionNotes;
      }
      if (dto.evidence !== undefined) inspection.evidence = dto.evidence;
      if (dto.damages !== undefined) inspection.damages = dto.damages;
      await em.save(Inspection, inspection);
      // Clients re-render from this response, so it carries the same relations as a read.
      const reloaded = await em.findOne(Inspection, {
        where: { id },
        relations: INSPECTION_RELATIONS,
      });
      return withPublicInspector(reloaded ?? inspection);
    });
  }

  private filters(query: ListInspectionsQueryDto): FindOptionsWhere<Inspection> {
    return {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status === 'open' ? { finalizedAt: IsNull() } : {}),
      ...(query.status === 'done' ? { finalizedAt: Not(IsNull()) } : {}),
    };
  }

  private async list(where: FindOptionsWhere<Inspection>): Promise<Inspection[]> {
    // A cancelled contract never reaches handover, so its inspection is not work to do.
    const contract = {
      ...(where.contract as FindOptionsWhere<Contract> | undefined),
      status: Not(ContractStatus.CANCELLED),
    };
    const rows = await this.em.find(Inspection, {
      where: { ...where, contract },
      relations: INSPECTION_RELATIONS,
      order: { scheduledAt: { direction: 'ASC', nulls: 'LAST' }, createdAt: 'DESC' },
    });
    return rows.map(withPublicInspector);
  }
}
