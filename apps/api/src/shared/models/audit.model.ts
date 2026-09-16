import { CreateDateColumn, DeleteDateColumn, Index, UpdateDateColumn } from 'typeorm';

export abstract class AuditWithTimezone {
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp with time zone',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp with time zone',
    nullable: true,
    select: false,
  })
  deletedAt?: Date;
}
