import { StaffShift } from '@entities/staff-shift.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DomainException, notFound } from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { StaffShiftStatus } from '@storage/types';
import { Between, type Repository } from 'typeorm';
import type { DateRangeQueryDto } from './dto/date-range-query.dto';
import { assertDateRange } from './shift-calendar';
import {
  type StaffShiftListResponse,
  type StaffShiftResponse,
  toStaffShiftRecord,
} from './types/staff-shift';

/** How early before the start a staff member may check in. */
export const CHECK_IN_OPENS_BEFORE_MS = 30 * 60 * 1000;

const WITH_NAMES = { staff: true, shiftTemplate: true } as const;

/** A staff member's own schedule and attendance. Someone else's shift reads as not found. */
@Injectable()
export class MyStaffShiftsService {
  constructor(
    @InjectRepository(StaffShift)
    private readonly shifts: Repository<StaffShift>,
  ) {}

  async list(query: DateRangeQueryDto, staff: AuthUser): Promise<StaffShiftListResponse> {
    assertDateRange(query.from, query.to);
    const rows = await this.shifts.find({
      where: { staffId: staff.id, workDate: Between(query.from, query.to) },
      relations: WITH_NAMES,
      withDeleted: true,
      order: { workDate: 'ASC', startAt: 'ASC' },
    });
    return { staff_shifts: rows.map(toStaffShiftRecord) };
  }

  /** Opens 30 minutes before the start and closes when the shift ends. */
  async checkIn(id: string, staff: AuthUser): Promise<StaffShiftResponse> {
    const shift = await this.findOwnShift(id, staff);
    const now = new Date();
    const opensAt = new Date(shift.startAt.getTime() - CHECK_IN_OPENS_BEFORE_MS);
    if (shift.status !== StaffShiftStatus.SCHEDULED || now < opensAt || now >= shift.endAt) {
      throw new DomainException(
        ErrorCode.STAFF_SHIFT_CHECK_IN_NOT_ALLOWED,
        'Check-in opens 30 minutes before a scheduled shift and closes when it ends',
        HttpStatus.CONFLICT,
      );
    }
    await this.transition(
      shift,
      StaffShiftStatus.SCHEDULED,
      {
        status: StaffShiftStatus.CHECKED_IN,
        checkInAt: now,
      },
      ErrorCode.STAFF_SHIFT_CHECK_IN_NOT_ALLOWED,
    );
    return this.reload(id);
  }

  /** Any time after checking in; a forgotten check-out simply stays CHECKED_IN. */
  async checkOut(id: string, staff: AuthUser): Promise<StaffShiftResponse> {
    const shift = await this.findOwnShift(id, staff);
    await this.transition(
      shift,
      StaffShiftStatus.CHECKED_IN,
      {
        status: StaffShiftStatus.COMPLETED,
        checkOutAt: new Date(),
      },
      ErrorCode.STAFF_SHIFT_CHECK_OUT_NOT_ALLOWED,
    );
    return this.reload(id);
  }

  private async findOwnShift(id: string, staff: AuthUser): Promise<StaffShift> {
    return (
      (await this.shifts.findOne({ where: { id, staffId: staff.id } })) ??
      notFound('Staff shift', id)
    );
  }

  /** Conditional on the current status, so a concurrent check-in or the absence job wins cleanly. */
  private async transition(
    shift: StaffShift,
    from: StaffShiftStatus,
    changes: Partial<StaffShift>,
    errorCode: ErrorCode,
  ): Promise<void> {
    const result = await this.shifts.update({ id: shift.id, status: from }, changes);
    if (!result.affected) {
      throw new DomainException(
        errorCode,
        `The shift is ${shift.status}, not ${from}`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async reload(id: string): Promise<StaffShiftResponse> {
    const row = await this.shifts.findOneOrFail({
      where: { id },
      relations: WITH_NAMES,
      withDeleted: true,
    });
    return { staff_shift: toStaffShiftRecord(row) };
  }
}
