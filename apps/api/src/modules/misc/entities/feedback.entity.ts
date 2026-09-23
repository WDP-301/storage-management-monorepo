import { Contract } from '@modules/contracts/entities/contract.entity';
import { Facility } from '@modules/facilities/entities/facility.entity';
import { AppUser } from '@modules/users/entities/app-user.entity';
import { FeedbackStatus } from '@shared/models/domain.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'contract_id' })
  contractId?: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'varchar', length: 20, default: FeedbackStatus.PENDING })
  status: FeedbackStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'customer_id' })
  customer: AppUser;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => Contract, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;
}
