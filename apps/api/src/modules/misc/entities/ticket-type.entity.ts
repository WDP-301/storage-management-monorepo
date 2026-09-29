import { AuditWithTimezone } from '@shared/models/audit.model';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ticket_types')
export class TicketType extends AuditWithTimezone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
}
