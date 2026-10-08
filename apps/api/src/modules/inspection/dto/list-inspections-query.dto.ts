import { ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionType } from '@storage/types';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const INSPECTION_LIST_STATUSES = ['open', 'done'] as const;
export type InspectionListStatus = (typeof INSPECTION_LIST_STATUSES)[number];

export class ListInspectionsQueryDto {
  @ApiPropertyOptional({ enum: Object.values(InspectionType) })
  @IsOptional()
  @IsIn(Object.values(InspectionType))
  type?: InspectionType;

  @ApiPropertyOptional({ enum: INSPECTION_LIST_STATUSES, description: 'open = not finalized' })
  @IsOptional()
  @IsIn(INSPECTION_LIST_STATUSES)
  status?: InspectionListStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  facilityId?: string;
}
