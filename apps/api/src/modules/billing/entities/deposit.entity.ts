import { ContractUnit } from '@modules/contracts/entities/contract-unit.entity';
import { DepositStatus } from '@shared/models/domain.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

@Entity('deposits')
export class Deposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'contract_unit_id' })
  contractUnitId: string;

  @Column({ type: 'uuid', nullable: true, name: 'payment_id' })
  paymentId?: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'amount_snapshot' })
  amountSnapshot: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'held_amount' })
  heldAmount: number;

  @Column({ type: 'varchar', length: 20, default: DepositStatus.HELD })
  status: DepositStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => ContractUnit)
  @JoinColumn({ name: 'contract_unit_id' })
  contractUnit: ContractUnit;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;
}
