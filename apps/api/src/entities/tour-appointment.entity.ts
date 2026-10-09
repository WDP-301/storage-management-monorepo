import { AppUser } from '@entities/app-user.entity';
import { Facility } from '@entities/facility.entity';
import { StorageUnit } from '@entities/storage-unit.entity';
import { TourAppointmentStatus } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tour_appointments')
export class TourAppointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'customer_id' })
  customerId?: string | null;

  @Column({ type: 'varchar', length: 150, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'uuid', nullable: true, name: 'storage_unit_id' })
  storageUnitId?: string | null;

  @Column({ type: 'date', name: 'preferred_date' })
  preferredDate: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'preferred_time_slot' })
  preferredTimeSlot?: string | null;

  @Column({ type: 'text', nullable: true, name: 'customer_notes' })
  customerNotes?: string | null;

  @Column({
    type: 'enum',
    enum: TourAppointmentStatus,
    default: TourAppointmentStatus.PENDING,
    enumName: 'tour_appointment_status_enum',
  })
  status: TourAppointmentStatus;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_to' })
  assignedTo?: string | null;

  @Column({ type: 'text', nullable: true, name: 'manager_notes' })
  managerNotes?: string | null;

  @Column({ type: 'text', nullable: true, name: 'staff_result_notes' })
  staffResultNotes?: string | null;

  @Column({ type: 'text', nullable: true, name: 'cancellation_reason' })
  cancellationReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Facility, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer?: AppUser | null;

  @ManyToOne(() => StorageUnit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit?: StorageUnit | null;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to' })
  assignee?: AppUser | null;
}
