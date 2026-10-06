import { AuditWithTimezone } from '@shared/models/audit.model';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('unit_types')
export class UnitType extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 7, scale: 2, name: 'width_m' })
  widthM: number;

  @Column({ type: 'decimal', precision: 7, scale: 2, name: 'length_m' })
  lengthM: number;

  @Column({ type: 'decimal', precision: 7, scale: 2, nullable: true, name: 'height_m' })
  heightM?: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'monthly_price' })
  monthlyPrice: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1, name: 'default_deposit_months' })
  defaultDepositMonths: number;
}
