import { AuditWithTimezone } from '@shared/models/audit.model';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A work shift the system offers (morning, afternoon, …). Shifts are data, not code: an admin
 * adds, renames or deactivates them, and the active ones are what staff can be scheduled on.
 * A template is deactivated rather than deleted once used, so past schedules keep their shift.
 */
@Entity('shift_templates')
// Unique among live rows only (created in migration — partial index on deleted_at IS NULL).
@Index('UQ_shift_templates_code', { synchronize: false })
export class ShiftTemplate extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable machine-readable key (e.g. MORNING), unique among non-deleted templates. */
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Local wall-clock time (HH:mm:ss). An end_time at or before start_time means overnight. */
  @Column({ type: 'time', name: 'start_time' })
  startTime: string;

  @Column({ type: 'time', name: 'end_time' })
  endTime: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
