import { StaffShift } from '@entities/staff-shift.entity';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { StaffShiftStatus } from '@storage/types';
import { LessThanOrEqual, type Repository } from 'typeorm';

/**
 * Marks shifts that ended without a check-in as ABSENT. A single conditional UPDATE, so running
 * on several instances at once is harmless and needs no lock.
 */
@Injectable()
export class StaffShiftAbsenceJob {
  private readonly logger = new Logger(StaffShiftAbsenceJob.name);

  constructor(
    @InjectRepository(StaffShift)
    private readonly shifts: Repository<StaffShift>,
  ) {}

  @Cron('*/15 * * * *')
  async markAbsent(): Promise<void> {
    const result = await this.shifts.update(
      { status: StaffShiftStatus.SCHEDULED, endAt: LessThanOrEqual(new Date()) },
      { status: StaffShiftStatus.ABSENT },
    );
    if (result.affected) this.logger.log(`Marked ${result.affected} shift(s) ABSENT`);
  }
}
