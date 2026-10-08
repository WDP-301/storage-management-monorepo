import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignInspectionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'FACILITY_STAFF user id to assign the inspection to',
  })
  @IsUUID('all')
  inspectedBy: string;
}
