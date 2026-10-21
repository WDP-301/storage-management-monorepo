import { ApiProperty } from '@nestjs/swagger';
import { type ManagedReturnRequestInput, ReturnRequestSource } from '@storage/types';
import { IsIn } from 'class-validator';
import { ReturnRequestDto } from './return-request.dto';

/** Sources a branch can record; CUSTOMER is only ever set by the customer's own request. */
export const MANAGED_RETURN_SOURCES = [
  ReturnRequestSource.HOTLINE,
  ReturnRequestSource.ABANDONED,
] as const;

/** A return request the branch makes for the customer (phoned in, or the unit was abandoned). */
export class ManagedReturnRequestDto extends ReturnRequestDto implements ManagedReturnRequestInput {
  @ApiProperty({
    enum: MANAGED_RETURN_SOURCES,
    description: 'HOTLINE: the customer phoned the branch; ABANDONED: the customer left the unit',
  })
  @IsIn(MANAGED_RETURN_SOURCES)
  source: (typeof MANAGED_RETURN_SOURCES)[number];
}
