import { AppUser } from '@modules/customer/entities/app-user.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { StorageUnit } from '@modules/facilities/entities/storage-unit.entity';
import { TicketPriority, TicketStatus, TicketType } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('service_tickets')
export class ServiceTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40, name: 'ticket_no' })
  ticketNo: string;

  @Column({ type: 'varchar', length: 20 })
  type: TicketType;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'storage_unit_id' })
  storageUnitId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'customer_id' })
  customerId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_to' })
  assignedTo?: string;

  @Column({ type: 'varchar', length: 15, default: TicketPriority.NORMAL })
  priority: TicketPriority;

  @Column({ type: 'varchar', length: 20, default: TicketStatus.OPEN })
  status: TicketStatus;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  resolution?: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: any[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: any[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt?: Date;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => StorageUnit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'storage_unit_id' })
  storageUnit?: StorageUnit;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer?: AppUser;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to' })
  assignee?: AppUser;
}
