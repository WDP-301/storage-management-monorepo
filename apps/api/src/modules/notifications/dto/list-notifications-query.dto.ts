import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;
export const MAX_NOTIFICATION_PAGE_SIZE = 100;

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: '1-based page number' })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: DEFAULT_NOTIFICATION_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_NOTIFICATION_PAGE_SIZE,
    description: 'Page size',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_NOTIFICATION_PAGE_SIZE)
  limit?: number = DEFAULT_NOTIFICATION_PAGE_SIZE;

  @ApiPropertyOptional({ description: 'true = only notifications not read yet' })
  @IsOptional()
  // Implicit conversion turns any non-empty string (even "false") into true — read the raw value.
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}
