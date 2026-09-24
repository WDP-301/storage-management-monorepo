import { RentalPeriodKind } from '@storage/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ContractUnit } from './contract-unit.entity';

@Entity('rental_periods')
@Unique('UQ_period_no', ['contractUnitId', 'periodNo'])
export class RentalPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'contract_unit_id' })
  contractUnitId: string;

  @Column({ type: 'int', name: 'period_no' })
  periodNo: number;

  @Column({ type: 'varchar', length: 20 })
  kind: RentalPeriodKind;

  @Column({ type: 'timestamptz', name: 'start_at' })
  startAt: Date;

  @Column({ type: 'timestamptz', name: 'end_at' })
  endAt: Date;

  @Column({ type: 'int' })
  months: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'monthly_price_snapshot' })
  monthlyPriceSnapshot: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'rent_total' })
  rentTotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ContractUnit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_unit_id' })
  contractUnit: ContractUnit;
}
