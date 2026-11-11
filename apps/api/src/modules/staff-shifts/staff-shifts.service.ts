import { ShiftTemplate } from '@entities/shift-template.entity';
import { StaffShift } from '@entities/staff-shift.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { activeFacilityIds } from '@modules/auth/role-assignment.util';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { FacilitiesService } from '@modules/facilities/facilities.service';
import { HandoverAssignmentService } from '@modules/inspection/handover-assignment/handover-assignment.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isExclusionViolation } from '@shared/utils/pg-error.util';
import { StaffShiftStatus, UserRole } from '@storage/types';
import {
  Between,
  DataSource,
  type EntityManager,
  In,
  LessThan,
  MoreThan,
  Not,
  type Repository,
} from 'typeorm';
import type { CreateStaffShiftsDto } from './dto/create-staff-shifts.dto';
import type { ListStaffShiftsQueryDto } from './dto/list-staff-shifts-query.dto';
import type { UpdateStaffShiftDto } from './dto/update-staff-shift.dto';
import { assertDateRange, periodsOverlap, shiftPeriod } from './shift-calendar';
import {
  shiftCancelledNotification,
  shiftsAssignedNotification,
  shiftUpdatedNotification,
} from './staff-shift-notifications';
import {
  type StaffShiftListResponse,
  type StaffShiftResponse,
  toStaffShiftRecord,
} from './types/staff-shift';

/** A shift about to be inserted. */
export interface ShiftDraft {
  staffId: string;
  facilityId: string;
  template: ShiftTemplate;
  workDate: string;
  note?: string;
}

const SCHEDULING_ROLES_ANYWHERE: UserRole[] = [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER];
const WITH_NAMES = { staff: true, shiftTemplate: true } as const;

/** Scheduling done by managers: list a facility's shifts, add, move and cancel them. */
@Injectable()
export class StaffShiftsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StaffShift)
    private readonly shifts: Repository<StaffShift>,
    @InjectRepository(UserRoleAssignment)
    private readonly roleAssignments: Repository<UserRoleAssignment>,
    private readonly facilities: FacilitiesService,
    private readonly notifications: NotificationsService,
    private readonly handoverAssignment: HandoverAssignmentService,
  ) {}

  async list(query: ListStaffShiftsQueryDto, actor: AuthUser): Promise<StaffShiftListResponse> {
    assertDateRange(query.from, query.to);
    await this.assertManagesFacility(actor, query.facilityId);
    const rows = await this.shifts.find({
      where: {
        facilityId: query.facilityId,
        workDate: Between(query.from, query.to),
        ...(query.staffId ? { staffId: query.staffId } : {}),
      },
      relations: WITH_NAMES,
      withDeleted: true,
      order: { workDate: 'ASC', startAt: 'ASC' },
    });
    return { staff_shifts: rows.map(toStaffShiftRecord) };
  }

  create(dto: CreateStaffShiftsDto, actor: AuthUser): Promise<StaffShiftListResponse> {
    return this.withFacilityLock(dto.facilityId, async (em) => {
      await this.assertFacilityStaff(dto.facilityId, dto.staffIds, actor);
      const template = await this.findActiveTemplate(em, dto.shiftTemplateId);
      const drafts = dto.staffIds.flatMap((staffId) =>
        dto.workDates.map(
          (workDate): ShiftDraft => ({
            staffId,
            facilityId: dto.facilityId,
            template,
            workDate,
            note: dto.note,
          }),
        ),
      );
      const saved = await this.insertShifts(em, drafts, actor);
      return {
        staff_shifts: await this.loadRecords(
          em,
          saved.map((shift) => shift.id),
        ),
      };
    });
  }

  async update(id: string, dto: UpdateStaffShiftDto, actor: AuthUser): Promise<StaffShiftResponse> {
    const { facilityId } = await this.findManagedShift(id, actor);
    return this.withFacilityLock(facilityId, async (em) => {
      const shift = await this.findEditableShift(em, id);
      if (dto.shiftTemplateId !== undefined || dto.workDate !== undefined) {
        const template = await this.findActiveTemplate(
          em,
          dto.shiftTemplateId ?? shift.shiftTemplateId,
        );
        shift.shiftTemplateId = template.id;
        shift.workDate = dto.workDate ?? shift.workDate;
        Object.assign(shift, shiftPeriod(shift.workDate, template));
        this.assertNotStarted([shift], 'workDate');
        await this.assertNoOverlap(em, [shift], shift.id);
      }
      if (dto.note !== undefined) shift.note = dto.note;

      const saved = await this.saveShifts(em, [shift]);
      await this.notifications.createForUsers(em, [shift.staffId], shiftUpdatedNotification(shift));
      await this.assignPendingHandovers(em, [shift]);
      return { staff_shift: (await this.loadRecords(em, [saved[0].id]))[0] };
    });
  }

  async cancel(id: string, actor: AuthUser): Promise<StaffShiftResponse> {
    const { facilityId } = await this.findManagedShift(id, actor);
    return this.withFacilityLock(facilityId, async (em) => {
      const shift = await this.findEditableShift(em, id);
      shift.status = StaffShiftStatus.CANCELLED;
      await em.save(shift);
      await this.notifications.createForUsers(
        em,
        [shift.staffId],
        shiftCancelledNotification(shift),
      );
      return { staff_shift: (await this.loadRecords(em, [shift.id]))[0] };
    });
  }

  /**
   * Serializes scheduling per facility, so two managers cannot both pass the overlap check for the
   * same staff member; the exclusion constraint still backs it up.
   */
  withFacilityLock<T>(facilityId: string, work: (em: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`staff_shifts:${facilityId}`]);
      return work(em);
    });
  }

  /** Inserts the drafts all or nothing and tells each staff member once about their new shifts. */
  async insertShifts(
    em: EntityManager,
    drafts: ShiftDraft[],
    actor: AuthUser,
  ): Promise<StaffShift[]> {
    const shifts = drafts.map((draft) =>
      em.create(StaffShift, {
        staffId: draft.staffId,
        facilityId: draft.facilityId,
        shiftTemplateId: draft.template.id,
        workDate: draft.workDate,
        ...shiftPeriod(draft.workDate, draft.template),
        status: StaffShiftStatus.SCHEDULED,
        note: draft.note ?? null,
        assignedBy: actor.id,
      }),
    );
    this.assertNotStarted(shifts, 'workDates');
    await this.assertNoOverlap(em, shifts);

    const saved = await this.saveShifts(em, shifts);
    const byStaff = new Map<string, StaffShift[]>();
    for (const shift of [...saved].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
      byStaff.set(shift.staffId, [...(byStaff.get(shift.staffId) ?? []), shift]);
    }
    for (const [staffId, staffShifts] of byStaff) {
      await this.notifications.createForUsers(
        em,
        [staffId],
        shiftsAssignedNotification(staffShifts),
      );
    }
    await this.assignPendingHandovers(em, saved);
    return saved;
  }

  /**
   * Once shifts exist, a handover that was left for a manager (no one on shift at confirmation)
   * can be taken: re-runs the round robin for the window the shifts cover. Never throws, so it
   * cannot undo the shift creation.
   */
  private async assignPendingHandovers(em: EntityManager, shifts: StaffShift[]): Promise<void> {
    if (shifts.length === 0) return;
    const from = new Date(Math.min(...shifts.map((shift) => shift.startAt.getTime())));
    const to = new Date(Math.max(...shifts.map((shift) => shift.endAt.getTime())));
    await this.handoverAssignment.assignPendingForFacility(em, shifts[0].facilityId, from, to);
  }

  /** ADMIN and OPERATIONS_MANAGER schedule anywhere; a FACILITY_MANAGER only where they manage. */
  async assertManagesFacility(actor: AuthUser, facilityId: string): Promise<void> {
    if (SCHEDULING_ROLES_ANYWHERE.some((role) => actor.roles.includes(role))) return;
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

  async findActiveTemplate(em: EntityManager, id: string): Promise<ShiftTemplate> {
    const template = await em.findOne(ShiftTemplate, { where: { id, isActive: true } });
    if (!template) {
      throw fieldValidationError(
        'shiftTemplateId',
        'SHIFT_TEMPLATE_INACTIVE',
        'Choose an active shift template',
      );
    }
    return template;
  }

  /** Each staff member must currently work at the facility; also checks the actor manages it. */
  private async assertFacilityStaff(
    facilityId: string,
    staffIds: string[],
    actor: AuthUser,
  ): Promise<void> {
    const staff = new Set(
      (await this.facilities.findStaff(facilityId, actor)).map((member) => member.id),
    );
    const outsiders = staffIds.filter((id) => !staff.has(id));
    if (outsiders.length > 0) {
      throw fieldValidationError(
        'staffIds',
        'NOT_FACILITY_STAFF',
        `Not active staff of this facility: ${outsiders.join(', ')}`,
      );
    }
  }

  private async findManagedShift(id: string, actor: AuthUser): Promise<StaffShift> {
    const shift = (await this.shifts.findOne({ where: { id } })) ?? notFound('Staff shift', id);
    await this.assertManagesFacility(actor, shift.facilityId);
    return shift;
  }

  /** Re-read under the lock; only a scheduled shift that has not started may change. */
  private async findEditableShift(em: EntityManager, id: string): Promise<StaffShift> {
    const shift = (await em.findOne(StaffShift, { where: { id } })) ?? notFound('Staff shift', id);
    if (shift.status !== StaffShiftStatus.SCHEDULED || shift.startAt <= new Date()) {
      throw new DomainException(
        ErrorCode.STAFF_SHIFT_LOCKED,
        'Only a scheduled shift that has not started can be changed',
        HttpStatus.CONFLICT,
      );
    }
    return shift;
  }

  private assertNotStarted(shifts: StaffShift[], field: string): void {
    const now = new Date();
    const started = shifts.filter((shift) => shift.startAt <= now).map((shift) => shift.workDate);
    if (started.length > 0) {
      throw fieldValidationError(
        field,
        'SHIFT_IN_PAST',
        `These shifts would already have started: ${[...new Set(started)].join(', ')}`,
      );
    }
  }

  /** Refuses shifts that overlap a live shift of the same staff member, or each other. */
  private async assertNoOverlap(
    em: EntityManager,
    shifts: StaffShift[],
    ignoreId?: string,
  ): Promise<void> {
    const earliest = new Date(Math.min(...shifts.map((s) => s.startAt.getTime())));
    const latest = new Date(Math.max(...shifts.map((s) => s.endAt.getTime())));
    const existing = await em.find(StaffShift, {
      where: {
        staffId: In([...new Set(shifts.map((s) => s.staffId))]),
        status: Not(StaffShiftStatus.CANCELLED),
        startAt: LessThan(latest),
        endAt: MoreThan(earliest),
        ...(ignoreId ? { id: Not(ignoreId) } : {}),
      },
    });

    const conflicts: Record<string, unknown>[] = [];
    shifts.forEach((shift, index) => {
      const clashes = [...existing, ...shifts.slice(0, index)].filter(
        (other) => other.staffId === shift.staffId && periodsOverlap(shift, other),
      );
      for (const other of clashes) {
        conflicts.push({
          staff_id: shift.staffId,
          work_date: shift.workDate,
          // A clash between two new shifts has no id yet.
          conflicts_with: { id: other.id ?? null, work_date: other.workDate },
        });
      }
    });
    if (conflicts.length > 0) {
      throw new DomainException(
        ErrorCode.STAFF_SHIFT_OVERLAP,
        'Some shifts overlap shifts the staff member already has',
        HttpStatus.CONFLICT,
        { conflicts },
      );
    }
  }

  /** A concurrent write that slipped past the overlap check still lands on the constraint. */
  private async saveShifts(em: EntityManager, shifts: StaffShift[]): Promise<StaffShift[]> {
    try {
      return await em.save(shifts);
    } catch (error: unknown) {
      if (isExclusionViolation(error)) {
        throw new DomainException(
          ErrorCode.STAFF_SHIFT_OVERLAP,
          'Some shifts overlap shifts the staff member already has',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  private async loadRecords(em: EntityManager, ids: string[]) {
    const rows = await em.find(StaffShift, {
      where: { id: In(ids) },
      relations: WITH_NAMES,
      withDeleted: true,
      order: { workDate: 'ASC', startAt: 'ASC' },
    });
    return rows.map(toStaffShiftRecord);
  }
}
