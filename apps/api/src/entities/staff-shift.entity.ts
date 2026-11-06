import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { ShiftTemplate } from '@entities/shift-template.entity';
import { StaffShiftStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One staff member working one shift on one day. `start_at`/`end_at` are copied from the template
 * when the shift is scheduled, so retiming a template never rewrites past or planned shifts, and
 * the database can refuse two live shifts of the same staff member that overlap.
 */
@Entity('staff_shifts')
// Created in migration: the overlap exclusion constraint and these two lookup indexes.
@Index('IDX_staff_shifts_facility_date', { synchronize: false })
@Index('IDX_staff_shifts_staff_start', { synchronize: false })
export class StaffShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', name: 'shift_template_id' })
  shiftTemplateId: string;

  /** The day the shift starts on (YYYY-MM-DD); an overnight shift ends the day after. */
  @Column({ type: 'date', name: 'work_date' })
  workDate: string;

  @Column({ type: 'timestamptz', name: 'start_at' })
  startAt: Date;

  @Column({ type: 'timestamptz', name: 'end_at' })
  endAt: Date;

  @Column({ type: 'varchar', length: 20, default: StaffShiftStatus.SCHEDULED })
  status: StaffShiftStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'check_in_at' })
  checkInAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'check_out_at' })
  checkOutAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_by' })
  assignedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'staff_id' })
  staff: AppUser;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => ShiftTemplate)
  @JoinColumn({ name: 'shift_template_id' })
  shiftTemplate: ShiftTemplate;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by' })
  assigner: AppUser | null;
}
